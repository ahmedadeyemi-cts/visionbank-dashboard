// Base URL of your Node/Express proxy on Render
const API_BASE = "https://visionbank-tle1.onrender.com";

/* ---------------------------
   Helpers
---------------------------- */

function formatSecondsToHHMMSS(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00:00";
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
}

// Choose CSS class for availability pill
function getAvailabilityClass(status) {
    if (!status) return "state-other";
    const s = status.toLowerCase();

    if (s.includes("available")) return "state-available";
    if (s.includes("on call")) return "state-oncall";
    if (s.includes("wrap")) return "state-wrapup";
    if (s.includes("break")) return "state-break";
    if (s.includes("busy")) return "state-busy";

    return "state-other";
}

/* ---------------------------
   Load all data on interval
---------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    refreshDashboard();
    setInterval(refreshDashboard, 10000); // every 10 seconds
});

async function refreshDashboard() {
    try {
        const [agentsRes, queuesRes] = await Promise.all([
            fetch(`${API_BASE}/agents`),
            fetch(`${API_BASE}/queues`)
        ]);

        const agentsData = await agentsRes.json();
        const queuesData = await queuesRes.json();

        const agents = agentsData.AgentStatus || [];
        const queues = queuesData.QueueStatus || [];

        updateKpis(agents, queues);
        renderQueueCard(queues);
        renderAgentTable(agents);
    } catch (err) {
        console.error("Dashboard refresh error:", err);
        // Minimal error surfaces
        const queueContainer = document.getElementById("queueStatusContent");
        const agentSummary = document.getElementById("agentSummary");
        const body = document.getElementById("agentTableBody");

        if (queueContainer) {
            queueContainer.innerHTML = `<div class="error">Error loading queue status</div>`;
        }
        if (agentSummary) {
            agentSummary.textContent = "Error loading agent status";
        }
        if (body) {
            body.innerHTML = "";
        }
    }
}

/* ---------------------------
   KPIs
---------------------------- */

function updateKpis(agents, queues) {
    // Available agents based on CallTransferStatusDesc
    const availableAgents = agents.filter(a =>
        (a.CallTransferStatusDesc || "").toLowerCase().includes("available")
    ).length;

    // Answered calls = sum of TotalCallsAnswered
    let answeredCalls = 0;
    let totalOnCallSeconds = 0;

    agents.forEach(a => {
        const answered = Number(a.TotalCallsAnswered || 0);
        answeredCalls += answered;
        totalOnCallSeconds += Number(a.TotalSecondsOnCall || 0);
    });

    const avgHandleSeconds = answeredCalls > 0
        ? totalOnCallSeconds / answeredCalls
        : 0;

    // Queue stats
    const q = queues[0] || {};
    const callsInQueue = Number(q.TotalCalls || q.WaitingCallbacks || 0);
    const oldestWait = q.MaxWaitInterval || 0;

    // Write to DOM
    const kpiAvailableEl = document.getElementById("kpiAvailable");
    const kpiAvailableSubEl = document.getElementById("kpiAvailableSub");
    const kpiAHTEl = document.getElementById("kpiAHT");
    const kpiAnsweredEl = document.getElementById("kpiAnswered");
    const kpiQueueEl = document.getElementById("kpiQueue");
    const kpiOldestEl = document.getElementById("kpiOldestWait");

    if (kpiAvailableEl) kpiAvailableEl.textContent = availableAgents.toString();
    if (kpiAvailableSubEl) {
        kpiAvailableSubEl.textContent = `${agents.length} agents signed on`;
    }

    if (kpiAHTEl) kpiAHTEl.textContent = formatSecondsToHHMMSS(avgHandleSeconds);
    if (kpiAnsweredEl) kpiAnsweredEl.textContent = answeredCalls.toString();
    if (kpiQueueEl) kpiQueueEl.textContent = callsInQueue.toString();
    if (kpiOldestEl) kpiOldestEl.textContent = formatSecondsToHHMMSS(oldestWait);
}

/* ---------------------------
   Queue Card
---------------------------- */

function renderQueueCard(queues) {
    const container = document.getElementById("queueStatusContent");
    if (!container) return;

    if (!queues || queues.length === 0) {
        container.innerHTML = `<div class="error">No queue data available</div>`;
        return;
    }

    const q = queues[0];

    const queueName = q.QueueName || "Voice Queue";
    const totalCalls = Number(q.TotalCalls || 0);
    const totalAgents = Number(q.TotalLoggedAgents || 0);
    const avgWait = q.AvgWaitInterval || 0;
    const maxWait = q.MaxWaitInterval || avgWait;

    container.innerHTML = `
        <table class="queue-table">
            <thead>
                <tr>
                    <th>Queue</th>
                    <th>Calls</th>
                    <th>Agents</th>
                    <th>Average Wait</th>
                    <th>Oldest Wait</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="queue-name">${queueName}</td>
                    <td>${totalCalls}</td>
                    <td>${totalAgents}</td>
                    <td>${formatSecondsToHHMMSS(avgWait)}</td>
                    <td class="queue-wait">${formatSecondsToHHMMSS(maxWait)}</td>
                </tr>
            </tbody>
        </table>
    `;
}

/* ---------------------------
   Agent Performance Table
---------------------------- */

function renderAgentTable(agents) {
    const tbody = document.getElementById("agentTableBody");
    const summaryEl = document.getElementById("agentSummary");
    if (!tbody) return;

    if (!agents || agents.length === 0) {
        tbody.innerHTML = "";
        if (summaryEl) summaryEl.textContent = "No agents signed on.";
        return;
    }

    // Build summary text
    let available = 0, onCall = 0, wrap = 0, onBreak = 0, others = 0;
    agents.forEach(a => {
        const status = (a.CallTransferStatusDesc || "").toLowerCase();
        if (status.includes("available")) available++;
        else if (status.includes("on call")) onCall++;
        else if (status.includes("wrap")) wrap++;
        else if (status.includes("break")) onBreak++;
        else others++;
    });

    if (summaryEl) {
        summaryEl.textContent =
            `${agents.length} agents signed on, ` +
            `${available} available, ` +
            `${onCall} on call, ` +
            `${wrap} on wrap-up, ` +
            `${onBreak} on break, ` +
            `${others} in other statuses`;
    }

    // Build rows
    let rowsHtml = "";

    agents.forEach(a => {
        const name = a.FullName || "";
        const availability = a.CallTransferStatusDesc || "Other";
        const availabilityClass = getAvailabilityClass(availability);

        const inbound = Number(a.TotalCallsAnswered || 0);
        const outbound = Number(a.TotalOutboundCalls || 0);
        const totalOnCall = Number(a.TotalSecondsOnCall || 0);

        const ahtSeconds = inbound > 0 ? totalOnCall / inbound : 0;
        const ahtFormatted = formatSecondsToHHMMSS(ahtSeconds);

        rowsHtml += `
            <tr>
                <td>${name}</td>
                <td>
                    <span class="availability-pill ${availabilityClass}">
                        ${availability}
                    </span>
                </td>
                <td class="calls-positive">${inbound}</td>
                <td>${ahtFormatted}</td>
                <td>${outbound}</td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}
