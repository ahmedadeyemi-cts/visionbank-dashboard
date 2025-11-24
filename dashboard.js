const API_BASE = "https://visionbank-tle1.onrender.com";

// ------------------------------
// ON LOAD
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();

    // Auto refresh
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 5000);
});

// ------------------------------
// FORMATTERS
// ------------------------------
function formatSecondsToHHMMSS(sec) {
    if (!sec || isNaN(sec)) return "00:00:00";
    const h = String(Math.floor(sec / 3600)).padStart(2,"0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2,"0");
    const s = String(sec % 60).padStart(2,"0");
    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utc) {
    if (!utc) return "";
    return new Date(utc + "Z")
        .toLocaleString("en-US", { timeZone: "America/Chicago" });
}

// ------------------------------
// AVAILABILITY COLORING
// ------------------------------
function getAvailabilityClass(status) {
    const s = status.toLowerCase();

    if (s.includes("available")) return "status-available";
    if (s.includes("wrap")) return "status-wrap";
    if (
        s.includes("busy") ||
        s.includes("call") ||
        s.includes("accept") ||
        s.includes("dial")
    ) return "status-busy";

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
        const q = data?.QueueStatus?.[0];

        if (!q) {
            container.innerHTML = `<div class='error'>No queue data</div>`;
            return;
        }

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Queue</th>
                        <th class="numeric">Calls</th>
                        <th class="numeric">Agents</th>
                        <th class="numeric">Wait</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${q.QueueName}</td>
                        <td class="numeric">${q.TotalCalls}</td>
                        <td class="numeric">${q.TotalLoggedAgents}</td>
                        <td class="numeric">${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;

    } catch (err) {
        container.innerHTML = `<div class="error">Error loading queue status</div>`;
    }
}

// ------------------------------
// LOAD AGENTS
// ------------------------------
async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();
        const agents = data.AgentStatus || [];

        // -------------------------------------------------
        // Summary counts
        // -------------------------------------------------
        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc.toLowerCase();
            if (s.includes("available")) available++;
            else if (s.includes("call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else other++;
        });

        summary.innerHTML = `
            ${agents.length} agents signed on,
            ${available} available,
            ${onCall} on call,
            ${wrap} on wrap-up,
            ${breakCnt} on break,
            ${other} in other statuses
        `;

        // -------------------------------------------------
        // Build table
        // -------------------------------------------------
        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th class="sortable">Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Availability</th>
                        <th class="numeric">Inbound</th>
                        <th class="numeric">Missed</th>
                        <th class="numeric">Transferred</th>
                        <th class="numeric">Outbound</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        agents.forEach((a, i) => {
            const cls = getAvailabilityClass(a.CallTransferStatusDesc);

            html += `
                <tr class="${i % 2 === 0 ? "row-alt" : ""}">
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt || ""}</td>
                    <td class="${cls}">${a.CallTransferStatusDesc}</td>

                    <td class="numeric">${a.TotalCallsAnswered}</td>
                    <td class="numeric">${a.TotalCallsMissed}</td>
                    <td class="numeric">${a.TotalCallsTransferred}</td>
                    <td class="numeric">${a.TotalOutboundCalls}</td>

                    <td>${convertUTCToCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = `<div class="error">Error loading agents</div>`;
    }
}
