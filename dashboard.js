const API_BASE = "https://visionbank-tle1.onrender.com";   // ← your proxy backend

// Load everything when page loads
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();

    // Auto-refresh every 10 seconds
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});


// ------------------------------
// TIME FORMATTING
// ------------------------------
function formatSecondsToHHMMSS(seconds) {
    if (isNaN(seconds)) return "00:00:00";

    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");

    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utcString) {
    if (!utcString) return "";

    const date = new Date(utcString + "Z"); // ensure UTC
    return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}


// ------------------------------
// ROW COLOR LOGIC
// ------------------------------
function getAgentRowClass(status) {
    const s = status.toLowerCase();

    if (s.includes("available")) return "agent-available";        // green
    if (s.includes("on call")) return "agent-oncall";             // yellow
    if (s.includes("wrap")) return "agent-wrapup";                // purple
    if (s.includes("break")) return "agent-break";                // red
    if (s.includes("busy")) return "agent-busy";                  // orange

    return "";
}


// ------------------------------
// LOAD QUEUE STATUS
// ------------------------------
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || data.QueueStatus.length === 0) {
            container.innerHTML = `<div class='error'>No queue data available</div>`;
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table>
                <tr>
                    <th>Queue</th>
                    <th>Calls</th>
                    <th>Agents</th>
                    <th>Wait</th>
                </tr>
                <tr>
                    <td>${q.QueueName}</td>
                    <td>${q.TotalCalls}</td>
                    <td>${q.TotalLoggedAgents}</td>
                    <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                </tr>
            </table>
        `;

    } catch (err) {
        container.innerHTML = `<div class='error'>Error loading queue status</div>`;
        console.error("Queue Error:", err);
    }
}


// ------------------------------
// LOAD AGENT STATUS
// ------------------------------
async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data.AgentStatus) {
            container.innerHTML = `<div class='error'>No agent data</div>`;
            return;
        }

        const agents = data.AgentStatus;

        // Summary counts
        let available = 0, busy = 0, breakCnt = 0, wrap = 0, onCall = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc.toLowerCase();

            if (s.includes("available")) available++;
            else if (s.includes("on call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else if (s.includes("busy")) busy++;
        });

        const summaryText = `
            ${agents.length} agents signed on,
            ${available} available,
            ${onCall} on call,
            ${wrap} on wrap-up,
            ${breakCnt} on break,
            ${busy} in other statuses
        `;

        summary.innerText = summaryText;


        // BUILD TABLE
        let html = `
            <table>
                <tr>
                    <th>Agent</th>
                    <th>Team</th>
                    <th>Phone No.</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>An.</th>
                    <th>Miss.</th>
                    <th>Trans.</th>
                    <th>Out. Calls</th>
                    <th>Log. On</th>
                    <th>Not Ready</th>
                    <th>Avail.</th>
                    <th>On Inc. Calls</th>
                    <th>On Out. Calls</th>
                    <th>Wrap-up</th>
                    <th>Break</th>
                    <th>Other</th>
                    <th>Start Date</th>
                </tr>
        `;

        agents.forEach(a => {
            const rowClass = getAgentRowClass(a.CallTransferStatusDesc);

            html += `
                <tr class="${rowClass}">
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt || ""}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${formatSecondsToHHMMSS(a.SecondsInCurrentStatus)}</td>
                    <td>${a.TotalCallsAnswered}</td>
                    <td>${a.TotalCallsMissed}</td>
                    <td>${a.TotalCallsTransferred}</td>
                    <td>${a.TotalOutboundCalls}</td>
                    <td>${formatSecondsToHHMMSS(a.LogonInterval)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsNotSet)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsAvailable)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsDialingOut)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsWrappingUp)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnBreak)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnACW)}</td>
                    <td>${convertUTCToCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += "</table>";

        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<div class='error'>Error loading agent status</div>`;
        console.error("Agent Error:", err);
    }
}
