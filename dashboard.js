const API_BASE = "https://visionbank-tle1.onrender.com";

// Auto-load on startup
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

// Helpers
function formatSecondsToHHMMSS(sec) {
    if (sec === undefined || sec === null || isNaN(sec)) return "00:00:00";
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utc) {
    if (!utc) return "";
    return new Date(utc + "Z").toLocaleString("en-US", { timeZone: "America/Chicago" });
}

function getAvailabilityClass(status) {
    if (!status) return "";

    const s = status.toLowerCase();

    if (s.includes("available")) return "avail-green";
    if (s.includes("wrap")) return "avail-yellow";
    if (s.includes("busy") || s.includes("call") || s.includes("accept")) return "avail-red";

    return "";
}

//-------------------------------------------------
// LOAD QUEUE STATUS
//-------------------------------------------------
async function loadQueueStatus() {
    const container = document.getElementById("queueTableBody");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        if (!data.QueueStatus || data.QueueStatus.length === 0) {
            container.innerHTML = `<tr><td colspan="4">No queue data</td></tr>`;
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <tr>
                <td>${q.QueueName}</td>
                <td>${q.TotalCalls}</td>
                <td>${q.TotalLoggedAgents}</td>
                <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
            </tr>
        `;

    } catch (err) {
        console.error("Queue Error:", err);
        container.innerHTML = `<tr><td colspan="4">Error loading queues</td></tr>`;
    }
}

//-------------------------------------------------
// LOAD AGENT STATUS
//-------------------------------------------------
async function loadAgentStatus() {
    const tbody = document.getElementById("agentTableBody");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        if (!data.AgentStatus) {
            tbody.innerHTML = `<tr><td colspan="10">No agent data</td></tr>`;
            return;
        }

        const agents = data.AgentStatus;

        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const st = a.CallTransferStatusDesc.toLowerCase();
            if (st.includes("available")) available++;
            else if (st.includes("call")) onCall++;
            else if (st.includes("wrap")) wrap++;
            else if (st.includes("break")) breakCnt++;
            else other++;
        });

        summary.innerText =
            `${agents.length} agents signed on, ${available} available, ${onCall} on call, ` +
            `${wrap} on wrap-up, ${breakCnt} on break, ${other} in other statuses`;

        let html = "";

        agents.forEach((a, i) => {
            const rowClass = i % 2 === 0 ? "row-even" : "row-odd";
            const availClass = getAvailabilityClass(a.CallTransferStatusDesc);

            html += `
            <tr class="${rowClass}">
                <td>${a.FullName || ""}</td>
                <td>${a.TeamName || ""}</td>
                <td>${a.PhoneExt || ""}</td>
                <td class="${availClass}">${a.CallTransferStatusDesc || ""}</td>

                <td>${a.TotalCallsReceived ?? 0}</td>
                <td>${a.TotalCallsMissed ?? 0}</td>
                <td>${a.TotalCallsTransferred ?? 0}</td>

                <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                <td>${a.TotalOutboundCalls ?? 0}</td>
                <td>${convertUTCToCentral(a.StartDateUtc)}</td>
            </tr>`;
        });

        tbody.innerHTML = html;

    } catch (err) {
        console.error("Agent Error:", err);
        tbody.innerHTML = `<tr><td colspan="10">Error loading agents</td></tr>`;
    }
}
