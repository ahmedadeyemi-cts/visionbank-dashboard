const API_BASE = "https://visionbank-tle1.onrender.com";

// Load everything on page load
document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadAgentStatus();
    setInterval(() => {
        loadQueueStatus();
        loadAgentStatus();
    }, 10000);
});

// ------------------------------
// Helpers
// ------------------------------
function formatSecondsToHHMMSS(seconds) {
    if (isNaN(seconds) || seconds === undefined || seconds === null) return "00:00:00";
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function convertUTCToCentral(utc) {
    if (!utc) return "";
    return new Date(utc + "Z").toLocaleString("en-US", { timeZone: "America/Chicago" });
}

// ------------------------------
// Availability Color Logic
// ------------------------------
function getAvailabilityClass(status) {
    if (!status) return "av-neutral";
    const s = status.toLowerCase();

    if (s.includes("available")) return "av-available";
    if (s.includes("wrap")) return "av-wrap";
    if (s.includes("busy") || s.includes("call") || s.includes("accept internal")) return "av-busy";

    return "av-neutral"; // fallback gray
}

// ------------------------------
// Queue Status
// ------------------------------
async function loadQueueStatus() {
    const container = document.getElementById("queueStatusBody");

    try {
        const res = await fetch(`${API_BASE}/queues`);
        const data = await res.json();

        const q = data?.QueueStatus?.[0];
        if (!q) return;

        container.innerHTML = `
            <tr>
                <td>${q.QueueName}</td>
                <td>${q.TotalCalls ?? 0}</td>
                <td>${q.TotalLoggedAgents ?? 0}</td>
                <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
            </tr>
        `;
    } catch (err) {
        console.error("Queue Status Error:", err);
    }
}

// ------------------------------
// Agent Status
// ------------------------------
async function loadAgentStatus() {
    const body = document.getElementById("agentBody");
    const summary = document.getElementById("agentSummary");

    try {
        const res = await fetch(`${API_BASE}/agents`);
        const data = await res.json();

        const agents = data?.AgentStatus ?? [];

        // Summary
        let available = 0, onCall = 0, wrap = 0, breakCnt = 0, other = 0;

        agents.forEach(a => {
            const s = a.CallTransferStatusDesc?.toLowerCase() ?? "";

            if (s.includes("available")) available++;
            else if (s.includes("on call") || s.includes("busy")) onCall++;
            else if (s.includes("wrap")) wrap++;
            else if (s.includes("break")) breakCnt++;
            else other++;
        });

        summary.innerText = `${agents.length} agents signed on, ${available} available, ${onCall} on call, ${wrap} on wrap-up, ${breakCnt} on break, ${other} in other statuses`;

        // Agent Table Rows
        body.innerHTML = agents.map((a, i) => {
            const rowClass = i % 2 === 0 ? "row-even" : "row-odd";
            const avClass = getAvailabilityClass(a.CallTransferStatusDesc);

            return `
                <tr class="${rowClass}">
                    <td>${a.FullName ?? ""}</td>
                    <td>${a.TeamName ?? ""}</td>
                    <td>${a.PhoneExt ?? ""}</td>
                    <td class="${avClass}">${a.CallTransferStatusDesc ?? ""}</td>
                    <td>${a.TotalCallsReceived ?? 0}</td>
                    <td>${a.TotalCallsMissed ?? 0}</td>
                    <td>${a.TotalCallsTransferred ?? 0}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnCall)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsWrappingUp)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsAvailable)}</td>
                    <td>${formatSecondsToHHMMSS(a.TotalSecondsOnBreak)}</td>
                    <td>${convertUTCToCentral(a.StartDateUtc)}</td>
                </tr>
            `;
        }).join("");

    } catch (err) {
        console.error("Agent Load Error:", err);
    }
}
