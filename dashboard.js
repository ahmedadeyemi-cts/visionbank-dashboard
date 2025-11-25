// ===============================
// CONFIG
// ===============================

// Base for all realtime endpoints
//   /status/queues
//   /status/agents
//   /statistics/global
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime";

// Static token header (same as Postman)
const API_TOKEN = "VWGKXWSqGA4FwlRXb2cIx5H1dS3cYpplXa5iI3bE4Xg=";

// Helper wrapper so all fetches share headers
function apiFetch(path) {
    return fetch(`${API_BASE}${path}`, {
        headers: {
            token: API_TOKEN
        }
    });
}

// ===============================
// HELPERS
// ===============================
function formatTime(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return "--";
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function formatDate(utc) {
    if (!utc) return "--";
    // Ensure we treat it as UTC
    const d = new Date(utc.endsWith("Z") ? utc : utc + "Z");
    return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function formatPercent(v) {
    if (v === null || v === undefined || isNaN(v)) return "--%";
    return v.toFixed(1) + "%";
}

function safe(v, fallback = "--") {
    return v === null || v === undefined || v === "" ? fallback : v;
}

function availabilityClass(statusText) {
    const s = (statusText || "").toLowerCase();
    if (s.includes("accept") || s.includes("available")) return "avail-available";
    if (s.includes("not ready") || s.includes("wrap") || s.includes("break") || s.includes("away"))
        return "avail-not-available";
    return "avail-other";
}

// ===============================
// CURRENT QUEUE STATUS
// ===============================
async function loadQueueStatus() {
    const body = document.getElementById("queue-body");

    try {
        const res = await apiFetch("/status/queues");
        const data = await res.json();

        body.innerHTML = "";

        if (!data || !Array.isArray(data.QueueStatus) || data.QueueStatus.length === 0) {
            body.innerHTML =
                `<tr><td colspan="4" class="error">Unable to load queue status.</td></tr>`;
            return;
        }

        const q = data.QueueStatus[0]; // Only one queue used

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${safe(q.QueueName, "Voice Queue")}</td>
            <td>${safe(q.TotalCalls, 0)}</td>
            <td>${safe(q.TotalLoggedAgents, 0)}</td>
            <td>${formatTime(q.AvgWaitInterval)}</td>
        `;
        body.appendChild(row);
    } catch (err) {
        console.error("Queue load error:", err);
        body.innerHTML =
            `<tr><td colspan="4" class="error">Unable to load queue status.</td></tr>`;
    }
}

// ===============================
// AGENT PERFORMANCE
// ===============================
async function loadAgentStatus() {
    const body = document.getElementById("agent-body");

    try {
        const res = await apiFetch("/status/agents");
        const data = await res.json();

        body.innerHTML = "";

        if (!data || !Array.isArray(data.AgentStatus) || data.AgentStatus.length === 0) {
            body.innerHTML =
                `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
            return;
        }

        data.AgentStatus.forEach(a => {
            const inbound = a.TotalCallsReceived || 0;
            const totalOnCall = a.TotalSecondsOnCall || 0;
            const avgHandleSec = inbound > 0 ? Math.round(totalOnCall / inbound) : 0;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${safe(a.FullName)}</td>
                <td>${safe(a.TeamName)}</td>
                <td>${safe(a.PhoneExt)}</td>
                <td class="availability-cell ${availabilityClass(a.CallTransferStatusDesc)}">
                    ${safe(a.CallTransferStatusDesc)}
                </td>
                <td>${inbound}</td>
                <td>${a.TotalCallsMissed || 0}</td>
                <td>${a.ThirdPartyTransferCount || 0}</td>
                <td>${a.DialoutCount || 0}</td>
                <td>${formatTime(avgHandleSec)}</td>
                <td>${formatDate(a.StartDateUtc)}</td>
            `;
            body.appendChild(tr);
        });
    } catch (err) {
        console.error("Agent load error:", err);
        body.innerHTML =
            `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
    }
}

// ===============================
// REALTIME GLOBAL STATISTICS
// ===============================
async function loadGlobalStats() {
    const errorDiv = document.getElementById("global-error");

    try {
        const res = await apiFetch("/statistics/global");
        const data = await res.json();

        if (!data || !Array.isArray(data.GlobalStatistics) || data.GlobalStatistics.length === 0) {
            errorDiv.textContent = "Unable to load global statistics.";
            return;
        }

        const g = data.GlobalStatistics[0];

        // Row 1
        document.getElementById("gs-total-queued").textContent =
            safe(g.TotalCallsQueued, "--");
        document.getElementById("gs-total-transferred").textContent =
            safe(g.TotalCallsTransferred, "--");
        document.getElementById("gs-total-abandoned").textContent =
            safe(g.TotalCallsAbandoned, "--");
        document.getElementById("gs-max-wait").textContent =
            formatTime(g.MaxQueueWaitingTime);
        document.getElementById("gs-service-level").textContent =
            formatPercent(Number(g.ServiceLevel));

        // Row 2
        document.getElementById("gs-total-received").textContent =
            safe(g.TotalCallsReceived, "--");
        document.getElementById("gs-answer-rate").textContent =
            formatPercent(Number(g.AnswerRate));
        document.getElementById("gs-abandon-rate").textContent =
            formatPercent(Number(g.AbandonRate));
        document.getElementById("gs-callbacks-registered").textContent =
            safe(g.CallbacksRegistered, "--");
        document.getElementById("gs-callbacks-waiting").textContent =
            safe(g.CallbacksWaiting, "--");

        errorDiv.textContent = "";
    } catch (err) {
        console.error("Global stats error:", err);
        errorDiv.textContent = "Unable to load global statistics.";
    }
}

// ===============================
// INITIAL LOAD + AUTO REFRESH
// ===============================
function refreshAll() {
    loadQueueStatus();
    loadAgentStatus();
    loadGlobalStats();
}

document.addEventListener("DOMContentLoaded", () => {
    refreshAll();
    // Refresh every 10 seconds
    setInterval(refreshAll, 10000);
});
