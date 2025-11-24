const API_BASE = "https://visionbank-tle1.onrender.com";

// Load everything when page is ready
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
// TIME FORMATTING HELPERS
// ------------------------------
function formatSecondsToHHMMSS(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00:00";

    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");

    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utcString) {
    if (!utcString) return "--";

    const date = new Date(utcString + "Z");
    return date.toLocaleString("en-US", {
        timeZone: "America/Chicago",
    });
}

// ------------------------------
// STATUS → CSS CLASS COLORS
// ------------------------------
function getAgentStatusClass(statusText) {
    const s = (statusText || "").toLowerCase();

    // GREEN — Available
    if (s.includes("available")) return "agent-status-available";

    // YELLOW — Wrap Up
    if (s.includes("wrap")) return "agent-status-wrapup";

    // RED — Busy / On Call / Accept Internal / Callback / Connected
    if (
        s.includes("busy") ||
        s.includes("on call") ||
        s.includes("accept") ||
        s.includes("callback") ||
        s.includes("connected")
    ) {
        return "agent-status-busy";
    }

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

        if (!data.QueueStatus || !data.QueueStatus.length) {
            container.innerHTML = `<div class='error'>No queue data available</div>`;
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Queue</th>
                        <th>Calls</th>
                        <th>Agents</th>
                        <th>Wait</th>
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
    } catch (err) {
        container.innerHTML = `<div class='error'>Error loading queue status</div>`;
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

        // Summary Counts
        let available = 0,
            onCall = 0,
            wrap = 0,
            breakCnt = 0,
            busy = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc?.toLowerCase() || "";

            if (s.includes("available")) available++;
            else if (s.includes("on call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else if (s.includes("busy")) busy++;
        });

        summary.innerText = `
            ${agents.length} agents signed on,
            ${available} available,
            ${onCall} on call,
            ${wrap} on wrap-up,
            ${breakCnt} on break,
            ${busy} in other statuses
        `;

        // Build Agent Table
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Availability</th>
                        <th>Inbound Calls</th>
                        <th>Average Handle Time</th>
                        <th>Outbound Calls</th>
                        <th>Log On</th>
                        <th>Not Ready</th>
                        <th>Avail</th>
                        <th>On Inc Calls</th>
                        <th>On Out Calls</th>
                        <th>Wrap-up</th>
                        <th>Break</th>
                        <th>Other</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        agents.forEach((a, index) => {
            const rowColor = index % 2 === 0 ? "even-row" : "odd-row";
            const statusClass = getAgentStatusClass(a.CallTransferStatusDesc);

            html += `
                <tr class="${rowColor}">
                    <td>${a.FullName}</td>
                    <td class="${statusClass}">${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived ?? 0}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${a.TotalCallsDialed ?? 0}</td>
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

        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (err) {
        container.innerHTML = `<div class='error'>Error loading agent status</div>`;
    }
}
