const API_ROOT = "https://pop1-apps.mycontactcenter.net/api/v3";
const AUTH_TOKEN =
  "VWGKXWSqGA4FwIRXb2clx5H1dS3cYpplXa5il3bE4Xg=";   // your working token

// -------------------------------
// Helper: format seconds → HH:MM:SS
// -------------------------------
function formatSeconds(sec) {
  if (!sec || sec < 0) sec = 0;
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// -------------------------------
// LOAD QUEUE STATUS
// GET /realtime/queues
// -------------------------------
async function loadQueueStatus() {
  const tbody = document.getElementById("queue-body");

  try {
    const res = await fetch(`${API_ROOT}/realtime/queues`, {
      headers: { token: AUTH_TOKEN }
    });
    const json = await res.json();

    if (!json.QueueStatus || json.QueueStatus.length === 0) {
      tbody.innerHTML =
        `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
      return;
    }

    const q = json.QueueStatus[0];

    tbody.innerHTML = `
      <tr>
        <td>${q.QueueName}</td>
        <td>${q.TotalCalls}</td>
        <td>${q.TotalLoggedAgents}</td>
        <td>${formatSeconds(q.AvgWaitInterval)}</td>
      </tr>`;
  } catch (err) {
    tbody.innerHTML =
      `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
  }
}

// -------------------------------
// LOAD GLOBAL REALTIME STATISTICS
// GET /realtime/statistics/global
// -------------------------------
async function loadGlobalStats() {
  const errBox = document.getElementById("global-error");
  const fields = {
    queued: document.getElementById("kpi-total-queued"),
    transferred: document.getElementById("kpi-total-transferred"),
    abandoned: document.getElementById("kpi-total-abandoned"),
    maxWait: document.getElementById("kpi-max-wait"),
    service: document.getElementById("kpi-service-level"),
    received: document.getElementById("kpi-total-received"),
    answerRate: document.getElementById("kpi-answer-rate"),
    abandonRate: document.getElementById("kpi-abandon-rate"),
    callbackReg: document.getElementById("kpi-callbacks-registered"),
    callbackWait: document.getElementById("kpi-callbacks-waiting")
  };

  try {
    const res = await fetch(
      `${API_ROOT}/realtime/statistics/global`,
      { headers: { token: AUTH_TOKEN } }
    );

    const json = await res.json();

    if (!json.GlobalStatistics || json.GlobalStatistics.length === 0) {
      errBox.classList.remove("hidden");
      return;
    }

    errBox.classList.add("hidden");

    const g = json.GlobalStatistics[0];

    fields.queued.textContent = g.TotalCallsQueued;
    fields.transferred.textContent = g.TotalCallsTransferred;
    fields.abandoned.textContent = g.TotalCallsAbandoned;
    fields.maxWait.textContent = formatSeconds(g.MaxQueueWaitingTime);
    fields.service.textContent = `${g.ServiceLevel.toFixed(1)}%`;
    fields.received.textContent = g.TotalCallsReceived;
    fields.answerRate.textContent = `${g.AnswerRate.toFixed(1)}%`;
    fields.abandonRate.textContent = `${g.AbandonRate.toFixed(1)}%`;
    fields.callbackReg.textContent = g.CallbacksRegistered;
    fields.callbackWait.textContent = g.CallbacksWaiting;

  } catch (err) {
    errBox.classList.remove("hidden");
  }
}

// -------------------------------
// LOAD AGENT PERFORMANCE
// GET /realtime/agents
// -------------------------------
async function loadAgents() {
  const tbody = document.getElementById("agent-body");

  try {
    const res = await fetch(`${API_ROOT}/realtime/agents`, {
      headers: { token: AUTH_TOKEN }
    });
    const json = await res.json();

    if (!json.AgentStatus || json.AgentStatus.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
      return;
    }

    const rows = json.AgentStatus.map(a => {
      const avgHandle = a.TotalCallsReceived
        ? formatSeconds(a.TotalSecondsOnCall / a.TotalCallsReceived)
        : "00:00:00";

      return `
        <tr>
          <td>${a.FullName}</td>
          <td>${a.TeamName}</td>
          <td>${a.PhoneExt}</td>
          <td>${a.CallTransferStatusDesc}</td>
          <td>${a.TotalCallsReceived}</td>
          <td>${a.TotalCallsMissed || 0}</td>
          <td>${a.TotalTransfers || 0}</td>
          <td>${a.DialoutCount || 0}</td>
          <td>${avgHandle}</td>
          <td>${a.StartDateUtc}</td>
        </tr>`;
    }).join("");

    tbody.innerHTML = rows;

  } catch (err) {
    tbody.innerHTML =
      `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
  }
}

// -------------------------------
// INIT + AUTO REFRESH
// -------------------------------
function initDashboard() {
  loadQueueStatus();
  loadGlobalStats();
  loadAgents();

  setInterval(() => {
    loadQueueStatus();
    loadGlobalStats();
    loadAgents();
  }, 10000);
}

document.addEventListener("DOMContentLoaded", initDashboard);
