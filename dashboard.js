const API_BASE = "https://visionbank-tle1.onrender.com";

// Global state for sorting / flashing
let agentData = [];
let currentSortColumn = null;
let currentSortDir = "asc";

// 15 minutes for flashing threshold
const STATUS_THRESHOLD_SECONDS = 15 * 60;

/* -------------------------------------------------------
   Helper: fetch JSON with better error handling
------------------------------------------------------- */
async function fetchJson(url) {
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
    }
    return resp.json();
}

/* -------------------------------------------------------
   Queue status
------------------------------------------------------- */
async function loadQueueStatus() {
    const tbody = document.getElementById("queue-body");
    tbody.innerHTML = `
        <tr><td colspan="4" class="error-cell">Loading queue status…</td></tr>
    `;

    try {
        // Proxy endpoint that calls v3/realtime/queue
        const data = await fetchJson(`${API_BASE}/queues`);

        // Expecting something like { QueueStatus: [{ ... }] }
        const queues = data.QueueStatus || data.Queues || data.queueStatus || [];

        if (!queues.length) {
            tbody.innerHTML = `
                <tr><td colspan="4" class="error-cell">
                    No active queues.
                </td></tr>`;
            return;
        }

        const q = queues[0]; // Only one queue is used on this dashboard

        const queueName = q.QueueName || q.Name || "Voice Queue";
        const calls = q.CallsInQueue ?? q.Calls ?? 0;
        const agents = q.AgentsSignedOn ?? q.Agents ?? 0;

        // Longest / average wait time in seconds
        const waitSeconds =
            q.MaxQueueWaitingTime ??
            q.MaxWaitingTime ??
            q.LongestWaitingTime ??
            0;

        tbody.innerHTML = `
            <tr>
                <td>${queueName}</td>
                <td>${calls}</td>
                <td>${agents}</td>
                <td>${formatSeconds(waitSeconds)}</td>
            </tr>
        `;
    } catch (err) {
        console.error("Queue load error:", err);
        tbody.innerHTML = `
            <tr><td colspan="4" class="error-cell">
                Unable to load queue status.
            </td></tr>
        `;
    }
}

/* -------------------------------------------------------
   Realtime Global Statistics  (v3/realtime/statistics/global)
------------------------------------------------------- */
async function loadGlobalStats() {
    const errorDiv = document.getElementById("global-error");
    const kpiContainer = document.getElementById("global-kpi");

    errorDiv.classList.add("hidden");

    // reset placeholders
    for (const id of [
        "kpi-total-queued",
        "kpi-total-transferred",
        "kpi-total-abandoned",
        "kpi-max-wait",
        "kpi-service-level",
        "kpi-total-received",
        "kpi-answer-rate",
        "kpi-abandon-rate",
        "kpi-callbacks-registered",
        "kpi-callbacks-waiting"
    ]) {
        const el = document.getElementById(id);
        if (el) el.textContent = "--";
    }

    try {
        // Proxy endpoint that maps to v3/realtime/statistics/global
        const json = await fetchJson(`${API_BASE}/statistics/global`);
        const stats =
            (json.GlobalStatistics && json.GlobalStatistics[0]) ||
            json[0] ||
            json;

        if (!stats) {
            throw new Error("No GlobalStatistics element in response");
        }

        setText("kpi-total-queued", stats.TotalCallsQueued);
        setText("kpi-total-transferred", stats.TotalCallsTransferred);
        setText("kpi-total-abandoned", stats.TotalCallsAbandoned);
        setText("kpi-max-wait", formatSeconds(stats.MaxQueueWaitingTime));
        setText("kpi-service-level", formatPercent(stats.ServiceLevel));
        setText("kpi-total-received", stats.TotalCallsReceived);
        setText("kpi-answer-rate", formatPercent(stats.AnswerRate));
        setText("kpi-abandon-rate", formatPercent(stats.AbandonRate));
        setText("kpi-callbacks-registered", stats.CallbacksRegistered);
        setText("kpi-callbacks-waiting", stats.CallbacksWaiting);
    } catch (err) {
        console.error("Global stats load error:", err);
        errorDiv.classList.remove("hidden");
    }
}

