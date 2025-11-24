const API_BASE = "https://visionbank-tle1.onrender.com";

document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

// Convert seconds → HH:MM:SS
function fmt(sec) {
    if (!sec && sec !== 0) return "00:00:00";
    sec = Math.floor(sec);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

// Convert UTC → Central Time
function toCST(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr + "Z").toLocaleString("en-US", {
        timeZone: "America/Chicago"
    });
}

// Determine Availability Color
function getAvailabilityClass(status) {
    if (!status) return "";

    const s = status.toLowerCase();

    if (s.includes("available")) return "avail-green";
    if (s.includes("wrap")) return "avail-yellow";
    if (
        s.includes("busy") ||
        s.includes("call") ||
        s.includes("accept") ||
        s.includes("dial")
    ) return "avail-red";

    return "";
}

// ----------------------------
// Load Queue Status
// ----------------------------
async function loadQueueStatus() {
    const el = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || !data.QueueStatus.length) {
            el.innerHTML = "<div>No queue data found</div>";
            return;
        }

        const q = data.QueueStatus[0];

        el.innerHTML = `
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
                        <td>${fmt(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (e) {
        el.innerHTML = "<div>Error loading queue status</div>";
        console.error(e);
    }
}

// ----------------------------
// Load Agent Status
// ----------------------------
async function loadAgentStatus() {
    const el = document.getElementById("agentStatusContent");
    const summaryEl = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data.AgentStatus) {
            el.innerHTML = "<div>No agent data</div>";
            return;
        }

        const agents = data.AgentStatus;

        // Summary counts
        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc?.toLowerCase() || "";

            if (s.includes("available")) available++;
            else if (s.includes("call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else other++;
        });

        summaryEl.innerHTML = `
            ${agents.length} agents signed on, 
            ${available} available, 
            ${onCall} on call, 
            ${wrap} on wrap-up, 
            ${breakCnt} on break, 
            ${other} in other statuses
        `;

        // Build table
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
                        <th>Average Handle Time</th>
                        <th>Outbound Calls</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        agents.forEach(a => {
            const availClass = getAvailabilityClass(a.CallTransferStatusDesc);
            const avgHandle = a.TotalCallsAnswered > 0
                ? fmt(a.TotalSecondsOnCall / a.TotalCallsAnswered)
                : "00:00:00";

            html += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt || ""}</td>
                    <td class="${availClass}">${a.CallTransferStatusDesc || ""}</td>
                    <td>${a.TotalCallsAnswered || 0}</td>
                    <td>${a.TotalCallsMissed || 0}</td>
                    <td>${a.TotalCallsTransferred || 0}</td>
                    <td>${avgHandle}</td>
                    <td>${a.TotalOutboundCalls || 0}</td>
                    <td>${toCST(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        html += "</tbody></table>";
        el.innerHTML = html;

    } catch (e) {
        el.innerHTML = "<div>Error loading agent status</div>";
        console.error(e);
    }
}
