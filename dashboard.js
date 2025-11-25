// BASE URL
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3/realtime";


// ===============================
// LOAD QUEUE STATUS
// ===============================
async function loadQueueStatus() {
    try {
        const response = await fetch(`${API_BASE}/status/queues`);
        const data = await response.json();

        const body = document.getElementById("queue-body");
        body.innerHTML = "";

        if (!data || !data.QueueStatus || data.QueueStatus.length === 0) {
            body.innerHTML = `<tr><td colspan="4" class="error">Unable to load queue status.</td></tr>`;
            return;
        }

        const q = data.QueueStatus[0];

        body.innerHTML = `
            <tr>
                <td>${q.QueueName}</td>
                <td>${q.TotalCalls}</td>
                <td>${q.TotalLoggedAgents}</td>
                <td>${formatTime(q.AvgWaitInterval)}</td>
            </tr>
        `;

    } catch (err) {
        console.error("Queue load error:", err);
        document.getElementById("queue-body").innerHTML =
            `<tr><td colspan="4" class="error">Unable to load queue status.</td></tr>`;
    }
}



// ===============================
// LOAD GLOBAL STATS
// ===============================
async function loadGlobalStats() {
    try {
        const response = await fetch(`${API_BASE}/statistics/global`);
        const data = await response.json();

        if (!data || !data.GlobalStatistics || data.GlobalStatistics.length === 0) {
            document.getElementById("global-error").textContent = "Unable to load global statistics.";
            return;
        }

        const g = data.GlobalStatistics[0];

        set("gs-total-queued", g.TotalCallsQueued);
        set("gs-total-transferred", g.TotalCallsTransferred);
        set("gs-total-abandoned", g.TotalCallsAbandoned);
        set("gs-max-wait", g.MaxQueueWaitingTime);

        set("gs-service-level", g.ServiceLevel.toFixed(2) + "%");
        set("gs-total-received", g.TotalCallsReceived);

        set("gs-answer-rate", g.AnswerRate.toFixed(2) + "%");
        set("gs-abandon-rate", g.AbandonRate.toFixed(2) + "%");

        set("gs-callbacks-registered", g.CallbacksRegistered);
        set("gs-callbacks-waiting", g.CallbacksWaiting);

        document.getElementById("global-error").textContent = "";

    } catch (err) {
        console.error("Global stats error:", err);
        document.getElementById("global-error").textContent = "Unable to load global statistics.";
    }
}

function set(id, value) {
    document.getElementById(id).textContent = value ?? "--";
}



// ===============================
// LOAD AGENT STATUS
// ===============================
async function loadAgentStatus() {
    try {
        const response = await fetch(`${API_BASE}/status/agents`);
        const data = await response.json();

        const body = document.getElementById("agent-body");
        body.innerHTML = "";

        if (!data || !data.AgentStatus || data.AgentStatus.length === 0) {
            body.innerHTML = `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
            return;
        }

        data.AgentStatus.forEach(a => {
            body.innerHTML += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived}</td>
                    <td>${a.TotalCallsMissed}</td>
                    <td>${a.ThirdPartyTransferCount}</td>
                    <td>${a.DialoutCount}</td>
                    <td>${formatTime(a.TotalSecondsOnCall)}</td>
                    <td>${formatDate(a.StartDateUtc)}</td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Agent load error:", err);
        document.getElementById("agent-body").innerHTML =
            `<tr><td colspan="10" class="error">Unable to load agent data.</td></tr>`;
    }
}



// ===============================
// HELPERS
// ===============================
function formatTime(sec) {
    if (!sec) return "--";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h}:${m}:${s}`;
}

function formatDate(utc) {
    if (!utc) return "--";
    return new Date(utc + "Z").toLocaleString("en-US", { timeZone: "America/Chicago" });
}



// ===============================
// AUTO REFRESH
// ===============================
loadQueueStatus();
loadGlobalStats();
loadAgentStatus();

setInterval(() => {
    loadQueueStatus();
    loadGlobalStats();
    loadAgentStatus();
}, 10000);
