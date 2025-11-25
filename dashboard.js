// dashboard.js

// Proxy base that already worked for /queues and /agents
const BASE_URL = "https://visionbank-tle1.onrender.com";

let agentData = []; // enriched agent objects for rendering and sorting

document.addEventListener("DOMContentLoaded", () => {
  initDarkModeToggle();
  initAgentSorting();
  refreshAll();

  // refresh every 30 seconds
  setInterval(refreshAll, 30000);
});

function refreshAll() {
  loadQueueStatus();
  loadAgentStatus();
}

/* =========================
   QUEUE STATUS
========================= */

async function loadQueueStatus() {
  const tbody = document.getElementById("queue-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${BASE_URL}/queues`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const queues = data.QueueStatus || data.queueStatus || [];

    if (!queues.length) {
      throw new Error("No queue data");
    }

    tbody.innerHTML = "";

    let maxWaitSeconds = -1;
    let maxIndex = -1;

    queues.forEach((q, index) => {
      const tr = document.createElement("tr");
      if (index % 2 === 1) tr.classList.add("row-alt");

      const waitSeconds =
        coalesceNumber(q.AvgWaitInterval, q.MaxWaitingTime, q.MinWaitInterval, 0);

      if (waitSeconds > maxWaitSeconds) {
        maxWaitSeconds = waitSeconds;
        maxIndex = index;
      }

      const calls =
        coalesceNumber(q.TotalCalls, q.TotalCallsInInterval, q.TotalCallsHandled, 0);
      const agents =
        coalesceNumber(q.TotalLoggedAgents, q.LoggedAgents, q.AgentsLoggedIn, 0);

      tr.innerHTML = `
        <td>${q.QueueName || "Queue"}</td>
        <td class="numeric-cell">${calls}</td>
        <td class="numeric-cell">${agents}</td>
        <td>${formatSeconds(waitSeconds)}</td>
      `;

      tbody.appendChild(tr);
    });

    // highlight the queue with the longest wait time
    if (maxIndex >= 0) {
      const rows = tbody.querySelectorAll("tr");
      if (rows[maxIndex]) {
        rows[maxIndex].classList.add("queue-long-wait");
      }
    }
  } catch (err) {
    console.error("Error loading queue status", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="error-cell">Unable to load queue status.</td>
      </tr>
    `;
  }
}

/* =========================
   AGENT STATUS
========================= */

async function loadAgentStatus() {
  const tbody = document.getElementById("agent-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${BASE_URL}/agents`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const agents = data.AgentStatus || data.agentStatus || [];

    if (!agents.length) {
      throw new Error("No agent data");
    }

    // enrich data for rendering and KPIs
    agentData = agents.map((a) => {
      const inbound = coalesceNumber(a.TotalCallsReceived, a.CallCount, 0);
      const missed = coalesceNumber(a.TotalCallsMissed, a.MissedCallCount, 0);
      const transferred = coalesceNumber(a.ThirdPartyTransferCount, 0);
      const outbound = coalesceNumber(a.DialoutCount, a.DialOutCount, 0);

      const totalOnCallSeconds = coalesceNumber(a.TotalSecondsOnCall, 0);
      const avgHandleSeconds =
        inbound > 0 ? Math.round(totalOnCallSeconds / inbound) : 0;

      const startDate = a.StartDateUtc ? new Date(a.StartDateUtc) : null;

      const availabilityDesc = a.CallTransferStatusDesc || "";
      const availabilityClass = getAvailabilityClass(
        availabilityDesc,
        a.CurrentAvailability
      );

      return {
        raw: a,
        fullName: a.FullName || "",
        team: a.TeamName || "",
        phone: a.PhoneExt || "",
        availabilityDesc,
        availabilityClass,
        inbound,
        missed,
        transferred,
        outbound,
        avgHandleSeconds,
        startDate,
        startDateMs: startDate ? startDate.getTime() : 0,
      };
    });

    renderAgentTable();
    updateKpisFromAgents(agentData);
  } catch (err) {
    console.error("Error loading agent data", err);
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="error-cell">Unable to load agent data.</td>
      </tr>
    `;
  }
}

function renderAgentTable() {
  const tbody = document.getElementById("agent-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  agentData.forEach((a, index) => {
    const tr = document.createElement("tr");
    if (index % 2 === 1) tr.classList.add("row-alt");

    // mark agents with long average handle time
    if (a.avgHandleSeconds > 600 && a.inbound > 0) {
      tr.classList.add("agent-over-threshold");
    }

    tr.innerHTML = `
      <td>${a.fullName}</td>
      <td>${a.team}</td>
      <td>${a.phone}</td>
      <td class="availability-cell">
        <span class="availability-pill ${a.availabilityClass}">
          ${a.availabilityDesc || "Unknown"}
        </span>
      </td>
      <td class="numeric-cell">${a.inbound}</td>
      <td class="numeric-cell">${a.missed}</td>
      <td class="numeric-cell">${a.transferred}</td>
      <td class="numeric-cell">${a.outbound}</td>
      <td>${formatSeconds(a.avgHandleSeconds)}</td>
      <td>${a.startDate ? a.startDate.toLocaleString() : ""}</td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================
   AVAILABILITY COLOR LOGIC
========================= */

function getAvailabilityClass(desc, code) {
  const text = (desc || "").toLowerCase();

  // green
  if (text.includes("available")) return "availability-available";

  // yellow
  if (
    text.includes("wrap") ||
    text.includes("acw") ||
    text.includes("after call") ||
    text.includes("break") ||
    text.includes("lunch")
  ) {
    return "availability-wrap";
  }

  // red
  if (
    text.includes("on call") ||
    text.includes("busy") ||
    text.includes("dial") ||
    text.includes("callback") ||
    text.includes("accept internal")
  ) {
    return "availability-busy";
  }

  // numeric fallbacks if text is not clear
  if (code === 1) return "availability-available";
  if (code === 2) return "availability-wrap";
  if (code === 0) return "availability-busy";

  return "availability-other";
}

/* =========================
   KPIs FOR EXECUTIVES
   (computed from live agents)
========================= */

function updateKpisFromAgents(list) {
  const totalAnswered = list.reduce((sum, a) => sum + a.inbound, 0);
  const totalMissed = list.reduce((sum, a) => sum + a.missed, 0);
  const totalQueued = totalAnswered + totalMissed;
  const totalOutbound = list.reduce((sum, a) => sum + a.outbound, 0);

  const answerRate =
    totalQueued > 0 ? (totalAnswered / totalQueued) * 100 : 0;
  const abandonRate =
    totalQueued > 0 ? (totalMissed / totalQueued) * 100 : 0;

  const elQueued = document.getElementById("kpi-total-queued");
  const elAnsPct = document.getElementById("kpi-answered-pct");
  const elAnsNum = document.getElementById("kpi-answered-num");
  const elAbPct = document.getElementById("kpi-abandoned-pct");
  const elAbNum = document.getElementById("kpi-abandoned-num");

  if (elQueued) elQueued.textContent = totalQueued.toString();
  if (elAnsPct)
    elAnsPct.textContent =
      totalQueued > 0 ? `${answerRate.toFixed(1)}%` : "--";
  if (elAnsNum) elAnsNum.textContent = totalAnswered.toString();
  if (elAbPct)
    elAbPct.textContent =
      totalQueued > 0 ? `${abandonRate.toFixed(1)}%` : "--";
  if (elAbNum) elAbNum.textContent = totalMissed.toString();

  // if you want to surface outbound somewhere else later,
  // you already have totalOutbound calculated here
}

/* =========================
   SORTING
========================= */

function initAgentSorting() {
  const table = document.getElementById("agent-table");
  if (!table) return;

  const headers = table.querySelectorAll("thead th");
  let currentIndex = null;
  let currentDir = "asc";

  headers.forEach((th, index) => {
    th.addEventListener("click", () => {
      if (!agentData.length) return;

      if (currentIndex === index) {
        currentDir = currentDir === "asc" ? "desc" : "asc";
      } else {
        currentIndex = index;
        currentDir = "asc";
      }

      headers.forEach((h) =>
        h.classList.remove("sorted-asc", "sorted-desc")
      );
      th.classList.add(
        currentDir === "asc" ? "sorted-asc" : "sorted-desc"
      );

      sortAgents(currentIndex, currentDir);
      renderAgentTable();
    });
  });
}

function sortAgents(colIndex, dir) {
  const m = dir === "asc" ? 1 : -1;

  agentData.sort((a, b) => {
    let va;
    let vb;

    switch (colIndex) {
      case 0:
        va = a.fullName;
        vb = b.fullName;
        break;
      case 1:
        va = a.team;
        vb = b.team;
        break;
      case 2:
        va = a.phone;
        vb = b.phone;
        break;
      case 3:
        va = a.availabilityDesc;
        vb = b.availabilityDesc;
        break;
      case 4:
        va = a.inbound;
        vb = b.inbound;
        break;
      case 5:
        va = a.missed;
        vb = b.missed;
        break;
      case 6:
        va = a.transferred;
        vb = b.transferred;
        break;
      case 7:
        va = a.outbound;
        vb = b.outbound;
        break;
      case 8:
        va = a.avgHandleSeconds;
        vb = b.avgHandleSeconds;
        break;
      case 9:
        va = a.startDateMs;
        vb = b.startDateMs;
        break;
      default:
        va = 0;
        vb = 0;
    }

    if (typeof va === "string") {
      return va.localeCompare(vb) * m;
    }
    return (va - vb) * m;
  });
}

/* =========================
   DARK MODE
========================= */

function initDarkModeToggle() {
  const btn = document.getElementById("dark-mode-toggle");
  if (!btn) return;

  btn.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    btn.textContent = document.body.classList.contains("dark-mode")
      ? "Light mode"
      : "Dark mode";
  });
}

/* =========================
   HELPERS
========================= */

function formatSeconds(totalSeconds) {
  if (!totalSeconds || !Number.isFinite(totalSeconds)) {
    return "00:00:00";
  }

  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(sec).padStart(2, "0")
  );
}

function coalesceNumber(...values) {
  for (const v of values) {
    if (v === 0 || (typeof v === "number" && Number.isFinite(v))) {
      return v;
    }
  }
  return 0;
}
