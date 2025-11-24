const API_BASE = "https://visionbank-tle1.onrender.com";

// Format seconds → HH:MM:SS
function formatSeconds(sec) {
    if (!sec || isNaN(sec)) return "00:00:00";
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function toCentral(utc) {
    if (!utc) return "";
    return new Date(utc).toLocaleString("en-US", { timeZone: "America/Chicago" });
}

// Row color logic
function getRowClass(status) {
    if (!status) return "";
    const s = status.toLowerCase();
    if (s.includes("available")) return "agent-available";
    if (s.includes("on call")) return "agent-oncall";
    if (s.includes("wrap")) return "agent-wrapup";
    if (s.includes("break")) return "agent-break";
    if (s.includes("busy")) return "agent-busy";
    return "";
}

// Load Queue
async function loadQueueStatus() {
    const div = document.getElementById("queueStatusContent");
    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        const q = data.QueueStatus?.[0];
        if (!q) {
            div.innerHTML = "<div class='error'>No queue data</div>";
            return;
        }

        div.innerHTML = `
            <table>
                <tr>
                    <th>Queue</th>
                    <th>Calls</th>
                    <th>Agents</th>
                    <th>Wait</th>
                </tr>
                <tr>
                    <td>${q.QueueName}</td>
                    <td>${q.TotalCalls || 0}</td>
                    <td>${q.TotalLoggedAgents || 0}</td>
                    <td>${formatSeconds(q.AvgWaitInterval)}</td>
                </tr>
            </table>
        `;
    } catch (e) {
        div.innerHTML = "<div class='error'>Error loading queue data</div>";
    }
}

// Load Agent Performance
async function loadAgentStatus() {
    const div = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        const agents = data.AgentStatus || [];

        // Summary Computation
        const available = agents.filter(a => a.CallTransferStatusDesc.includes("Available")).length;
        const onCall = agents.filter(a => a.CallTransferStatusDesc.includes("On Call")).length;
        const wrap = agents.filter(a => a.CallTransferStatusDesc.includes("Wrap")).length;
        const onBreak = agents.filter(a => a.CallTransferStatusDesc.includes("Break")).length;
        const busy = agents.length - available - onCall - wrap - onBreak;

        summary.innerHTML = `
            ${agents.length} agents signed on,
            ${available} available,
            ${onCall} on call,
            ${wrap} on wrap-up,
            ${onBreak} on break,
            ${busy} in other statuses
        `;

        // Build Table
        let html = `
            <table>
                <tr>
                    <th>Agent</th>
                    <th>Team</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>An.</th>
                    <th>Miss.</th>
                    <th>Trans.</th>
                    <th>Out</th>
                    <th>Log On</th>
                    <th>Not Ready</th>
                    <th>Avail</th>
                    <th>On Call</th>
                    <th>Dial Out</th>
                    <th>Wrap</th>
                    <th>Break</th>
                    <th>ACW</th>
                    <th>Start</th>
                </tr>
        `;

        agents.forEach(a => {
            html += `
                <tr class="${getRowClass(a.CallTransferStatusDesc)}">
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt || ""}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${formatSeconds(a.SecondsInCurrentStatus)}</td>
                    <td>${a.TotalCallsAnswered}</td>
                    <td>${a.TotalCallsMissed}</td>
                    <td>${a.TotalCallsTransferred}</td>
                    <td>${a.TotalOutboundCalls}</td>
                    <td>${formatSeconds(a.LogonInterval)}</td>
                    <td>${formatSeconds(a.TotalSecondsNotSet)}</td>
                    <td>${formatSeconds(a.TotalSecondsAvailable)}</td>
                    <td>${formatSeconds(a.TotalSecondsOnCall)}</td>
                    <td>${formatSeconds(a.TotalSecondsDialingOut)}</td>
                    <td>${formatSeconds(a.TotalSecondsWrappingUp)}</td>
                    <td>${formatSeconds(a.TotalSecondsOnBreak)}</td>
                    <td>${formatSeconds(a.TotalSecondsOnACW)}</td>
                    <td>${toCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += "</table>";
        div.innerHTML = html;

    } catch (e) {
        div.innerHTML = "<div class='error'>Error loading agent status</div>";
    }
}

// Auto Refresh
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});
