const API_BASE = "https://visionbank-tle1.onrender.com";

// --------------- helpers -----------------

function formatSecondsToHHMMSS(seconds) {
    const sec = Number.isFinite(seconds) ? seconds : 0;
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utcString) {
    if (!utcString) return "";
    const date = new Date(utcString + "Z");
    return date.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function safeText(value) {
    if (value === undefined || value === null) return "";
    return String(value);
}

// Map agent status text to css class
function getAgentStatusClass(statusText) {
    const s = (statusText || "").toLowerCase();
    if (s.includes("available")) return "agent-status-available";
    if (s.includes("on call")) return "agent-status-oncall";
    if (s.includes("wrap")) return "agent-status-wrapup";
    if (s.includes("break")) return "agent-status-break";
    if (s.includes("busy")) return "agent-status-busy";
    return "";
}

// ---------------- queue status -----------------

async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data || !Array.isArray(data.QueueStatus) || data.QueueStatus.length === 0) {
            container.innerHTML = "<div class='error'>No queue data available</div>";
            return;
        }

        const q = data.QueueStatus[0];

        const html = `
            <table>
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
                        <td>${safeText(q.QueueName)}</td>
                        <td>${safeText(q.TotalCalls)}</td>
                        <td>${safeText(q.TotalLoggedAgents)}</td>
                        <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    } catch (e) {
        console.error("Queue error:", e);
        container.innerHTML = "<div class='error'>Error loading queue status</div>";
    }
}

// ---------------- agent performance -----------------

async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data || !Array.isArray(data.AgentStatus) || data.AgentStatus.length === 0) {
            container.innerHTML = "<div class='error'>No agent data available</div>";
            summary.textContent = "";
            return;
        }

        const agents = data.AgentStatus;

        // Summary
        let available = 0, onCall = 0, wrap = 0, onBreak = 0, other = 0;
        agents.forEach(a => {
            const s = (a.CallTransferStatusDesc || "").toLowerCase();
            if (s.includes("available")) available++;
            else if (s.includes("on call")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) onBreak++;
            else other++;
        });

        summary.textContent =
            `${agents.length} agents signed on, ` +
            `${available} available, ${onCall} on call, ` +
            `${wrap} on wrap-up, ${onBreak} on break, ${other} in other statuses`;

        // Table body
        let rows = "";
        agents.forEach(a => {
            const inboundCalls = a.TotalCallsReceived || 0;
            const totalOnCallSeconds = a.TotalSecondsOnCall || 0;
            const avgHandleSeconds =
                inboundCalls > 0 ? Math.round(totalOnCallSeconds / inboundCalls) : 0;

            // DialoutCount is present in your JSON – use it for outbound calls.
            const outboundCalls = a.DialoutCount || 0;

            const statusClass = getAgentStatusClass(a.CallTransferStatusDesc);

            rows += `
                <tr>
                    <td class="${statusClass}">${safeText(a.FullName)}</td>
                    <td>${safeText(a.TeamName)}</td>
                    <td>${safeText(a.PhoneExt)}</td>
                    <td>${safeText(a.CallTransferStatusDesc)}</td>
                    <td>${inboundCalls}</td>
                    <td>${formatSecondsToHHMMSS(avgHandleSeconds)}</td>
                    <td>${outboundCalls}</td>
                    <td>${convertUTCToCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        const html = `
            <table>
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Availability</th>
                        <th>Inbound Calls</th>
                        <th>Average Handle Time</th>
                        <th>Outbound Calls</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        `;

        container.innerHTML = html;

    } catch (e) {
        console.error("Agent error:", e);
        container.innerHTML = "<div class='error'>Error loading agent status</div>";
        summary.textContent = "";
    }
}

// --------------- init --------------------

document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();

    // Refresh every 10 seconds
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});
