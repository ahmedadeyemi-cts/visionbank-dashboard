const API_BASE = "https://visionbank-tle1.onrender.com";

// Load everything on page load
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();

    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

// ----------------------
// Time helpers
// ----------------------
function formatSecondsToHHMMSS(seconds) {
    if (!seconds && seconds !== 0) return "00:00:00";

    seconds = Number(seconds);
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utcString) {
    if (!utcString) return "";
    const date = new Date(utcString + "Z");
    return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

// ----------------------
// Load Queue Summary
// ----------------------
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || !data.QueueStatus.length) {
            container.innerHTML = "<div class='error'>No queue data available.</div>";
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
        container.innerHTML = "<div class='error'>Error loading queue status.</div>";
        console.error(err);
    }
}

// ----------------------
// Load Agent Status
// ----------------------
async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data.AgentStatus) {
            container.innerHTML = "<div class='error'>No agent data.</div>";
            return;
        }

        const agents = data.AgentStatus;

        // Calculate summary
        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc.toLowerCase();

            if (s.includes("available")) available++;
            else if (s.includes("on call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else other++;
        });

        summary.innerHTML = `
            ${agents.length} agents signed on,<br>
            ${available} available,<br>
            ${onCall} on call,<br>
            ${wrap} on wrap-up,<br>
            ${breakCnt} on break,<br>
            ${other} in other statuses
        `;

        // Build table
        let html = `
            <table>
                <tr>
                    <th>Employee</th>
                    <th>Availability</th>
                    <th>Inbound Calls</th>
                    <th>Average Handle Time</th>
                    <th>Outbound Calls</th>
                </tr>
        `;

        agents.forEach(a => {
            html += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${a.TotalOutboundCalls}</td>
                </tr>
            `;
        });

        html += "</table>";
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = "<div class='error'>Error loading agent status.</div>";
        console.error(err);
    }
}
