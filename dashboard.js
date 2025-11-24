const BACKEND = "https://visionbank-tle1.onrender.com";

/* -------------------------------------------
   TIME FORMATTING HELPERS
------------------------------------------- */

function formatSeconds(sec) {
    if (!sec || sec < 0) return "00:00:00";

    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function timeColor(seconds) {
    if (seconds < 300) return "time-green";      // < 5 min
    if (seconds < 1800) return "time-yellow";   // < 30 min
    return "time-red";                           // ≥ 30 min
}

function statusClass(status) {
    const text = (status || "").toLowerCase();
    if (text.includes("available")) return "status-available";
    if (text.includes("busy")) return "status-busy";
    if (text.includes("break")) return "status-break";
    if (text.includes("not ready")) return "status-notready";
    if (text.includes("wrap")) return "status-wrapup";
    return "";
}

/* -------------------------------------------
   LOAD QUEUE STATUS
------------------------------------------- */

async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${BACKEND}/queues`);
        const json = await res.json();

        if (!json.QueueStatus || json.QueueStatus.length === 0) {
            container.innerHTML = `<div class="error">No queue data available</div>`;
            return;
        }

        let q = json.QueueStatus[0];

        container.innerHTML = `
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
                        <td>${q.QueueName}</td>
                        <td>${q.TotalCalls}</td>
                        <td>${q.TotalLoggedAgents}</td>
                        <td>${formatSeconds(q.MaxWaitingTime)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (e) {
        container.innerHTML = `<div class="error">Error loading queue status</div>`;
    }
}

/* -------------------------------------------
   LOAD AGENT STATUS
------------------------------------------- */

async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${BACKEND}/agents`);
        const json = await res.json();

        if (!json.AgentStatus) {
            container.innerHTML = `<div class="error">Error loading agent status</div>`;
            return;
        }

        const list = json.AgentStatus;

        const total = list.length;
        const available = list.filter(a => a.CallTransferStatusDesc === "Available").length;
        const busy = list.filter(a => a.CallTransferStatusDesc.includes("Busy")).length;
        const breakCnt = list.filter(a => a.CallTransferStatusDesc.includes("Break")).length;

        summary.innerHTML = `
            ${total} agents signed on, 
            ${available} available, 
            ${busy} busy, 
            ${breakCnt} on break
        `;

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

        list.forEach(a => {
            const durationSec = a.SecondsInCurrentStatus || 0;

            html += `
                <tr>
                    <td>${a.FullName}</td>
                    <td>${a.TeamName}</td>
                    <td>${a.PhoneExt}</td>
                    <td class="${statusClass(a.CallTransferStatusDesc)}">${a.CallTransferStatusDesc}</td>
                    <td class="${timeColor(durationSec)}">${formatSeconds(durationSec)}</td>
                    <td>${a.TotalCallsAnswered || 0}</td>
                    <td>${a.TotalCallsMissed || 0}</td>
                    <td>${a.TotalCallsTransferred || 0}</td>
                    <td>${a.TotalOutboundCalls || 0}</td>
                    <td>${formatSeconds(a.LogonInterval)}</td>
                    <td>${formatSeconds(a.TotalSecondsNotSet || 0)}</td>
                    <td>${formatSeconds(a.TotalSecondsAvailable || 0)}</td>
                    <td>${formatSeconds(a.TotalSecondsOnCall || 0)}</td>
                    <td>${formatSeconds(a.TotalSecondsDialingOut || 0)}</td>
                    <td>${formatSeconds(a.TotalSecondsWrappingUp || 0)}</td>
                    <td>${formatSeconds(a.TotalSecondsOnBreak || 0)}</td>
                    <td>${formatSeconds(a.NormalOnOtherInterval || 0)}</td>
                    <td>${a.LastAccessDateUtc}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = `<div class="error">Error loading agent status</div>`;
    }
}

/* -------------------------------------------
   INITIAL LOAD
------------------------------------------- */

loadQueueStatus();
loadAgentStatus();
setInterval(() => {
    loadQueueStatus();
    loadAgentStatus();
}, 5000);
