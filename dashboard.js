/* ================================
   Utility: Convert seconds to HH:MM:SS
=================================== */
function formatSeconds(sec) {
    if (sec === null || sec === undefined || isNaN(sec)) return "--";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ================================
   Load GLOBAL STATISTICS
=================================== */
async function loadGlobalStatistics() {
    try {
        const url = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/statistics/global";
        const response = await fetch(url);
        const json = await response.json();

        if (!json.GlobalStatistics || json.GlobalStatistics.length === 0) return;
        const gs = json.GlobalStatistics[0];

        document.getElementById("gs-total-queued").textContent = gs.TotalCallsQueued;
        document.getElementById("gs-total-transferred").textContent = gs.TotalCallsTransferred;
        document.getElementById("gs-total-abandoned").textContent = gs.TotalCallsAbandoned;
        document.getElementById("gs-max-wait").textContent = formatSeconds(gs.MaxQueueWaitingTime);

        document.getElementById("gs-service-level").textContent =
            `${gs.ServiceLevel.toFixed(1)}%`;

        document.getElementById("gs-calls-received").textContent = gs.TotalCallsReceived;
        document.getElementById("gs-answer-rate").textContent =
            `${gs.AnswerRate.toFixed(1)}%`;

        document.getElementById("gs-abandon-rate").textContent =
            `${gs.AbandonRate.toFixed(1)}%`;

        document.getElementById("gs-callbacks-reg").textContent =
            gs.CallbacksRegistered;

        document.getElementById("gs-callbacks-wait").textContent =
            gs.CallbacksWaiting;

    } catch (error) {
        console.error("Global stats load error:", error);
    }
}

/* ================================
   Load QUEUE STATUS
=================================== */
async function loadQueueStatus() {
    try {
        const url = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/queues";
        const response = await fetch(url);
        const queues = await response.json();

        const tbody = document.getElementById("queue-body");
        tbody.innerHTML = "";

        if (!queues || queues.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="error-cell">No queue data</td></tr>`;
            return;
        }

        queues.forEach(q => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${q.QueueName || "--"}</td>
                <td>${q.Calls || 0}</td>
                <td>${q.Agents || 0}</td>
                <td>${formatSeconds(q.Wait) || "--"}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Queue Load Error:", err);
        document.getElementById("queue-body").innerHTML =
            `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
    }
}

/* ================================
   Load AGENT PERFORMANCE
=================================== */
async function loadAgents() {
    try {
        const url = "https://pop1-apps.mycontactcenter.net/api/v3/realtime/agents";
        const res = await fetch(url);
        const agents = await res.json();

        const tbody = document.getElementById("agent-body");
        tbody.innerHTML = "";

        if (!agents || agents.length === 0) {
            tbody.innerHTML =
                `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
            return;
        }

        agents.forEach(a => {
            const tr = document.createElement("tr");

            // Color-coded availability
            let availClass = "";
            const status = (a.AgentState || "").toLowerCase();

            if (status.includes("available")) availClass = "avail-green";
            else if (
                status.includes("busy") ||
                status.includes("on call") ||
                status.includes("accepting internal")
            ) availClass = "avail-red";
            else if (status.includes("wrap")) availClass = "avail-yellow";

            tr.innerHTML = `
                <td>${a.EmployeeName || "--"}</td>
                <td>${a.Team || "--"}</td>
                <td>${a.PhoneNumber || "--"}</td>
                <td class="${availClass}">${a.AgentState || "--"}</td>
                <td>${a.Inbound || 0}</td>
                <td>${a.Missed || 0}</td>
                <td>${a.Transferred || 0}</td>
                <td>${a.Outbound || 0}</td>
                <td>${formatSeconds(a.AvgHandleTime) || "--"}</td>
                <td>${a.StartDate || "--"}</td>
            `;

            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Agent Load Error:", err);
        document.getElementById("agent-body").innerHTML =
            `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
    }
}

/* ================================
   DARK MODE
=================================== */
document.getElementById("dark-mode-toggle").addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
});

/* ================================
   REFRESH ALL DATA EVERY 10 SECONDS
=================================== */
function refreshAll() {
    loadQueueStatus();
    loadAgents();
    loadGlobalStatistics();
}

refreshAll();
setInterval(refreshAll, 10000);
