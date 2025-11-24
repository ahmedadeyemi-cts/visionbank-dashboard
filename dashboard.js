const API_BASE = "https://visionbank-tle1.onrender.com";

// --------------- TIME HELPERS ---------------

function formatSecondsToMMSS(sec) {
  if (!sec || isNaN(sec)) return "00:00";
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function formatSecondsToHHMMSS(sec) {
  if (!sec || isNaN(sec)) return "00:00:00";
  const h = Math.floor(sec / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((sec % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(sec % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// --------------- STATE HELPERS ---------------

function getStatePill(status) {
  const s = (status || "").toLowerCase();
  let cls = "state-other";

  if (s.includes("available")) cls = "state-available";
  else if (s.includes("on call")) cls = "state-oncall";
  else if (s.includes("wrap")) cls = "state-busy";
  else if (s.includes("break")) cls = "state-break";
  else if (s.includes("busy")) cls = "state-busy";

  return `<span class="state-pill ${cls}">${status || "Unknown"}</span>`;
}

// --------------- DASHBOARD LOAD ---------------

async function fetchJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function loadDashboard() {
  try {
    const [queueData, agentData] = await Promise.all([
      fetchJSON("/queues"),
      fetchJSON("/agents"),
    ]);

    updateQueuePanel(queueData);
    updateAgentPanel(agentData);
    updateTopMetrics(queueData, agentData);
  } catch (err) {
    console.error("Dashboard error:", err);
    document.getElementById("queue-tbody").innerHTML =
      "<tr><td colspan='6'>Error loading queue data</td></tr>";
    document.getElementById("agent-tbody").innerHTML =
      "<tr><td colspan='5'>Error loading agent data</td></tr>";
  }
}

// --------------- QUEUE PANEL ---------------

function updateQueuePanel(queueData) {
  const tbody = document.getElementById("queue-tbody");
  if (!queueData || !Array.isArray(queueData.QueueStatus)) {
    tbody.innerHTML =
      "<tr><td colspan='6'>No queue data available</td></tr>";
    return;
  }

  const q = queueData.QueueStatus[0];

  const row = `
    <tr>
      <td>${q.QueueName}</td>
      <td>${q.TotalCalls}</td>
      <td>${q.TotalLoggedAgents}</td>
      <td>${formatSecondsToMMSS(q.AvgWaitInterval)}</td>
      <td>${formatSecondsToMMSS(q.MinWaitInterval)}</td>
      <td>${formatSecondsToMMSS(q.MaxWaitInterval)}</td>
    </tr>
  `;

  tbody.innerHTML = row;
}

// --------------- AGENT PANEL ---------------

function updateAgentPanel(agentData) {
  const tbody = document.getElementById("agent-tbody");
  const summary = document.getElementById("agent-summary");

  if (!agentData || !Array.isArray(agentData.AgentStatus)) {
    tbody.innerHTML =
      "<tr><td colspan='5'>No agent data available</td></tr>";
    summary.textContent = "No agents signed on.";
    return;
  }

  const agents = agentData.AgentStatus;

  let available = 0;
  let onCall = 0;
  let wrap = 0;
  let onBreak = 0;
  let other = 0;

  let totalInboundCalls = 0;
  let totalOnCallSeconds = 0;

  let rowsHtml = "";

  agents.forEach((a) => {
    const status = a.CallTransferStatusDesc || "";
    const sLower = status.toLowerCase();

    if (sLower.includes("available")) available++;
    else if (sLower.includes("on call")) onCall++;
    else if (sLower.includes("wrap")) wrap++;
    else if (sLower.includes("break")) onBreak++;
    else other++;

    const inbound = a.TotalCallsReceived || 0;
    const onCallSec = a.TotalSecondsOnCall || 0;
    const outbound = a.TotalIAMCount || 0; // best available proxy

    totalInboundCalls += inbound;
    totalOnCallSeconds += onCallSec;

    const ahtSeconds = inbound > 0 ? onCallSec / inbound : 0;

    rowsHtml += `
      <tr>
        <td>${a.FullName}</td>
        <td>${getStatePill(status)}</td>
        <td>${inbound}</td>
        <td>${formatSecondsToMMSS(ahtSeconds)}</td>
        <td>${outbound}</td>
      </tr>
    `;
  });

  tbody.innerHTML = rowsHtml;

  const signedOn = agents.length;
  summary.textContent = `${signedOn} agents signed on, ${available} available, ${onCall} on call, ${wrap} on wrap-up, ${onBreak} on break, ${other} in other statuses`;

  // store for top metrics
  window._agentTotals = {
    totalInboundCalls,
    totalOnCallSeconds,
    available,
  };
}

// --------------- TOP METRICS ---------------

function updateTopMetrics(queueData, agentData) {
  const queue = queueData && queueData.QueueStatus
    ? queueData.QueueStatus[0]
    : null;

  const queueCalls = queue ? queue.TotalCalls || 0 : 0;
  const oldestWaitSec = queue ? queue.MaxWaitInterval || 0 : 0;

  const agentTotals = window._agentTotals || {
    available: 0,
    totalInboundCalls: 0,
    totalOnCallSeconds: 0,
  };

  const { available, totalInboundCalls, totalOnCallSeconds } = agentTotals;
  const ahtSeconds =
    totalInboundCalls > 0 ? totalOnCallSeconds / totalInboundCalls : 0;

  document.getElementById("metric-available").textContent = available;
  document.getElementById("metric-aht").textContent =
    formatSecondsToMMSS(ahtSeconds);
  document.getElementById("metric-answered").textContent =
    totalInboundCalls;
  document.getElementById("metric-queue-calls").textContent = queueCalls;
  document.getElementById("metric-oldest-wait").textContent =
    formatSecondsToMMSS(oldestWaitSec);
}

// --------------- CLOCK ---------------

function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString("en-US", {
    timeZone: "America/Chicago",
    hour12: false,
  });
  const date = now.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  document.getElementById("currentTime").textContent = time;
  document.getElementById("currentDate").textContent = date;
}

// --------------- INIT ---------------

document.addEventListener("DOMContentLoaded", () => {
  loadDashboard();
  updateClock();

  // refresh metrics every 10 seconds
  setInterval(loadDashboard, 10000);
  setInterval(updateClock, 1000);
});
