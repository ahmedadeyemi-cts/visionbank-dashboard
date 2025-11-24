const API_BASE = "https://visionbank-tle1.onrender.com";

/* ---------- Global state ---------- */
let agentData = [];
let currentSortColumn = null;
let currentSortDir = "asc";
const STATUS_THRESHOLD_SECONDS = 15 * 60; // 15 minutes for flashing

document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    createDarkModeToggle();

    // refresh every 10 seconds
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

/* ---------- Helpers ---------- */
function formatSecondsToHHMMSS(seconds) {
    if (!seconds || isNaN(seconds)) return "00:00:00";
    const s = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
}

function convertUTCToCentral(utcString) {
    if (!utcString) return "";
    const d = new Date(utcString + "Z");
    return d.toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function classifyAvailability(status) {
    if (!status) return "";
    const s = status.toLowerCase();
    if (s.includes("wrap") || s.includes("acw")) return "status-wrap";
    if (s.includes("call") || s.includes("dial") || s.includes("ring") || s.includes("busy")) return "status-busy";
    if (s.includes("avail")) return "status-available";
    if (s.includes("break")) return "status-wrap"; // treat break like wrap for color
    return "";
}

function isCallingStatus(status) {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes("call") || s.includes("dial") || s.includes("ring") || s.includes("busy");
}

/* ---------- Queue status ---------- */
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");
    if (!container) return;

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || !data.QueueStatus.length) {
            container.innerHTML = "<div class='error'>No queue data available</div>";
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
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
                        <td class="queue-wait">${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error("Queue Error:", err);
        container.innerHTML = "<div class='error'>Error loading queue status</div>";
    }
}

/* ---------- Agent status ---------- */
async function loadAgentStatus() {
    const container = document.getElementById("agentStatusContent");
    const summary = document.getElementById("agentSummary");
    if (!container || !summary) return;

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data.AgentStatus || !data.AgentStatus.length) {
            container.innerHTML = "<div class='error'>No agent data available</div>";
            summary.textContent = "";
            return;
        }

        agentData = data.AgentStatus.map(a => ({
            fullName: a.FullName || "",
            team: a.TeamName || "",
            phone: a.PhoneExt || "",
            status: a.CallTransferStatusDesc || "",
            secondsInStatus: a.SecondsInCurrentStatus || 0,
            inbound: a.TotalCallsReceived || 0,
            missed: a.TotalCallsMissed || 0,
            transferred: (a.TotalCallsTransferred || a.ThirdPartyTransferCount || 0),
            outbound: (a.TotalOutboundCalls || a.DialoutCount || 0),
            handleSeconds: a.TotalSecondsOnCall || 0,
            startUtc: a.StartDateUtc || ""
        }));

        // summary counts
        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;
        data.AgentStatus.forEach(a => {
            const s = (a.CallTransferStatusDesc || "").toLowerCase();
            if (s.includes("avail")) available++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else if (s.includes("call") || s.includes("dial") || s.includes("ring") || s.includes("busy")) onCall++;
            else other++;
        });

        summary.textContent =
            `${agentData.length} agents signed on, ` +
            `${available} available, ` +
            `${onCall} on call, ` +
            `${wrap} on wrap-up, ` +
            `${breakCnt} on break, ` +
            `${other} in other statuses`;

        // default sort by name once
        if (!currentSortColumn) {
            currentSortColumn = "fullName";
            currentSortDir = "asc";
        }
        sortAgentData();
        renderAgentTable();

    } catch (err) {
        console.error("Agent Error:", err);
        container.innerHTML = "<div class='error'>Error loading agent status</div>";
    }
}

function sortAgentData() {
    if (!currentSortColumn) return;
    const dir = currentSortDir === "asc" ? 1 : -1;

    agentData.sort((a, b) => {
        const x = a[currentSortColumn];
        const y = b[currentSortColumn];

        if (typeof x === "number" && typeof y === "number") {
            return (x - y) * dir;
        }
        return String(x).localeCompare(String(y)) * dir;
    });
}

function renderAgentTable() {
    const container = document.getElementById("agentStatusContent");
    if (!container) return;

    // identify longest "calling" status agent
    let longestIndex = -1;
    let longestSeconds = -1;
    agentData.forEach((a, idx) => {
        if (isCallingStatus(a.status) && a.secondsInStatus > longestSeconds) {
            longestSeconds = a.secondsInStatus;
            longestIndex = idx;
        }
    });

    let html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th class="sortable" data-col="fullName">Agent</th>
                    <th class="sortable" data-col="team">Team</th>
                    <th class="sortable" data-col="phone">Phone No.</th>
                    <th class="sortable" data-col="status">Availability</th>
                    <th class="sortable numeric" data-col="inbound">Inbound Calls</th>
                    <th class="sortable numeric" data-col="missed">Missed Calls</th>
                    <th class="sortable numeric" data-col="transferred">Transferred Out</th>
                    <th class="sortable numeric" data-col="handleSeconds">Average Handle Time</th>
                    <th class="sortable numeric" data-col="outbound">Outbound Calls</th>
                    <th class="sortable" data-col="startUtc">Start Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    agentData.forEach((a, idx) => {
        const availabilityClass = classifyAvailability(a.status);

        const callsForAvg = a.inbound || a.outbound;
        const avgHandleSeconds = callsForAvg ? a.handleSeconds / callsForAvg : 0;

        let rowClass = "";
        if (idx % 2 === 1) rowClass += " row-alt";
        if (idx === longestIndex) rowClass += " longest-wait";
        if (isCallingStatus(a.status) && a.secondsInStatus >= STATUS_THRESHOLD_SECONDS) {
            rowClass += " over-threshold";
        }

        html += `
            <tr class="${rowClass.trim()}">
                <td>${a.fullName}</td>
                <td>${a.team}</td>
                <td>${a.phone}</td>
                <td class="${availabilityClass}">${a.status}</td>
                <td class="numeric">${a.inbound}</td>
                <td class="numeric">${a.missed}</td>
                <td class="numeric">${a.transferred}</td>
                <td class="numeric">${formatSecondsToHHMMSS(avgHandleSeconds)}</td>
                <td class="numeric">${a.outbound}</td>
                <td>${convertUTCToCentral(a.startUtc)}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    `;

    container.innerHTML = html;
    attachSortingHandlers();
}

function attachSortingHandlers() {
    const container = document.getElementById("agentStatusContent");
    const headers = container.querySelectorAll("th.sortable");
    headers.forEach(th => {
        th.addEventListener("click", () => {
            const col = th.getAttribute("data-col");
            if (currentSortColumn === col) {
                currentSortDir = currentSortDir === "asc" ? "desc" : "asc";
            } else {
                currentSortColumn = col;
                currentSortDir = col === "fullName" ? "asc" : "desc";
            }
            sortAgentData();
            renderAgentTable();
        });
    });
}

/* ---------- Dark mode ---------- */
function createDarkModeToggle() {
    const toggle = document.createElement("button");
    toggle.id = "darkModeToggle";
    toggle.textContent = "Dark mode";
    document.body.appendChild(toggle);

    toggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        toggle.textContent = document.body.classList.contains("dark-mode")
            ? "Light mode"
            : "Dark mode";
    });
}
