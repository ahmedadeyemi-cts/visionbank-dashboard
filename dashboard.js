// Base URL for your Render proxy backend
const API_BASE = "https://visionbank-tle1.onrender.com";

// ---------- Helper functions ----------

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

// ---------- Queue Status ----------

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

// ---------- Agent Status ----------

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

// Option A thresholds: <10 green, 10–30 yellow, >30 red
function durationCssClass(seconds) {
    if (!seconds || isNaN(seconds)) return "";
    const mins = seconds / 60;
    if (mins < 10) return "duration-green";
    if (mins < 30) return "duration-yellow";
    return "duration-red";
}

function renderAgentStatus(data) {
    if (!data || !data.AgentStatus || data.AgentStatus.length === 0) {
        document.getElementById("agentSummary").textContent = "No agents signed on.";
        return "";
    }

    const rows = data.AgentStatus;

    // Summary counts
    const signedOn = rows.length;
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

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Agent</th>
                    <th>Team</th>
                    <th>Phone No.</th>
                    <th>Status</th>
                    <th>Duration</th>
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
                    <th>Start Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    rows.forEach(a => {
        const state = classifyAgentState(a);
        const statusCss = stateCssClass(state);

        const durationSec =
            a.SecondsInCurrentStatus ??
            a.NormalOnCallInterval ??
            a.LogonInterval ??
            0;

        const durationClass = durationCssClass(durationSec);

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

        const statusText =
            a.CallTransferStatusDesc || a.AgentStateDesc || a.Status || "";

        html += `
            <tr>
                <td>${a.FullName || ""}</td>
                <td>${a.TeamName || ""}</td>
                <td>${a.PhoneExt || ""}</td>
                <td class="${statusCss}">${statusText}</td>
                <td class="${durationClass}">${formatSeconds(durationSec)}</td>
                <td>${answered}</td>
                <td>${missed}</td>
                <td>${trans}</td>
                <td>${outCalls}</td>
                <td>${formatSeconds(logOn)}</td>
                <td>${formatSeconds(notReady)}</td>
                <td>${formatSeconds(avail)}</td>
                <td>${format
