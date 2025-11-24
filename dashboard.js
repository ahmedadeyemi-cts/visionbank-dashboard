const API_BASE = "https://visionbank-tle1.onrender.com";

// Convert seconds to HH:MM:SS
function formatSeconds(sec) {
    if (!sec || isNaN(sec)) return "00:00:00";
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

// UTC → Central Time
function toLocal(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr + "Z").toLocaleString("en-US", {
        timeZone: "America/Chicago"
    });
}

// Availability color rules
function statusColor(status) {
    const s = status.toLowerCase();

    if (s.includes("available")) return "avail-green";
    if (
        s.includes("busy") || 
        s.includes("call") || 
        s.includes("dial") ||
        s.includes("connected") ||
        s.includes("internal")
    ) return "avail-red";
    if (s.includes("wrap") || s.includes("break") || s.includes("acw"))
        return "avail-yellow";

    return "";
}

// Load queue section
async function loadQueue() {
    const box = document.getElementById("queueStatusContent");

    try {
        const r = await fetch(`${API_BASE}/queues`);
        const json = await r.json();
        const q = json.QueueStatus?.[0];

        if (!q) {
            box.innerHTML = `<div>No queue data</div>`;
            return;
        }

        box.innerHTML = `
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
                        <td>${formatSeconds(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (e) {
        box.innerHTML = `<div>Error loading queue data</div>`;
    }
}

// Load agent performance section
async function loadAgents() {
    const box = document.getElementById("agentTable");
    const summary = document.getElementById("agentSummary");

    try {
        const r = await fetch(`${API_BASE}/agents`);
        const json = await r.json();
        const agents = json.AgentStatus || [];

        // Counts
        let available = 0, oncall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc.toLowerCase();
            if (s.includes("available")) available++;
            else if (s.includes("call") || s.includes("busy")) oncall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else other++;
        });

        summary.innerHTML = `
            ${agents.length} agents signed on, 
            ${available} available, 
            ${oncall} on call, 
            ${wrap} on wrap-up, 
            ${breakCnt} on break, 
            ${other} in other statuses
        `;

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Availability</th>
                        <th>Inbound Calls</th>
                        <th>Missed</th>
                        <th>Transferred</th>
                        <th>Avg Handle Time</th>
                        <th>Outbound Calls</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        agents.forEach(a => {
            const color = statusColor(a.CallTransferStatusDesc);

            html += `
                <tr class="${color}">
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt}</td>
                    <td>${a.CallTransferStatusDesc}</td>
                    <td>${a.TotalCallsReceived || 0}</td>
                    <td>${a.TotalCallsMissed || 0}</td>
                    <td>${a.TotalCallsTransferred || 0}</td>
                    <td>${formatSeconds(a.AvgTalkInterval)}</td>
                    <td>${a.TotalOutboundCalls || 0}</td>
                    <td>${toLocal(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        box.innerHTML = html;

    } catch (e) {
        box.innerHTML = `<div>Error loading agent data</div>`;
    }
}

// Refresh every 10 seconds
document.addEventListener("DOMContentLoaded", () => {
    loadQueue();
    loadAgents();
    setInterval(() => {
        loadQueue();
        loadAgents();
    }, 10000);
});
