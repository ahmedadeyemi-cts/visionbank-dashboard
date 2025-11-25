// ===============================
// DASHBOARD.JS – UPDATED
// ===============================

// API BASE URL
const API_BASE = "https://pop1-apps.mycontactcenter.net/api/v3";

// ===============================
// FETCH QUEUE STATUS
// ===============================
async function loadQueueStatus() {
    try {
        const response = await fetch(`${API_BASE}/queue/status`);
        const data = await response.json();

        const tbody = document.getElementById("queue-body");
        tbody.innerHTML = "";

        if (!data || !data.length) {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">No queue data available.</td></tr>`;
            return;
        }

        data.forEach(q => {
            const row = document.createElement("tr");

            // Highlight long wait
            if (q.WaitCount > 0) {
                row.classList.add("queue-alert");
            }

            row.innerHTML = `
                <td>${q.QueueName || "Unknown"}</td>
                <td>${q.WaitCount ?? 0}</td>
                <td>${q.AgentCount ?? 0}</td>
                <td>${q.AverageWaitTime || "00:00:00"}</td>
            `;

            tbody.appendChild(row);
        });

        updateKPI();
    } catch (e) {
        console.error("Queue error:", e);
        document.getElementById("queue-body").innerHTML =
            `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
    }
}

// ===============================
// FETCH KPI DATA
// ===============================
async function updateKPI() {
    try {
        const response = await fetch(`${API_BASE}/queue/kpi`);
        const kpi = await response.json();

        document.getElementById("kpi-total-queued").textContent = kpi.TotalQueued ?? "--";
        document.getElementById("kpi-answered-pct").textContent = (kpi.AnsweredPct ?? 0) + "%";
        document.getElementById("kpi-answered-num").textContent = kpi.Answered ?? "--";
        document.getElementById("kpi-abandoned-pct").textContent = (kpi.AbandonedPct ?? 0) + "%";
        document.getElementById("kpi-abandoned-num").textContent = kpi.Abandoned ?? "--";

    } catch (e) {
        console.error("KPI error:", e);
    }
}

// ===============================
// FETCH AGENT DATA
// ===============================
async function loadAgentStatus() {
    try {
        const response = await fetch(`${API_BASE}/agent/status`);
        const data = await response.json();

        const tbody = document.getElementById("agent-body");
        tbody.innerHTML = "";

        if (!data || !data.AgentStatus || !data.AgentStatus.length) {
            tbody.innerHTML = `<tr><td colspan="10" class="error-cell">No agent data available.</td></tr>`;
            return;
        }

        data.AgentStatus.forEach(a => {
            const tr = document.createElement("tr");

            const availabilityText = getAvailabilityText(a.CallTransferStatusDesc);

            // ADD CSS CLASS BASED ON AVAILABILITY
            let availabilityClass = "avail-other";
            if (availabilityText === "Available") availabilityClass = "avail-available";
            else if (availabilityText === "Not Available") availabilityClass = "avail-not-available";

            tr.innerHTML = `
                <td>${a.FullName}</td>
                <td>${a.TeamName}</td>
                <td>${a.PhoneExt}</td>
                <td class="${availabilityClass}">${availabilityText}</td>
                <td>${a.TotalCallsReceived ?? 0}</td>
                <td>${a.TotalCallsMissed ?? 0}</td>
                <td>${a.ThirdPartyTransferCount ?? 0}</td>
                <td>${a.DialoutCount ?? 0}</td>
                <td>${formatSeconds(a.TotalSecondsOnCall)}</td>
                <td>${formatDate(a.StartDateUtc)}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error("Agent error:", e);
        document.getElementById("agent-body").innerHTML =
            `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
    }
}

// ===============================
// AVAILABILITY TEXT NORMALIZER
// ===============================
function getAvailabilityText(status) {
    if (!status) return "Other";

    const s = status.toLowerCase();

    if (s.includes("available")) return "Available";
    if (s.includes("not") || s.includes("busy") || s.includes("away")) return "Not Available";

    return "Other";
}

// ===============================
// UTILITY: FORMAT TIME
// ===============================
function formatSeconds(sec) {
    if (!sec || sec < 1) return "00:00:00";

    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ===============================
// UTILITY: FORMAT DATE
// ===============================
function formatDate(dateStr) {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleString();
}

// ===============================
// POLLING
// ===============================
loadQueueStatus();
loadAgentStatus();

setInterval(() => {
    loadQueueStatus();
    loadAgentStatus();
}, 10000);
