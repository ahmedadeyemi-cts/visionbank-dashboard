const API_URL = "https://pop1-apps.mycontactcenter.net/api/v3";
const API_TOKEN = "VWGKXWSqGA4FwlRXb2clx5H1dS3cYppIXa5iI3bE4Xg=";

// ------------- HELPERS -------------
function formatTime(sec) {
    sec = Number(sec) || 0;
    return new Date(sec * 1000).toISOString().substr(11, 8);
}

function setLastUpdated() {
    const now = new Date();
    document.getElementById("lastUpdated").textContent =
        "Last updated: " + now.toLocaleTimeString();
}

function showSpinner(show) {
    document.getElementById("spinner").classList.toggle("hidden", !show);
}

// ------------- QUEUE STATUS -------------
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");
    container.innerHTML = "";

    try {
        const res = await fetch(`${API_URL}/queues`, {
            headers: { token: API_TOKEN }
        });
        const data = await res.json();

        if (!data.QueueStatus || data.QueueStatus.length === 0)
            throw new Error("No queue data");

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table>
                <tr><th>Queue</th><th>Calls</th><th>Agents</th><th>Wait</th></tr>
                <tr>
                    <td>${q.QueueName}</td>
                    <td>${q.TotalCalls}</td>
                    <td>${q.TotalLoggedAgents}</td>
                    <td>${formatTime(q.AvgWaitInterval)}</td>
                </tr>
            </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error">Error loading queue status.</div>`;
    }
}

// ------------- GLOBAL STATS -------------
async function loadGlobalStats() {
    const container = document.getElementById("globalStatsContent");
    container.innerHTML = "";

    try {
        const res = await fetch(`${API_URL}/realtime/statistics/global`, {
            headers: { token: API_TOKEN }
        });

        const data = await res.json();

        if (!data.GlobalStatistics)
            throw new Error("Missing GlobalStatistics");

        const g = data.GlobalStatistics[0];

        container.innerHTML =
        `
        <div class="kpi-card"><div class="badge badge-blue">${g.TotalCallsQueued}</div><div>Total Calls Queued</div></div>
        <div class="kpi-card"><div class="badge badge-blue">${g.TotalCallsTransferred}</div><div>Total Calls Transferred</div></div>
        <div class="kpi-card"><div class="badge badge-red">${g.TotalCallsAbandoned}</div><div>Total Calls Abandoned</div></div>
        <div class="kpi-card"><div class="badge badge-blue">${formatTime(g.MaxQueueWaitingTime)}</div><div>Maximum Queue Wait</div></div>

        <div class="kpi-card"><div class="badge badge-green">${g.ServiceLevel.toFixed(1)}%</div><div>Service Level</div></div>
        <div class="kpi-card"><div class="badge badge-blue">${g.TotalCallsReceived}</div><div>Total Calls Received</div></div>
        <div class="kpi-card"><div class="badge badge-green">${g.AnswerRate.toFixed(1)}%</div><div>Answer Rate</div></div>
        <div class="kpi-card"><div class="badge badge-red">${g.AbandonRate.toFixed(1)}%</div><div>Abandon Rate</div></div>

        <div class="kpi-card"><div class="badge badge-blue">${g.CallbacksRegistered}</div><div>Callbacks Registered</div></div>
        <div class="kpi-card"><div class="badge badge-blue">${g.CallbacksWaiting}</div><div>Callbacks Waiting</div></div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error">Unable to load global statistics.</div>`;
    }
}

// ------------- AGENTS -------------
async function loadAgents() {
    const container = document.getElementById("agentStatusContent");
    container.innerHTML = "";

    try {
        const res = await fetch(`${API_URL}/agents`, {
            headers: { token: API_TOKEN }
        });

        const data = await res.json();

        if (!data.AgentStatus)
            throw new Error("No agent data");

        const rows = data.AgentStatus.map(a => `
            <tr>
                <td>${a.FullName}</td>
                <td>${a.TeamName}</td>
                <td>${a.PhoneExt}</td>
                <td>${a.CallTransferStatusDesc}</td>
                <td>${a.TotalCallsReceived}</td>
                <td>${formatTime(a.TotalSecondsOnCall)}</td>
                <td>${a.DialoutCount}</td>
                <td>${a.StartDateUtc}</td>
            </tr>
        `).join("");

        container.innerHTML =
        `
        <table>
            <tr>
                <th>Name</th><th>Team</th><th>Phone</th>
                <th>Status</th><th>Inbound</th><th>Avg Handle</th>
                <th>Outbound</th><th>Start Date</th>
            </tr>
            ${rows}
        </table>
        `;
    } catch (err) {
        container.innerHTML = `<div class="error">Unable to load agent data.</div>`;
    }
}

// ------------- AUTO REFRESH -------------
async function refreshDashboard() {
    showSpinner(true);
    await Promise.all([
        loadQueueStatus(),
        loadGlobalStats(),
        loadAgents()
    ]);
    setLastUpdated();
    showSpinner(false);
}

document.addEventListener("DOMContentLoaded", () => {
    refreshDashboard();
    setInterval(refreshDashboard, 10000);
});
