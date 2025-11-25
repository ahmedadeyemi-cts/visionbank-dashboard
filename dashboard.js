const API_BASE = "https://pop1-apps.mycontactcenter.net/api";

// GLOBAL TOKEN FOR ALL REQUESTS
const TOKEN = "VVGKXWSqGA4FwlRXb2clx5H1dS3cYpplXa5iI3bE4Xg=";

function apiFetch(endpoint) {
    return fetch(`${API_BASE}${endpoint}`, {
        headers: {
            "token": TOKEN
        }
    }).then(res => res.json());
}

function formatSecondsToHHMMSS(sec) {
    sec = Number(sec) || 0;
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/* -------------------- QUEUE STATUS -------------------- */

async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const data = await apiFetch("/v3/realtime/status/queues");

        if (!data || !data.QueueStatus || data.QueueStatus.length === 0) {
            container.innerHTML = `<div class='error'>Error loading queue status.</div>`;
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table>
                <thead>
                    <tr><th>Queue</th><th>Calls</th><th>Agents</th><th>Wait</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${q.QueueName}</td>
                        <td>${q.TotalCalls}</td>
                        <td>${q.TotalLoggedAgents}</td>
                        <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="error">Error loading queue status.</div>`;
    }
}

/* -------------------- GLOBAL STATISTICS -------------------- */

async function loadGlobalStats() {
    const errorBox = document.getElementById("globalStatsError");

    try {
        const data = await apiFetch("/v3/realtime/statistics/global");

        if (!data || !data.GlobalStatistics || data.GlobalStatistics.length === 0) {
            errorBox.textContent = "Unable to load global statistics.";
            return;
        }

        errorBox.textContent = "";

        const g = data.GlobalStatistics[0];

        document.getElementById("stat_totalQueued").textContent = g.TotalCallsQueued;
        document.getElementById("stat_transferred").textContent = g.TotalCallsTransferred;
        document.getElementById("stat_abandoned").textContent = g.TotalCallsAbandoned;
        document.getElementById("stat_maxWait").textContent = formatSecondsToHHMMSS(g.MaxQueueWaitingTime);
        document.getElementById("stat_serviceLevel").textContent = g.ServiceLevel.toFixed(1) + "%";
        document.getElementById("stat_totalReceived").textContent = g.TotalCallsReceived;
        document.getElementById("stat_answerRate").textContent = g.AnswerRate.toFixed(1) + "%";
        document.getElementById("stat_abandonRate").textContent = g.AbandonRate.toFixed(1) + "%";
        document.getElementById("stat_callbacksRegistered").textContent = g.CallbacksRegistered;
        document.getElementById("stat_callbacksWaiting").textContent = g.CallbacksWaiting;

    } catch (err) {
        console.error(err);
        errorBox.textContent = "Unable to load global statistics.";
    }
}

/* -------------------- AGENT STATUS -------------------- */

async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const errorBox = document.getElementById("agentError");

    try {
        const data = await apiFetch("/v3/realtime/status/agents");

        if (!data || !data.AgentStatus || data.AgentStatus.length === 0) {
            errorBox.textContent = "Unable to load agent data.";
            return;
        }

        errorBox.textContent = "";

        let rows = "";
        data.AgentStatus.forEach(a => {
            rows += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${a.DialoutCount}</td>
                    <td>${a.StartDateUtc}</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Status</th>
                        <th>Inbound</th>
                        <th>Avg Handle</th>
                        <th>Outbound</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    } catch (err) {
        console.error(err);
        errorBox.textContent = "Unable to load agent data.";
    }
}

/* -------------------- INIT -------------------- */

document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadGlobalStats();
    loadAgentStatus();

    setInterval(() => {
        loadQueueStatus();
        loadGlobalStats();
        loadAgentStatus();
    }, 10000);
});
