/* ============================================================
   Dashboard JS – Fully Fixed & Updated
   Compatible with your existing index.html + style.css
   ============================================================ */

/* ---------- CONFIG ---------- */
const BASE_URL = "https://pop1-apps.mycontactcenter.net/api/cca";
const API_KEY = "";   // If needed.
const THRESHOLD_SECONDS = 300; // 5 min

/* ---------- SIMPLE GET WRAPPER ---------- */
async function apiGet(path) {
    const url = `${BASE_URL}${path}`;
    const headers = { "Content-Type": "application/json" };
    if (API_KEY) headers["Authorization"] = `Bearer ${API_KEY}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
}

/* ============================================================
   QUEUE STATUS
   ============================================================ */
async function loadQueueStatus() {
    try {
        const queues = await apiGet("/v3/queue");
        const daily = await loadDailyKPI();

        const container = document.getElementById("queueStatusContent");
        container.innerHTML = "";

        if (!queues || queues.length === 0) {
            container.innerHTML = "<div class='error'>No queue data.</div>";
            return;
        }

        const q = queues[0]; // VisionBank uses 1 queue

        /* Summary row */
        document.getElementById("queueSummary").innerHTML = `
            Queue: <strong>${q.QueueName}</strong> | 
            Calls: <strong>${q.CallsWaiting}</strong> | 
            Agents: <strong>${q.AgentsStaffed}</strong> | 
            Wait: <strong>${q.WaitTime || "00:00:00"}</strong>
        `;

        /* Build table */
        const table = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Queue</th>
                        <th class="numeric">Calls</th>
                        <th class="numeric">Agents</th>
                        <th>Wait</th>
                    </tr>
                </thead>
                <tbody>
                    <tr id="queueRow">
                        <td>${q.QueueName}</td>
                        <td class="numeric">${q.CallsWaiting}</td>
                        <td class="numeric">${q.AgentsStaffed}</td>
                        <td>${q.WaitTime}</td>
                    </tr>
                </tbody>
            </table>
        `;

        /* KPI CARD (Daily Call Summary) */
        const kpi = `
            <div class="kpi-section">
                <div class="kpi-card">
                    <div class="kpi-main-value">${daily.totalQueued}</div>
                    <div class="kpi-main-label">Total Calls Queued</div>

                    <div class="kpi-divider"></div>

                    <div class="kpi-row">
                        <div class="kpi-col">
                            <div class="kpi-sub-value">${daily.answerPct}%</div>
                            <div class="kpi-sub-label">Pct</div>
                        </div>
                        <div class="kpi-col">
                            <div class="kpi-sub-value">${daily.answered}</div>
                            <div class="kpi-sub-label">Numeric</div>
                        </div>
                    </div>
                    <div class="kpi-row-label">Total Calls Answered</div>

                    <div class="kpi-divider"></div>

                    <div class="kpi-row">
                        <div class="kpi-col">
                            <div class="kpi-sub-value">${daily.abandonPct}%</div>
                            <div class="kpi-sub-label">Pct</div>
                        </div>
                        <div class="kpi-col">
                            <div class="kpi-sub-value">${daily.abandoned}</div>
                            <div class="kpi-sub-label">Numeric</div>
                        </div>
                    </div>
                    <div class="kpi-row-label">Total Calls Abandoned</div>
                </div>
            </div>
        `;

        container.innerHTML = `
            <div style="display:flex; gap:24px;">
                <div style="flex:1;">${table}</div>
                ${kpi}
            </div>
        `;

        highlightLongestWait(q);

    } catch (err) {
        document.getElementById("queueStatusContent").innerHTML =
            `<div class='error'>Failed to load queue: ${err}</div>`;
    }
}

/* ---------- Highlight longest wait caller ---------- */
function highlightLongestWait(queue) {
    const row = document.getElementById("queueRow");
    if (!row) return;

    const waitSeconds = toSeconds(queue.WaitTime);
    if (waitSeconds > THRESHOLD_SECONDS) row.classList.add("over-threshold");
}

/* --- Helper --- */
function toSeconds(hhmmss = "00:00:00") {
    const [h, m, s] = hhmmss.split(":").map(Number);
    return h * 3600 + m * 60 + s;
}

/* ============================================================
   AGENT PERFORMANCE
   ============================================================ */
async function loadAgentStatus() {
    try {
        const agents = await apiGet("/v3/agentstatus");

        const container = document.getElementById("agentStatusContent");
        container.innerHTML = "";

        if (!agents || agents.length === 0) {
            container.innerHTML = "<div class='error'>No agent status.</div>";
            return;
        }

        /* Build table */
        let rows = "";
        agents.forEach((a, i) => {
            const cls =
                a.IsOnCall ? "status-busy"
                : a.IsWrappingUp ? "status-wrap"
                : a.IsOnBreak ? "status-wrap"
                : "status-available";

            const alt = i % 2 === 1 ? "row-alt" : "";

            rows += `
                <tr class="${alt}">
                    <td>${a.AgentName}</td>
                    <td>${a.TeamName || ""}</td>
                    <td>${a.PhoneNumber || ""}</td>
                    <td class="${cls}">${a.StatusName}</td>
                    <td class="numeric">${a.InboundCount || 0}</td>
                    <td class="numeric">${a.OutboundCount || 0}</td>
                    <td class="numeric">${a.TransferCount || 0}</td>
                </tr>
            `;
        });

        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Status</th>
                        <th class="numeric">Inbound</th>
                        <th class="numeric">Outbound</th>
                        <th class="numeric">Transferred</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    } catch (err) {
        document.getElementById("agentStatusContent").innerHTML =
            `<div class='error'>Failed to load agent status: ${err}</div>`;
    }
}

/* ============================================================
   DAILY KPI USING AGENT SESSIONS (Your request)
   ============================================================ */
async function loadDailyKPI() {
    const today = new Date().toISOString().slice(0, 10);

    const sessions = await apiGet(`/v3/hist/agentsessions/${today}`);

    let answered = 0;
    let abandoned = 0;
    let dialOut = 0;

    sessions.forEach(s => {
        answered += s.CallCount || 0;
        abandoned += s.MissedCallCount || 0;
        dialOut += s.DialOutCount || 0;
    });

    const total = answered + abandoned;

    return {
        totalQueued: total,
        answered,
        abandoned,
        answerPct: total === 0 ? 0 : Math.round((answered / total) * 100),
        abandonPct: total === 0 ? 0 : Math.round((abandoned / total) * 100),
        dialOut
    };
}

/* ============================================================
   DARK MODE
   ============================================================ */
document.getElementById("darkModeToggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
});

/* ============================================================
   INITIAL LOAD + Auto-refresh
   ============================================================ */
async function refreshAll() {
    await loadQueueStatus();
    await loadAgentStatus();
}

refreshAll();
setInterval(refreshAll, 10000);
