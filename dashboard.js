/* ===============================
   DASHBOARD.JS – UPDATED
================================ */

/* -------------------------------
   API BASE CONFIG
-------------------------------- */
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/cca";   // Adjust if needed
const API_KEY = "";  // If your system requires auth add here

/* -------------------------------
   LOAD QUEUE STATUS
-------------------------------- */
async function loadQueueStatus() {
    const tbody = document.getElementById("queue-body");
    tbody.innerHTML = `<tr><td colspan="4">Loading…</td></tr>`;

    try {
        const res = await fetch(`${API_BASE}/v3/queue`);
        const data = await res.json();

        const queue = data?.Queues?.[0];
        if (!queue) throw new Error("No queue data");

        const queueName = queue.QueueName || "Queue";
        const calls = queue.QueuedCalls || 0;
        const agents = queue.AgentsStaffed || 0;

        // -------------------------------
        // FIXED: TRUE CURRENT WAIT TIME
        // -------------------------------
        let waitSeconds = queue.LongestWaitingCallTime;
        if (!waitSeconds || waitSeconds < 1) {
            waitSeconds = 0; // match portal showing 0
        }

        const waitFormatted = formatSeconds(waitSeconds);

        tbody.innerHTML = `
            <tr class="queue-alert">
                <td>${queueName}</td>
                <td>${calls}</td>
                <td>${agents}</td>
                <td>${waitFormatted}</td>
            </tr>
        `;

        /* KPI SECTION */
        document.getElementById("kpi-total-queued").textContent = queue.TotalOffered || 0;

        const ans = queue.Answered || 0;
        const abd = queue.Abandoned || 0;
        const total = ans + abd;

        const pctAns = total ? ((ans / total) * 100).toFixed(1) : 0;
        const pctAbd = total ? ((abd / total) * 100).toFixed(1) : 0;

        document.getElementById("kpi-answered-pct").textContent = pctAns + "%";
        document.getElementById("kpi-answered-num").textContent = ans;

        document.getElementById("kpi-abandoned-pct").textContent = pctAbd + "%";
        document.getElementById("kpi-abandoned-num").textContent = abd;

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
        console.error("QUEUE ERROR:", err);
    }
}

/* -------------------------------
   LOAD AGENT PERFORMANCE
-------------------------------- */
async function loadAgentStats() {
    const tbody = document.getElementById("agent-body");
    tbody.innerHTML = `<tr><td colspan="10">Loading…</td></tr>`;

    try {
        const date = new Date().toISOString().split("T")[0];
        const res = await fetch(`${API_BASE}/v3/hist/agentsessions/${date}`);
        const data = await res.json();

        if (!Array.isArray(data)) throw new Error("Invalid agent data");

        let html = "";
        data.forEach(a => {
            const inbound = a.CallCount || 0;
            const missed = a.MissedCallCount || 0;
            const transferred = a.ThirdPartyTransferCount || 0;
            const outbound = a.DialOutCount || 0;

            const availability = mapAvailability(a);

            html += `
                <tr>
                    <td>${a.AgentName || "Unknown"}</td>
                    <td>CEG Agents</td>
                    <td>${a.PhoneNumber || ""}</td>
                    <td class="avail-cell">${availability}</td>
                    <td>${inbound}</td>
                    <td>${missed}</td>
                    <td>${transferred}</td>
                    <td>${outbound}</td>
                    <td>${formatSeconds(a.SecondsOnCall)}</td>
                    <td>${formatDate(a.StartDateUtc)}</td>
                </tr>
            `;
        });

        tbody.innerHTML = html;

        /* Apply availability colors AFTER HTML loads */
        applyAvailabilityColors();

    } catch (err) {
        console.error("AGENT ERROR:", err);
        tbody.innerHTML = `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
    }
}

/* -------------------------------
   AVAILABILITY COLOR HANDLING
-------------------------------- */
function applyAvailabilityColors() {
    document.querySelectorAll(".avail-cell").forEach(cell => {
        const text = cell.textContent.trim().toLowerCase();

        if (text === "available") {
            cell.style.background = "#d6f7d6";
            cell.style.color = "#0a6b0a";
            cell.style.fontWeight = "bold";
            cell.style.borderRadius = "20px";
        }

        if (text === "not available") {
            cell.style.background = "#ffd9d9";
            cell.style.color = "#b30000";
            cell.style.fontWeight = "bold";
            cell.style.borderRadius = "20px";
        }
    });
}

/* -------------------------------
   HELPER FUNCTIONS
-------------------------------- */
function mapAvailability(a) {
    return a.SecondsAvailable > 0 ? "Available" : "Not Available";
}

function formatSeconds(total) {
    if (!total || total < 1) return "00:00:00";
    const h = String(Math.floor(total / 3600)).padStart(2, "0");
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const s = String(total % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function formatDate(utc) {
    if (!utc) return "-";
    return new Date(utc).toLocaleString();
}

/* -------------------------------
   DARK MODE
-------------------------------- */
document.getElementById("dark-mode-toggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
});

/* -------------------------------
   REFRESH INTERVALS
-------------------------------- */
loadQueueStatus();
loadAgentStats();

setInterval(loadQueueStatus, 8000);
setInterval(loadAgentStats, 15000);
