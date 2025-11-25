// ---------------------------
// CONFIG
// ---------------------------

const TOKEN = "VWGKXWSqGA4FwlRXb2clx5H1dS3cYppIXa5iI3bE4Xg=";
const MCC_BASE = "https://pop1-apps.mycontactcenter.net/api/v3";


// ---------------------------
// HELPERS
// ---------------------------

function formatSecondsToHHMMSS(seconds) {
    const sec = Number.isFinite(seconds) ? seconds : 0;
    const h = Math.floor(sec / 3600).toString().padStart(2, "0");
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, "0");
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function safeText(v) {
    return (v === undefined || v === null) ? "--" : v;
}


// ---------------------------
// LOAD QUEUE STATUS
// ---------------------------

async function loadQueueStatus() {
    const container = document.getElementById("queueStatusContent");

    try {
        const res = await fetch(`${MCC_BASE}/realtime/queues`, {
            headers: { token: TOKEN }
        });

        const data = await res.json();

        if (!data.QueueStatus || data.QueueStatus.length === 0) {
            container.innerHTML = "<div class='error'>No queue data available</div>";
            return;
        }

        const q = data.QueueStatus[0];

        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Queue</th>
                        <th>Calls</th>
                        <th>Agents</th>
                        <th>Avg Wait</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${safeText(q.QueueName)}</td>
                        <td>${safeText(q.TotalCalls)}</td>
                        <td>${safeText(q.TotalLoggedAgents)}</td>
                        <td>${formatSecondsToHHMMSS(q.AvgWaitInterval)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    } catch (err) {
        console.error("Queue load error:", err);
        container.innerHTML = "<div class='error'>Unable to load queue status.</div>";
    }
}


// ---------------------------
// LOAD GLOBAL REALTIME STATISTICS
// ---------------------------

async function loadGlobalStats() {
    const ids = {
        queued: "gs_total_queued",
        transferred: "gs_total_transferred",
        abandoned: "gs_total_abandoned",
        maxwait: "gs_max_wait",
        service: "gs_service_level",
        received: "gs_total_received",
        ansRate: "gs_answer_rate",
        abdRate: "gs_abandon_rate",
        cbReg: "gs_callback_registered",
        cbWait: "gs_callback_waiting"
    };

    try {
        const res = await fetch(`${MCC_BASE}/realtime/statistics/global`, {
            headers: { token: TOKEN }
        });

        const data = await res.json();

        if (!data.GlobalStatistics || data.GlobalStatistics.length === 0) {
            Object.values(ids).forEach(id => {
                document.getElementById(id).innerText = "--";
            });
            return;
        }

        const g = data.GlobalStatistics[0];

        document.getElementById(ids.queued).innerText = safeText(g.TotalCallsQueued);
        document.getElementById(ids.transferred).innerText = safeText(g.TotalCallsTransferred);
        document.getElementById(ids.abandoned).innerText = safeText(g.TotalCallsAbandoned);
        document.getElementById(ids.maxwait).innerText = formatSecondsToHHMMSS(g.MaxQueueWaitingTime);
        document.getElementById(ids.service).innerText = g.ServiceLevel.toFixed(1) + "%";
        document.getElementById(ids.received).innerText = safeText(g.TotalCallsReceived);
        document.getElementById(ids.ansRate).innerText = g.AnswerRate.toFixed(1) + "%";
        document.getElementById(ids.abdRate).innerText = g.AbandonRate.toFixed(1) + "%";
        document.getElementById(ids.cbReg).innerText = safeText(g.CallbacksRegistered);
        document.getElementById(ids.cbWait).innerText = safeText(g.CallbacksWaiting);

    } catch (err) {
        console.error("Global stats load error:", err);
    }
}


// ---------------------------
// INIT
// ---------------------------

document.addEventListener("DOMContentLoaded", () => {
    loadQueueStatus();
    loadGlobalStats();

    setInterval(() => {
        loadQueueStatus();
        loadGlobalStats();
    }, 10000);
});