/* -------------------------------------------------------
   Agent performance
------------------------------------------------------- */
async function loadAgentStatus() {
    const tbody = document.getElementById("agent-body");
    tbody.innerHTML = `
        <tr><td colspan="10" class="error-cell">Loading agent data…</td></tr>
    `;

    try {
        // Proxy endpoint that calls v3/realtime/agentstatus
        const data = await fetchJson(`${API_BASE}/agents`);
        const agents =
            data.AgentStatus || data.Agents || data.agentStatus || [];

        if (!agents.length) {
            tbody.innerHTML = `
                <tr><td colspan="10" class="error-cell">
                    No agents signed on.
                </td></tr>`;
            return;
        }

        agentData = agents;
        renderAgentTable();
    } catch (err) {
        console.error("Agent status load error:", err);
        tbody.innerHTML = `
            <tr><td colspan="10" class="error-cell">
                Unable to load agent data.
            </td></tr>
        `;
    }
}

function renderAgentTable() {
    const tbody = document.getElementById("agent-body");
    if (!agentData || !agentData.length) return;

    tbody.innerHTML = "";

    agentData.forEach((a) => {
        const inbound = a.TotalCallsReceived ?? 0;
        const missed = a.TotalCallsMissed ?? 0;
        const transferred = a.ThirdPartyTransferCount ?? 0;
        const outbound = a.DialoutCount ?? 0;

        // Average handle: (TotalSecondsOnCall + WrappingUp) / calls
        const totalHandleSeconds =
            (a.TotalSecondsOnCall ?? 0) + (a.TotalSecondsWrappingUp ?? 0);
        const avgHandle =
            inbound > 0 ? totalHandleSeconds / inbound : 0;

        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${a.FullName || ""}</td>
            <td>${a.TeamName || ""}</td>
            <td>${a.PhoneExt || ""}</td>
            <td>${availabilityBadge(a)}</td>
            <td>${inbound}</td>
            <td>${missed}</td>
            <td>${transferred}</td>
            <td>${outbound}</td>
            <td>${formatSeconds(Math.round(avgHandle))}</td>
            <td>${formatDateTime(a.StartDateUtc)}</td>
        `;

        tbody.appendChild(row);
    });
}

/* -------------------------------------------------------
   Availability badge + flashing logic
------------------------------------------------------- */
function availabilityBadge(a) {
    const statusDesc = (a.CallTransferStatusDesc || "").toLowerCase();
    const secondsInStatus = a.SecondsInCurrentStatus ?? 0;

    let category = "other";

    if (a.CurrentAvailability === 1 || statusDesc.includes("available")) {
        category = "available";
    } else if (
        statusDesc.includes("on call") ||
        statusDesc.includes("busy") ||
        statusDesc.includes("call") ||
        statusDesc.includes("dial")
    ) {
        category = "oncall";
    } else if (
        statusDesc.includes("wrap") ||
        statusDesc.includes("break") ||
        statusDesc.includes("lunch")
    ) {
        category = "break";
    }

    const classes = ["availability-badge", `status-${category}`];

    if (
        (category === "oncall" || category === "break") &&
        secondsInStatus > STATUS_THRESHOLD_SECONDS
    ) {
        classes.push("flash-red");
    }

    const label =
        a.CallTransferStatusDesc ||
        (category === "available"
            ? "Available"
            : category === "oncall"
            ? "On Call"
            : category === "break"
            ? "Break / Wrap"
            : "Other");

    return `<span class="${classes.join(" ")}">${label}</span>`;
}

/* -------------------------------------------------------
   Formatting helpers
------------------------------------------------------- */
function formatSeconds(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds)) return "--:--:--";
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const hh = h.toString().padStart(2, "0");
    const mm = m.toString().padStart(2, "0");
    const ss = sec.toString().padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
}

function formatPercent(value) {
    if (value == null || isNaN(value)) return "--%";
    return `${value.toFixed(1)}%`;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent =
        value == null || value === "" ? "--" : String(value);
}

function formatDateTime(utcString) {
    if (!utcString) return "";
    const d = new Date(utcString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
}

/* -------------------------------------------------------
   Dark mode
------------------------------------------------------- */
function initDarkMode() {
    const toggle = document.getElementById("dark-mode-toggle");
    if (!toggle) return;

    toggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        toggle.textContent = document.body.classList.contains("dark-mode")
            ? "Light mode"
            : "Dark mode";
    });
}

/* -------------------------------------------------------
   Init / auto refresh
------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadGlobalStats();
    loadAgentStatus();
    initDarkMode();

    // refresh every 10 seconds
    setInterval(() => {
        loadQueueStatus();
        loadGlobalStats();
        loadAgentStatus();
    }, 10000);
});
