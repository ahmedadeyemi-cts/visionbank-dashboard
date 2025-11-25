// ===============================
// DASHBOARD.JS – FIXED + COMPLETE
// ===============================

const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3";

// -------------------------------
// LOAD QUEUE STATUS
// -------------------------------
async function loadQueueStatus() {
    try {
        const res = await fetch(`${API_BASE}/queue/status`);
        const data = await res.json();

        const tbody = document.getElementById("queue-body");
        tbody.innerHTML = "";

        if (!data || !data.QueueStatus) {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
            return;
        }

        const q = data.QueueStatus[0];

        tbody.innerHTML = `
            <tr>
                <td>${q.QueueName || "--"}</td>
                <td>${q.Calls || "--"}</td>
                <td>${q.Agents || "--"}</td>
                <td>${formatSeconds(q.WaitTime)}</td>
            </tr>
        `;
    } catch (err) {
        document.getElementById("queue-body").innerHTML =
            `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
    }
}

// -------------------------------
// LOAD AGENT STATUS
// -------------------------------
async function loadAgentStatus() {
    try {
        const res = await fetch(`${API_BASE}/agent/status`);
        const data = await res.json();

        const tbody = document.getElementById("agent-body");
        tbody.innerHTML = "";

        if (!data || !data.AgentStatus) {
            tbody.innerHTML = `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
            return;
        }

        data.AgentStatus.forEach(a => {
            tbody.innerHTML += `
                <tr>
                    <td>${a.EmployeeName || "--"}</td>
                    <td>${a.Team || "--"}</td>
                    <td>${a.PhoneNumber || "--"}</td>
                    <td class="avail-${a.Availability?.toLowerCase() || 'unknown'}">${a.Availability || "--"}</td>
                    <td>${a.Inbound || "--"}</td>
                    <td>${a.Missed || "--"}</td>
                    <td>${a.Transferred || "--"}</td>
                    <td>${a.Outbound || "--"}</td>
                    <td>${formatSeconds(a.AverageHandleTime)}</td>
                    <td>${formatDate(a.StartDate)}</td>
                </tr>
            `;
        });

    } catch (err) {
        document.getElementById("agent-body").innerHTML =
            `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
    }
}

// -------------------------------
// LOAD REALTIME GLOBAL STATISTICS
// -------------------------------
async function loadRealtimeGlobalStats() {
    try {
        const res = await fetch(`${API_BASE}/realtime/statistics/global`);
        const json = await res.json();

        if (!json || !json.GlobalStatistics || json.GlobalStatistics.length === 0) {
            return setGlobalStatsUnavailable();
        }

        const g = json.GlobalStatistics[0];

        setVal("gs-total-queued", g.TotalCallsQueued);
        setVal("gs-total-transferred", g.TotalCallsTransferred);
        setVal("gs-total-abandoned", g.TotalCallsAbandoned);
        setVal("gs-max-wait", formatSeconds(g.MaxQueueWaitingTime));
        setVal("gs-service-level", formatPercent(g.ServiceLevel));
        setVal("gs-total-received", g.TotalCallsReceived);
        setVal("gs-answer-rate", formatPercent(g.AnswerRate));
        setVal("gs-abandon-rate", formatPercent(g.AbandonRate));
        setVal("gs-callbacks-registered", g.CallbacksRegistered);
        setVal("gs-callbacks-waiting", g.CallbacksWaiting);

    } catch (e) {
        console.log("GLOBAL ERROR:", e);
        setGlobalStatsUnavailable();
    }
}

// Helper to set values
function setVal(id, val) {
    document.getElementById(id).innerText = val ?? "--";
}

function setGlobalStatsUnavailable() {
    const ids = [
        "gs-total-queued", "gs-total-transferred", "gs-total-abandoned",
        "gs-max-wait", "gs-service-level", "gs-total-received",
        "gs-answer-rate", "gs-abandon-rate",
        "gs-callbacks-registered", "gs-callbacks-waiting"
    ];
    ids.forEach(i => setVal(i, "--"));
}

// -------------------------------
// FORMATTING HELPERS
// -------------------------------
function formatSeconds(sec) {
    if (!sec && sec !== 0) return "--";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function formatPercent(num) {
    return num || num === 0 ? `${num.toFixed(1)}%` : "--%";
}

function formatDate(dt) {
    if (!dt) return "--";
    return new Date(dt).toLocaleString();
}

// -------------------------------
// INITIAL LOAD + POLLING
// -------------------------------
loadQueueStatus();
loadAgentStatus();
loadRealtimeGlobalStats();

setInterval(() => {
    loadQueueStatus();
    loadAgentStatus();
    loadRealtimeGlobalStats();
}, 10000);
