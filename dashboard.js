const API_BASE = "https://visionbank-tle1.onrender.com";

// Load when ready
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();

    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

// Format seconds → HH:MM:SS
function formatSecondsToHHMMSS(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00:00";
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

// Convert UTC → Central Time
function convertUTCToCentral(utcString) {
    if (!utcString) return "";
    const date = new Date(utcString + "Z");
    return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

// Availability colors
function getAvailabilityClass(status) {
    if (!status) return "";
    const s = status.toLowerCase();

    if (s.includes("available")) return "avail-green";
    if (s.includes("wrap") || s.includes("break")) return "avail-yellow";
    if (
        s.includes("busy") ||
        s.includes("call") ||
        s.includes("accept") ||
        s.includes("connect") ||
        s.includes("dial")
    ) return "avail-red";

    return "";
}

// Load queue status
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || data.QueueStatus.length === 0) {
            container.innerHTML = `<div class="error">No queue data available</div>`;
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table class="data-table">
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
    }
}

// Load agent status
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

        // REMOVE PERFORMANCE SUMMARY
        summary.innerHTML = "";  // <-- Wiped clean

        // BUILD TABLE
        let html = `
            <table class="data-table">
                <tr>
                    <th>Employee</th>
                    <th>Team</th>
                    <th>Phone No.</th>
                    <th>Availability</th>
                    <th>Inbound</th>
                    <th>Missed</th>
                    <th>Transferred</th>
                    <th>Outbound</th>
                    <th>Avg Handle Time</th>
                    <th>Start Date</th>
                </tr>
        `;

        agents.forEach((a, index) => {
            const rowClass = index % 2 === 0 ? "row-even" : "row-odd";
            const availClass = getAvailabilityClass(a.CallTransferStatusDesc);

            html += `
                <tr class="${rowClass}">
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt || ""}</td>

                    <td class="${availClass}">
                        ${a.CallTransferStatusDesc}
                    </td>

                    <td>${a.TotalCallsReceived ?? 0}</td>
                    <td>${a.TotalCallsMissed ?? 0}</td>
                    <td>${a.ThirdPartyTransferCount ?? 0}</td>
                    <td>${a.DialoutCount ?? 0}</td>

                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${convertUTCToCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += "</table>";

        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<div class='error'>Error loading agent status</div>`;
    }
}
