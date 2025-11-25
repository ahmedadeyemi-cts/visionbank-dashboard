// =======================
// GLOBAL REALTIME STATS
// =======================

async function loadGlobalStats() {
    try {
        const response = await fetch(`${API_BASE}/v3/realtime/statistics/global`, {
            headers: API_HEADERS
        });

        if (!response.ok) throw new Error("Failed to load global stats");

        const data = await response.json();
        const stats = data.GlobalStatistics?.[0];

        if (!stats) throw new Error("No GlobalStatistics found");

        // Time conversion helper
        const formatSeconds = (sec) => {
            const h = String(Math.floor(sec / 3600)).padStart(2, "0");
            const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
            const s = String(sec % 60).padStart(2, "0");
            return `${h}:${m}:${s}`;
        };

        // Push values into HTML
        document.getElementById("gs-total-queued").textContent = stats.TotalCallsQueued;
        document.getElementById("gs-total-transferred").textContent = stats.TotalCallsTransferred;
        document.getElementById("gs-total-abandoned").textContent = stats.TotalCallsAbandoned;

        document.getElementById("gs-max-wait").textContent = formatSeconds(stats.MaxQueueWaitingTime);
        document.getElementById("gs-service-level").textContent = `${stats.ServiceLevel.toFixed(2)}%`;

        document.getElementById("gs-total-received").textContent = stats.TotalCallsReceived;
        document.getElementById("gs-answer-rate").textContent = `${stats.AnswerRate.toFixed(2)}%`;
        document.getElementById("gs-abandon-rate").textContent = `${stats.AbandonRate.toFixed(2)}%`;

        document.getElementById("gs-callback-registered").textContent = stats.CallbacksRegistered;
        document.getElementById("gs-callback-waiting").textContent = stats.CallbacksWaiting;

    } catch (error) {
        console.error("Error loading global stats:", error);
        document.getElementById("global-stats-container").innerHTML =
            `<div class="error-cell">Unable to load global statistics.</div>`;
    }
}

// Trigger load
loadGlobalStats();
