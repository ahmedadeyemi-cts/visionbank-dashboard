// ===============================
// DASHBOARD.JS – FIXED VERSION
// ===============================

// Base URL for the vendor realtime APIs
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime";

// Your bearer-style token header (same as Postman)
const TOKEN = "VWGKXWSqGA4FwlRXb2clx5H1dS3cYppIXa5il3bE4Xg=";

const AUTH_HEADERS = {
    "token": TOKEN
};

// -------------------------------
// Utility helpers
// -------------------------------

function formatSecondsToHHMMSS(seconds) {
    const sec = Number.isFinite(seconds) ? seconds : 0;
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function formatDate(dateStr) {
    if (!dateStr) return "--";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "--";
    return d.toLocaleString();
}

// Normalise availability text to three buckets
function getAvailabilityText(status) {
    if (!status) return "Other";
    const s = status.toLowerCase();
    if (s.includes("available")) return "Available";
    if (s.includes("not") || s.includes("busy") || s.includes("away")) return "Not Available";
    return "Other";
}

// Safe text
function safe(value, fallback = "--") {
    return value === undefined || value === null || value === "" ? fallback : value;
}

// ===============================
// QUEUE STATUS  (/status/queues)
// ===============================

async function loadQueueStatus() {
    const tbody = document.getElementById("queue-body");
    const errorEl = document.getElementById("queue-error");

    if (!tbody) return;

    // reset
    tbody.innerHTML = "";
    if (errorEl) errorEl.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/status/queues`, {
            headers: AUTH_HEADERS
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        // API shape is usually { "QueueStatus": [ ... ] }
        const queues = Array.isArray(json)
            ? json
            : (json.QueueStatus || json.Queues || []);

        if (!queues || !queues.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">No queue data available.</td></tr>`;
            return;
        }

        // For now we only show the first queue, like "Voice Queue"
        const q = queues[0];

        const queueName =
            q.QueueName || q.Queue || q.Name || "Queue";

        const totalCalls =
            q.TotalCalls ?? q.WaitCount ?? q.Calls ?? 0;

        const totalAgents =
            q.TotalLoggedAgents ?? q.AgentCount ?? q.Agents ?? 0;

        const waitSeconds =
            q.AvgQueueWaitingTime ??
            q.AvgWaitInterval ??
            q.AverageWaitTime ??
            q.WaitTime ??
            0;

        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${safe(queueName)}</td>
            <td>${safe(totalCalls, 0)}</td>
            <td>${safe(totalAgents, 0)}</td>
            <td>${formatSecondsToHHMMSS(waitSeconds)}</td>
        `;
        tbody.appendChild(row);
    } catch (err) {
        console.error("Queue error:", err);
        if (tbody.innerHTML.trim() === "") {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
        }
        if (errorEl) {
            errorEl.textContent = "Error loading queue status.";
        }
    }
}

// =====================================
// REALTIME GLOBAL STATISTICS
// (/statistics/global)
// =====================================

async function loadGlobalStatistics() {
    const errorEl = document.getElementById("global-error");

    // Card value elements
    const elTotalQueued        = document.getElementById("global-total-queued");
    const elTotalTransferred   = document.getElementById("global-total-transferred");
    const elTotalAbandoned     = document.getElementById("global-total-abandoned");
    const elMaxWait            = document.getElementById("global-max-wait");
    const elServiceLevel       = document.getElementById("global-service-level");
    const elTotalReceived      = document.getElementById("global-total-received");
    const elAnswerRate         = document.getElementById("global-answer-rate");
    const elAbandonRate        = document.getElementById("global-abandon-rate");
    const elCallbacksRegistered= document.getElementById("global-callbacks-registered");
    const elCallbacksWaiting   = document.getElementById("global-callbacks-waiting");

    try {
        if (errorEl) errorEl.textContent = "";

        const res = await fetch(`${API_BASE}/statistics/global`, {
            headers: AUTH_HEADERS
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const statsArray = json.GlobalStatistics || json.globalStatistics || [];
        const g = statsArray[0];

        if (!g) {
            if (errorEl) errorEl.textContent = "No global statistics available.";
            return;
        }

        // Map fields from your JSON sample
        if (elTotalQueued)         elTotalQueued.textContent = safe(g.TotalCallsQueued, 0);
        if (elTotalTransferred)    elTotalTransferred.textContent = safe(g.TotalCallsTransferred, 0);
        if (elTotalAbandoned)      elTotalAbandoned.textContent = safe(g.TotalCallsAbandoned, 0);
        if (elMaxWait)             elMaxWait.textContent = formatSecondsToHHMMSS(g.MaxQueueWaitingTime || 0);
        if (elServiceLevel)        elServiceLevel.textContent = `${(g.ServiceLevel ?? 0).toFixed(1)}%`;
        if (elTotalReceived)       elTotalReceived.textContent = safe(g.TotalCallsReceived, 0);
        if (elAnswerRate)          elAnswerRate.textContent = `${(g.AnswerRate ?? 0).toFixed(1)}%`;
        if (elAbandonRate)         elAbandonRate.textContent = `${(g.AbandonRate ?? 0).toFixed(1)}%`;
        if (elCallbacksRegistered) elCallbacksRegistered.textContent = safe(g.CallbacksRegistered, 0);
        if (elCallbacksWaiting)    elCallbacksWaiting.textContent = safe(g.CallbacksWaiting, 0);
    } catch (err) {
        console.error("Global statistics error:", err);
        if (errorEl) {
            errorEl.textContent = "Unable to load global statistics.";
        }
    }
}

// ===============================
// AGENT STATUS  (/status/agents)
// ===============================

async function loadAgentStatus() {
    const tbody = document.getElementById("agent-body");
    const errorEl = document.getElementById("agent-error");

    if (!tbody) return;

    tbody.innerHTML = "";
    if (errorEl) errorEl.textContent = "";

    try {
        const res = await fetch(`${API_BASE}/status/agents`, {
            headers: AUTH_HEADERS
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();
        const agents = json.AgentStatus || json.Agents || [];

        if (!agents || !agents.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="error-cell">No agent data available.</td></tr>`;
            return;
        }

        agents.forEach(a => {
            const tr = document.createElement("tr");

            const availabilityText = getAvailabilityText(a.CallTransferStatusDesc);

            let availabilityClass = "avail-other";
            if (availabilityText === "Available")       availabilityClass = "avail-available";
            else if (availabilityText === "Not Available") availabilityClass = "avail-not-available";

            const inboundCalls  = a.TotalCallsReceived ?? 0;
            const missedCalls   = a.TotalCallsMissed ?? 0;
            const transferred   = a.ThirdPartyTransferCount ?? 0;
            const outboundCalls = a.DialoutCount ?? 0;
            const onCallSeconds = a.TotalSecondsOnCall ?? 0;

            tr.innerHTML = `
                <td>${safe(a.FullName)}</td>
                <td>${safe(a.TeamName)}</td>
                <td>${safe(a.PhoneExt)}</td>
                <td class="${availabilityClass}">${availabilityText}</td>
                <td>${inboundCalls}</td>
                <td>${missedCalls}</td>
                <td>${transferred}</td>
                <td>${outboundCalls}</td>
                <td>${formatSecondsToHHMMSS(onCallSeconds)}</td>
                <td>${formatDate(a.StartDateUtc)}</td>
            `;

            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Agent error:", err);
        if (tbody.innerHTML.trim() === "") {
            tbody.innerHTML = `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
        }
        if (errorEl) {
            errorEl.textContent = "Unable to load agent data.";
        }
    }
}

// ===============================
// INITIAL LOAD & POLLING
// ===============================

function refreshAll() {
    loadQueueStatus();
    loadGlobalStatistics();
    loadAgentStatus();

    // optional: update "last updated" text if you have an element with this id
    const tsEl = document.getElementById("last-updated");
    if (tsEl) {
        const now = new Date();
        tsEl.textContent = now.toLocaleTimeString("en-US");
    }
}

// Run once on page load
document.addEventListener("DOMContentLoaded", () => {
    refreshAll();
    // Refresh every 10 seconds
    setInterval(refreshAll, 10000);
});
