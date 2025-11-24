// Base URL for your Render proxy backend
const API_BASE = "https://visionbank-tle1.onrender.com";

// Helpers

function formatSeconds(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return "00:00:00";
    sec = Math.floor(sec);
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function formatCentral(utcString) {
    if (!utcString) return "";
    const d = new Date(utcString);
    if (isNaN(d)) return "";
    return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

async function callAPI(path) {
    try {
        const res = await fetch(`${API_BASE}${path}`);
        if (!res.ok) {
            console.error("API error", path, res.status);
            return null;
        }
        return await res.json();
    } catch (err) {
        console.error("Fetch error", path, err);
        return null;
    }
}

/* ---------- Daily Queue Statistics ---------- */

function renderDailyQueueStats(data) {
    // If VisionBank does not expose queue statistics, show a friendly message
    if (!data || !data.QueueStatistics || data.QueueStatistics.length === 0) {
        return "<div class='section-summary'>No queue statistics available for today.</div>";
    }

    const rows = data.QueueStatistics;

    let html = `
        <table>
            <thead>
                <tr>
                    <th rowspan="2">Queue</th>
                    <th rowspan="2">Qd.</th>
                    <th rowspan="2">Rt.</th>
                    <th rowspan="2">FDQ.</th>
                    <th rowspan="2">Ab.</th>
                    <th rowspan="2">VM.</th>
                    <th rowspan="2">Rt. Rate</th>
                    <th rowspan="2">Ab. Rate</th>
                    <th rowspan="2">Service Level</th>
                    <th colspan="3" class="group-header">Wait Time</th>
                    <th colspan="3" class="group-header">Talk Time</th>
                </tr>
                <tr>
                    <th>Min.</th>
                    <th>Max.</th>
                    <th>Avg.</th>
                    <th>Min.</th>
                    <th>Max.</th>
                    <th>Avg.</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(q => {
        html += `
            <tr>
                <td>${q.QueueName || ""}</td>
                <td>${q.Queued ?? ""}</td>
                <td>${q.Routed ?? ""}</td>
                <td>${q.FirstDayQueued ?? q.FDQ ?? ""}</td>
                <td>${q.Abandoned ?? ""}</td>
                <td>${q.Voicemail ?? q.VM ?? ""}</td>
                <td>${q.RouteRate ?? ""}</td>
                <td>${q.AbandonRate ?? ""}</td>
                <td>${q.ServiceLevel ?? ""}</td>
                <td>${formatSeconds(q.WaitTimeMin)}</td>
                <td>${formatSeconds(q.WaitTimeMax)}</td>
                <td>${formatSeconds(q.WaitTimeAvg)}</td>
                <td>${formatSeconds(q.TalkTimeMin)}</td>
                <td>${formatSeconds(q.TalkTimeMax)}</td>
                <td>${formatSeconds(q.TalkTimeAvg)}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    return html;
}

/* ---------- Current Queue Status ---------- */

function renderQueueStatus(data) {
    if (!data || !data.QueueStatus || data.QueueStatus.length === 0) {
        return "<div class='section-summary'>No active queues.</div>";
    }

    const rows = data.QueueStatus;

    let html = `
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
    `;

    rows.forEach(q => {
        html += `
            <tr>
                <td>${q.QueueName}</td>
                <td>${q.TotalCalls}</td>
                <td>${q.TotalLoggedAgents}</td>
                <td>${formatSeconds(q.MaxWaitInterval || 0)}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    return html;
}

/* ---------- Current Agent Status ---------- */

function classifyAgentState(agent) {
    const s = (agent.CallTransferStatusDesc || agent.AgentStateDesc || agent.Status || "")
        .toLowerCase();

    if (s.includes("available")) return "available";
    if (s.includes("busy on call") || s.includes("on call")) return "oncall";
    if (s.includes("wrap")) return "wrap";
    if (s.includes("break")) return "break";
    return "other";
}

function stateCssClass(state) {
    if (state === "available") return "status-available";
    if (state === "oncall") return "status-busy";
    if (state === "break") return "status-break";
    return "status-other";
}

function renderAgentStatus(data) {
    if (!data || !data.AgentStatus || data.AgentStatus.length === 0) {
        document.getElementById("agentSummary").textContent = "No agents signed on.";
        return "";
    }

    const rows = data.AgentStatus;

    // Summary
    let signedOn = rows.length;
    let available = 0, oncall = 0, wrap = 0, brk = 0, other = 0;

    rows.forEach(a => {
        const cls = classifyAgentState(a);
        if (cls === "available") available++;
        else if (cls === "oncall") oncall++;
        else if (cls === "wrap") wrap++;
        else if (cls === "break") brk++;
        else other++;
    });

    const summaryText =
        `${signedOn} agents signed on, ${available} available, ` +
        `${oncall} on call, ${wrap} on wrap-up, ${brk} on break, ` +
        `${other} on other statuses`;

    document.getElementById("agentSummary").textContent = summaryText;

    // Table
    let html = `
        <table>
            <thead>
                <tr>
                    <th rowspan="2">Agent</th>
                    <th rowspan="2">Team</th>
                    <th rowspan="2">Phone No.</th>
                    <th rowspan="2">Status</th>
                    <th rowspan="2">Duration</th>
                    <th colspan="4" class="group-header">Incoming calls</th>
                    <th colspan="8" class="group-header">Time Management</th>
                    <th rowspan="2">Start Date</th>
                </tr>
                <tr>
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
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(a => {
        const state = classifyAgentState(a);
        const css = stateCssClass(state);
        const statusText = a.CallTransferStatusDesc || a.AgentStateDesc || a.Status || "";

        const durationSec = a.SecondsInCurrentStatus ?? a.NormalOnCallInterval ??
                            a.LogonInterval ?? 0;

        const answered = a.TotalCallsReceived ?? a.TotalCallCount ?? "";
        const missed = a.TotalCallsMissed ?? "";
        const trans = a.ThirdPartyTransferCount ?? "";
        const outCalls = a.TotalCallsOut ?? a.DialoutCount ?? "";

        const logOn = a.LogonInterval;
        const notReady = a.TotalSecondsNotSet;
        const avail = a.TotalSecondsAvailable;
        const onInc = a.TotalSecondsOnCall;
        const onOut = a.TotalSecondsDialingOut;
        const wrapup = a.TotalSecondsACW;
        const brkTime = a.TotalSecondsOnBreak;
        const otherTime = a.TotalSecondsBusy;

        html += `
            <tr>
                <td>${a.FullName || ""}</td>
                <td>${a.TeamName || ""}</td>
                <td>${a.PhoneExt || ""}</td>
                <td class="${css}">${statusText}</td>
                <td>${formatSeconds(durationSec)}</td>
                <td>${answered}</td>
                <td>${missed}</td>
                <td>${trans}</td>
                <td>${outCalls}</td>
                <td>${formatSeconds(logOn)}</td>
                <td>${formatSeconds(notReady)}</td>
                <td>${formatSeconds(avail)}</td>
                <td>${formatSeconds(onInc)}</td>
                <td>${formatSeconds(onOut)}</td>
                <td>${formatSeconds(wrapup)}</td>
                <td>${formatSeconds(brkTime)}</td>
                <td>${formatSeconds(otherTime)}</td>
                <td class="timestamp">${formatCentral(a.StartDateUtc)}</td>
            </tr>
        `;
    });

    html += "</tbody></table>";
    return html;
}

/* ---------- Load Dashboard ---------- */

async function loadDashboard() {
    const [queueStats, queueStatus, agents] = await Promise.all([
        callAPI("/queue-stats"),
        callAPI("/queues"),
        callAPI("/agents")
    ]);

    document.getElementById("dailyQueueContent").innerHTML =
        renderDailyQueueStats(queueStats);

    document.getElementById("queueStatusContent").innerHTML =
        renderQueueStatus(queueStatus);

    document.getElementById("agentStatusContent").innerHTML =
        renderAgentStatus(agents);
}

// Initial load and auto refresh
document.addEventListener("DOMContentLoaded", () => {
    loadDashboard();
    setInterval(loadDashboard, 5000);
});
