// ===============================
// CONFIG
// ===============================
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime";
const TOKEN = "VWGKXWSqGA4FwlRXb2cIx5H1dS3cYpplXa5iI3bE4Xg=";

// Wrapper for API calls
async function fetchApi(path) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            "token": TOKEN
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

// ===============================
// HELPERS
// ===============================
function formatTime(sec) {
    if (!sec || isNaN(sec)) return "00:00:00";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatDate(utc) {
    if (!utc) return "--";
    return new Date(utc + "Z").toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function safe(v, fallback = "--") {
    return v === undefined || v === null ? fallback : v;
}

// ===============================
// NEW AVAILABILITY LOGIC
// ===============================
function getAvailabilityClass(desc) {
    const s = (desc || "").toLowerCase();

    if (s.includes("available")) return "status-available";          // green
    if (s.includes("on call") || s.includes("dial")) return "status-oncall"; // red
    if (s.includes("busy")) return "status-busy";                    // yellow

    // NEW: Accept Internal Calls → Orange
    if (s.includes("accept internal")) return "status-ringing";

    if (s.includes("ring")) return "status-ringing";                 // orange
    return "";
}

// ===============================
// CURRENT QUEUE STATUS
// ===============================
async function loadQueueStatus() {
    const body = document.getElementById("queue-body");
    body.innerHTML = `<tr><td colspan="5" class="loading">Loading queue status…</td></tr>`;

    try {
        const data = await fetchApi("/status/queues");

        if (!data?.QueueStatus?.length) {
            body.innerHTML = `<tr><td colspan="5" class="error">Unable to load queue status.</td></tr>`;
            return;
        }

        const q = data.QueueStatus[0];

        const maxWait = q.MaxWaitingTime ?? q.OldestWaitTime ?? 0;
        const avgWait = q.AvgWaitInterval ?? 0;

        body.innerHTML = `
            <tr>
                <td>${safe(q.QueueName)}</td>
                <td class="numeric">${safe(q.TotalCalls, 0)}</td>
                <td class="numeric">${safe(q.TotalLoggedAgents, 0)}</td>
                <td class="numeric">${formatTime(maxWait)}</td>
                <td class="numeric">${formatTime(avgWait)}</td>
            </tr>
        `;
    } catch (e) {
        console.error("Queue Error:", e);
        body.innerHTML = `<tr><td colspan="5" class="error">Unable to load queue status.</td></tr>`;
    }
}

// ===============================
// GLOBAL STATISTICS (CARD VIEW)
// ===============================
async function loadGlobalStats() {
    try {
        const data = await fetchApi("/statistics/global");

        if (!data?.GlobalStatistics?.length) {
            document.getElementById("global-error").textContent = "Unable to load global statistics.";
            return;
        }

        const g = data.GlobalStatistics[0];

        setText("gs-total-queued", g.TotalCallsQueued);
        setText("gs-total-transferred", g.TotalCallsTransferred);
        setText("gs-total-abandoned", g.TotalCallsAbandoned);
        setText("gs-max-wait", formatTime(g.MaxQueueWaitingTime));

        setText("gs-service-level", g.ServiceLevel?.toFixed(2) + "%" || "--");
        setText("gs-total-received", g.TotalCallsReceived);

        setText("gs-answer-rate", g.AnswerRate?.toFixed(2) + "%" || "--");
        setText("gs-abandon-rate", g.AbandonRate?.toFixed(2) + "%" || "--");

        setText("gs-callbacks-registered", g.CallbacksRegistered);
        setText("gs-callbacks-waiting", g.CallbacksWaiting);

    } catch (e) {
        console.error("Global Stats Error:", e);
        document.getElementById("global-error").textContent = "Unable to load global statistics.";
    }
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val ?? "--";
}

// ===============================
// AGENT PERFORMANCE
// ===============================
async function loadAgentStatus() {
    const body = document.getElementById("agent-body");
    body.innerHTML = `<tr><td colspan="10" class="loading">Loading agent data…</td></tr>`;

    try {
        const data = await fetchApi("/status/agents");

        if (!data?.AgentStatus?.length) {
            body.innerHTML = `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
            return;
        }

        body.innerHTML = "";

        data.AgentStatus.forEach(a => {
            const inbound = a.TotalCallsReceived ?? 0;
            const avgHandleSeconds = inbound > 0 ? Math.round((a.TotalSecondsOnCall || 0) / inbound) : 0;

            const statusClass = getAvailabilityClass(a.CallTransferStatusDesc);

            body.innerHTML += `
                <tr>
                    <td>${safe(a.FullName)}</td>
                    <td>${safe(a.TeamName)}</td>
                    <td>${safe(a.PhoneExt)}</td>
                    <td class="availability-cell ${statusClass}">${safe(a.CallTransferStatusDesc)}</td>
                    <td class="numeric">${inbound}</td>
                    <td class="numeric">${safe(a.TotalCallsMissed, 0)}</td>
                    <td class="numeric">${safe(a.ThirdPartyTransferCount, 0)}</td>
                    <td class="numeric">${safe(a.DialoutCount, 0)}</td>
                    <td class="numeric">${formatTime(avgHandleSeconds)}</td>
                    <td>${formatDate(a.StartDateUtc)}</td>
                </tr>
            `;
        });

    } catch (e) {
        console.error("Agent Error:", e);
        body.innerHTML = `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
    }
}

// ===============================
// DARK MODE
// ===============================
function initDarkMode() {
    const btn = document.getElementById("darkModeToggle");
    if (!btn) return;

    const stored = localStorage.getItem("dashboard-dark-mode");
    if (stored === "on") {
        document.body.classList.add("dark-mode");
        btn.textContent = "Light mode";
    }

    btn.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark-mode");
        btn.textContent = isDark ? "Light mode" : "Dark mode";
        localStorage.setItem("dashboard-dark-mode", isDark ? "on" : "off");
    });
}

// ===============================
// INIT
// ===============================
function refreshAll() {
    loadQueueStatus();
    loadAgentStatus();
    loadGlobalStats();
}

document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();
    refreshAll();
    setInterval(refreshAll, 10000);
});
