/*****************************************************
 * CONFIG
 *****************************************************/
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime";
const TOKEN = "VWGKXWSqGA4FwIRXb2clx5H1dS3cYpplXa5il3bE4Xg=";

/*****************************************************
 * HELPERS
 *****************************************************/
function formatSecondsToHHMMSS(seconds) {
    if (!Number.isFinite(seconds)) return "--:--:--";
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function safe(v) {
    return v === undefined || v === null ? "--" : v;
}

/*****************************************************
 * LOAD QUEUE STATUS
 *****************************************************/
async function loadQueueStatus() {
    const tbody = document.getElementById("queue-body");

    try {
        const res = await fetch(`${API_BASE}/queues`, {
            headers: { token: TOKEN }
        });

        const json = await res.json();

        if (!json || !json.QueueStatus || json.QueueStatus.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
            return;
        }

        const q = json.QueueStatus[0];

        tbody.innerHTML = `
            <tr>
                <td>${safe(q.QueueName)}</td>
                <td>${safe(q.TotalCalls)}</td>
                <td>${safe(q.TotalLoggedAgents)}</td>
                <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
            </tr>
        `;
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
    }
}

/*****************************************************
 * LOAD GLOBAL REALTIME STATISTICS
 *****************************************************/
async function loadGlobalStats() {
    const ids = {
        totalQueued: "stat-total-queued",
        totalTransferred: "stat-total-transferred",
        totalAbandoned: "stat-total-abandoned",
        maxWait: "stat-max-wait",
        serviceLevel: "stat-service-level",
        totalReceived: "stat-total-received",
        answerRate: "stat-answer-rate",
        abandonRate: "stat-abandon-rate",
        callbacksRegistered: "stat-callbacks-registered",
        callbacksWaiting: "stat-callbacks-waiting"
    };

    try {
        const res = await fetch(`${API_BASE}/statistics/global`, {
            headers: { token: TOKEN }
        });

        const json = await res.json();
        const g = json.GlobalStatistics?.[0];

        if (!g) throw new Error("No stats");

        document.getElementById(ids.totalQueued).textContent = safe(g.TotalCallsQueued);
        document.getElementById(ids.totalTransferred).textContent = safe(g.TotalCallsTransferred);
        document.getElementById(ids.totalAbandoned).textContent = safe(g.TotalCallsAbandoned);
        document.getElementById(ids.maxWait).textContent = formatSecondsToHHMMSS(g.MaxQueueWaitingTime);
        document.getElementById(ids.serviceLevel).textContent = safe(g.ServiceLevel.toFixed(1)) + "%";
        document.getElementById(ids.totalReceived).textContent = safe(g.TotalCallsReceived);
        document.getElementById(ids.answerRate).textContent = safe(g.AnswerRate.toFixed(1)) + "%";
        document.getElementById(ids.abandonRate).textContent = safe(g.AbandonRate.toFixed(1)) + "%";
        document.getElementById(ids.callbacksRegistered).textContent = safe(g.CallbacksRegistered);
        document.getElementById(ids.callbacksWaiting).textContent = safe(g.CallbacksWaiting);

    } catch (e) {
        console.error("Global stats error", e);
    }
}

/*****************************************************
 * LOAD AGENT STATUS
 *****************************************************/
async function loadAgentStatus() {
    const tbody = document.getElementById("agent-body");

    try {
        const res = await fetch(`${API_BASE}/agents`, {
            headers: { token: TOKEN }
        });

        const json = await res.json();

        if (!json || !json.AgentStatus) {
            tbody.innerHTML = `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
            return;
        }

        let rows = "";

        json.AgentStatus.forEach(a => {
            const inbound = a.TotalCallsReceived || 0;
            const outbound = a.DialoutCount || 0;
            const avgHandle = inbound > 0 
                ? formatSecondsToHHMMSS(Math.round((a.TotalSecondsOnCall || 0) / inbound))
                : "--";

            rows += `
                <tr>
                    <td>${safe(a.FullName)}</td>
                    <td>${safe(a.TeamName)}</td>
                    <td>${safe(a.PhoneExt)}</td>
                    <td>${safe(a.CallTransferStatusDesc)}</td>
                    <td>${inbound}</td>
                    <td>${safe(a.MissedCallCount || 0)}</td>
                    <td>${safe(a.TransferredCallCount || 0)}</td>
                    <td>${outbound}</td>
                    <td>${avgHandle}</td>
                    <td>${safe(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = rows;

    } catch (e) {
        console.error("Agent error", e);
        tbody.innerHTML = `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
    }
}

/*****************************************************
 * INIT + AUTO REFRESH
 *****************************************************/
function init() {
    loadQueueStatus();
    loadGlobalStats();
    loadAgentStatus();

    setInterval(() => {
        loadQueueStatus();
        loadGlobalStats();
        loadAgentStatus();
    }, 10000);
}

document.addEventListener("DOMContentLoaded", init);
