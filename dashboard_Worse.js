// DIRECT API ENDPOINTS
const API_QUEUE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/queues";
const API_AGENTS = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/agents";
const API_GLOBAL = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/statistics/global";

// TOKEN REQUIRED BY MCC (same one used in Postman)
const TOKEN =
  "VWGKXWSqGA4FwIRXb2clx5H1dS3cYpplXa5iI3bE4Xg=";

// Helper
function formatSecondsToHHMMSS(sec) {
    if (!sec || sec < 0) return "00:00:00";
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

/* ---------------------------------------------------
   LOAD QUEUE STATUS
----------------------------------------------------*/
async function loadQueueStatus() {
    const box = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(API_QUEUE, {
            headers: { token: TOKEN }
        });

        const data = await res.json();

        if (!data?.QueueStatus?.length) {
            box.innerHTML = `<div class="error">Unable to load queue status.</div>`;
            return;
        }

        const q = data.QueueStatus[0];

        box.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Queue</th><th>Calls</th><th>Agents</th><th>Wait</th>
                    </tr>
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

    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="error">Error loading queue status.</div>`;
    }
}

/* ---------------------------------------------------
   LOAD GLOBAL STATISTICS
----------------------------------------------------*/
async function loadGlobalStats() {
    const errBox = document.getElementById("globalStatsError");

    try {
        const res = await fetch(API_GLOBAL, {
            headers: { token: TOKEN }
        });

        const data = await res.json();

        if (!data?.GlobalStatistics?.length) {
            errBox.textContent = "Unable to load global statistics.";
            return;
        }

        errBox.textContent = "";
        const g = data.GlobalStatistics[0];

        document.getElementById("gs-total-queued").textContent = g.TotalCallsQueued;
        document.getElementById("gs-transferred").textContent = g.TotalCallsTransferred;
        document.getElementById("gs-abandoned").textContent = g.TotalCallsAbandoned;
        document.getElementById("gs-max-wait").textContent =
            formatSecondsToHHMMSS(g.MaxQueueWaitingTime);

        document.getElementById("gs-service-level").textContent =
            g.ServiceLevel.toFixed(1) + "%";

        document.getElementById("gs-calls-received").textContent = g.TotalCallsReceived;
        document.getElementById("gs-answer-rate").textContent =
            g.AnswerRate.toFixed(1) + "%";
        document.getElementById("gs-abandon-rate").textContent =
            g.AbandonRate.toFixed(1) + "%";

        document.getElementById("gs-callbacks-reg").textContent =
            g.CallbacksRegistered;
        document.getElementById("gs-callbacks-waiting").textContent =
            g.CallbacksWaiting;

    } catch (e) {
        console.error("Global Stats Error", e);
        errBox.textContent = "Unable to load global statistics.";
    }
}

/* ---------------------------------------------------
   LOAD AGENT STATUS
----------------------------------------------------*/
async function loadAgentStatus() {
    const box = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(API_AGENTS, {
            headers: { token: TOKEN }
        });

        const data = await res.json();

        if (!data?.AgentStatus?.length) {
            box.innerHTML = `<div class="error">Unable to load agent data.</div>`;
            summary.textContent = "";
            return;
        }

        const agents = data.AgentStatus;

        let available = 0, onCall = 0, wrap = 0, onBreak = 0, other = 0;
        agents.forEach(a => {
            const s = (a.CallTransferStatusDesc || "").toLowerCase();
            if (s.includes("available")) available++;
            else if (s.includes("call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) onBreak++;
            else other++;
        });

        summary.textContent =
            `${agents.length} agents signed on, ${available} available, `
            + `${onCall} on call, ${wrap} on wrap-up, ${onBreak} on break, ${other} other`;

        let rows = "";
        agents.forEach(a => {
            rows += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived || 0}</td>
                    <td>${formatSecondsToHHMMSS(a.AverageHandleTimeSeconds)}</td>
                    <td>${a.DialoutCount || 0}</td>
                    <td>${a.StartDateUtc}</td>
                </tr>
            `;
        });

        box.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Employee</th><th>Team</th><th>Phone No.</th>
                        <th>Availability</th><th>Inbound</th>
                        <th>Avg Handle</th><th>Outbound</th><th>Start Date</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="error">Unable to load agent data.</div>`;
    }
}

/* ---------------------------------------------------
   INIT REFRESH LOOP
----------------------------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadGlobalStats();
    loadAgentStatus();

    setInterval(() => {
        loadQueueStatus();
        loadGlobalStats();
        loadAgentStatus();
    }, 7000);
});
