const API_BASE = "https://visionbank-tle1.onrender.com";

/* ----------------- GLOBAL ----------------- */
let agentData = [];
let sortColumn = null;
let sortDir = "asc";

/* ----------------- INITIAL LOAD ----------------- */
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    loadKPIs();

    setInterval(loadQueueStatus, 8000);
    setInterval(loadAgentStatus, 8000);
    setInterval(loadKPIs, 20000);
});

/* ----------------- UTILS ----------------- */
function availabilityClass(desc) {
    if (!desc) return "";

    const s = desc.toLowerCase();

    if (s.includes("wrap") || s.includes("acw"))
        return "wrapup";

    if (
        s.includes("call") ||
        s.includes("dial") ||
        s.includes("ring") ||
        s.includes("busy")
    )
        return "busy";

    if (s.includes("avail"))
        return "available";

    return "";
}

/* ----------------- QUEUE STATUS ----------------- */
async function loadQueueStatus() {
    const box = document.getElementById("queueStatusContent");
    if (!box) return;

    const res = await fetch(`${API_BASE}/queues`);
    const data = await res.json();

    box.innerHTML = `
        <table class="queue-table">
            <tr><th>Queue</th><th>Calls</th><th>Agents</th><th>Wait</th></tr>
            <tr>
                <td>${data.QueueName}</td>
                <td>${data.Calls}</td>
                <td>${data.Agents}</td>
                <td>${data.Wait}</td>
            </tr>
        </table>
    `;
}

/* ----------------- KPI SECTION ----------------- */
async function loadKPIs() {
    const kpiDiv = document.getElementById("kpiContainer");
    if (!kpiDiv) return;

    const today = new Date().toISOString().split("T")[0];

    const res = await fetch(`${API_BASE}/v3/hist/agentsessions/${today}`);
    const sessions = await res.json();

    let inbound = 0;
    let outbound = 0;
    let missed = 0;

    sessions.forEach(s => {
        inbound += s.CallCount || 0;
        outbound += s.DialOutCount || 0;
        missed += s.MissedCallCount || 0;
    });

    const answeredPct = inbound + missed === 0 ? 0 : ((inbound / (inbound + missed)) * 100).toFixed(1);
    const abandonedPct = inbound + missed === 0 ? 0 : ((missed / (inbound + missed)) * 100).toFixed(1);

    kpiDiv.innerHTML = `
        <div class="kpi-card">
            <div class="kpi-value">${inbound + missed}</div>
            <div class="kpi-label">Total Calls Queued</div>
        </div>

        <div class="kpi-card">
            <div class="kpi-value">${answeredPct}%</div>
            <div class="kpi-label">Pct Answered</div>
        </div>

        <div class="kpi-card">
            <div class="kpi-value">${inbound}</div>
            <div class="kpi-label">Total Calls Answered</div>
        </div>

        <div class="kpi-card">
            <div class="kpi-value">${abandonedPct}%</div>
            <div class="kpi-label">Pct Abandoned</div>
        </div>

        <div class="kpi-card">
            <div class="kpi-value">${missed}</div>
            <div class="kpi-label">Total Abandoned</div>
        </div>
    `;
}

/* ----------------- AGENT STATUS TABLE ----------------- */
async function loadAgentStatus() {
    const res = await fetch(`${API_BASE}/agentstatus`);
    const data = await res.json();
    agentData = data.AgentStatus;

    renderAgentTable();
}

function renderAgentTable() {
    const container = document.getElementById("agentTableContainer");
    if (!container) return;

    let html = `
        <table class="agent-table">
            <tr>
                <th onclick="sortAgents('FullName')">Employee</th>
                <th>Team</th>
                <th>Phone</th>
                <th onclick="sortAgents('CallTransferStatusDesc')">Availability</th>
                <th>Inbound</th>
                <th>Outbound</th>
                <th>Transferred</th>
                <th>Missed</th>
                <th>Start Date</th>
            </tr>
    `;

    agentData.forEach(a => {
        const cls = availabilityClass(a.CallTransferStatusDesc);

        html += `
            <tr class="${cls}">
                <td>${a.FullName}</td>
                <td>${a.TeamName}</td>
                <td>${a.PhoneExt}</td>
                <td>${a.CallTransferStatusDesc}</td>
                <td>${a.TotalCallsReceived}</td>
                <td>${a.DialoutCount}</td>
                <td>${a.ThirdPartyTransferCount}</td>
                <td>${a.TotalCallsMissed}</td>
                <td>${new Date(a.StartDateUtc).toLocaleString()}</td>
            </tr>
        `;
    });

    html += "</table>";
    container.innerHTML = html;
}

/* ----------------- SORTING ----------------- */
function sortAgents(col) {
    if (sortColumn === col) {
        sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
        sortColumn = col;
        sortDir = "asc";
    }

    agentData.sort((a, b) => {
        let x = a[col], y = b[col];
        if (typeof x === "string") x = x.toLowerCase();
        if (typeof y === "string") y = y.toLowerCase();
        return sortDir === "asc" ? (x > y ? 1 : -1) : (x < y ? 1 : -1);
    });

    renderAgentTable();
}

/* ----------------- DARK MODE ----------------- */
function createDarkModeToggle() {
    const btn = document.createElement("button");
    btn.innerText = "Dark Mode";
    btn.className = "darkToggle";
    btn.onclick = () => document.body.classList.toggle("dark");
    document.body.appendChild(btn);
}
