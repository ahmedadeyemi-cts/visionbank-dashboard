// dashboard.js
// VisionBank CEG Contact Center Realtime Dashboard

const API_BASE = 'https://visionbank-tle1.onrender.com';
const QUEUES_URL = `${API_BASE}/queues`;
const AGENTS_URL = `${API_BASE}/agents`;
const SESSIONS_URL = `${API_BASE}/v3/hist/agentsessions`;

// thresholds
const LONG_WAIT_THRESHOLD_SECONDS = 300;   // 5 minutes for queue highlight
const AGENT_ONCALL_THRESHOLD_SECONDS = 600; // 10 minutes for flashing row

// ---------- Utility functions ----------

function $(selector) {
  return document.querySelector(selector);
}

function formatSecondsToHHMMSS(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return '00:00:00';
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function formatSecondsToMMSS(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds)) return '00:00';
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function todayISODate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ---------- Queue status ----------

async function loadQueueStatus() {
  const queueBody =
    document.querySelector('#queue-body') ||
    document.querySelector('#queueBody');

  if (!queueBody) return;

  try {
    const response = await fetch(QUEUES_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const queues = data.QueueStatus || [];
    queueBody.innerHTML = '';

    if (!queues.length) {
      queueBody.innerHTML =
        `<tr><td colspan="4" class="error-cell">No queue data available.</td></tr>`;
      return;
    }

    queues.forEach((q, index) => {
      const row = document.createElement('tr');

      const waitingSeconds = q.MaxWaitingTime ?? q.AvgWaitInterval ?? 0;
      const waitDisplay = formatSecondsToMMSS(waitingSeconds);

      row.innerHTML = `
        <td>${q.QueueName || 'Unknown'}</td>
        <td>${q.TotalCalls ?? 0}</td>
        <td>${q.TotalLoggedAgents ?? 0}</td>
        <td>${waitDisplay}</td>
      `;

      // highlight row if longest wait above threshold
      if (waitingSeconds >= LONG_WAIT_THRESHOLD_SECONDS) {
        row.classList.add('queue-long-wait');
      }

      // zebra striping
      if (index % 2 === 1) {
        row.classList.add('row-alt');
      }

      queueBody.appendChild(row);
    });
  } catch (err) {
    console.error('Error loading queue status:', err);
    queueBody.innerHTML =
      `<tr><td colspan="4" class="error-cell">Unable to load queue status.</td></tr>`;
  }
}

// ---------- Agent performance ----------

function classifyAvailability(statusText, currentAvailability) {
  const status = (statusText || '').toLowerCase();

  // 0 = not ready/other, 1 = available, 2 = custom (per CCA)
  if (currentAvailability === 1 || status.includes('available')) {
    return 'available';
  }

  if (
    status.includes('wrap') ||
    status.includes('acw') ||
    status.includes('break')
  ) {
    return 'wrap';
  }

  if (
    status.includes('call') ||
    status.includes('busy') ||
    status.includes('dial') ||
    status.includes('accept internal')
  ) {
    return 'busy';
  }

  // default
  return 'other';
}

async function loadAgentStatus() {
  const agentBody =
    document.querySelector('#agent-body') ||
    document.querySelector('#agentBody');

  const agentTable =
    document.querySelector('#agent-table') ||
    document.querySelector('#agentTable');

  if (!agentBody || !agentTable) return;

  try {
    const response = await fetch(AGENTS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const agents = data.AgentStatus || [];
    agentBody.innerHTML = '';

    if (!agents.length) {
      agentBody.innerHTML =
        `<tr><td colspan="10" class="error-cell">No agent data available.</td></tr>`;
      return;
    }

    agents.forEach((agent, index) => {
      const row = document.createElement('tr');

      const inboundCalls =
        agent.TotalCallsReceived ??
        agent.CallCount ??
        0;

      const missedCalls =
        agent.TotalCallsMissed ??
        agent.MissedCallCount ??
        0;

      const transferredCalls =
        agent.ThirdPartyTransferCount ??
        0;

      const outboundCalls =
        agent.DialoutCount ??
        agent.DialOutCount ??
        0;

      const avgHandleSeconds =
        inboundCalls > 0
          ? (agent.TotalSecondsOnCall || 0) / inboundCalls
          : 0;

      const availabilityClass = classifyAvailability(
        agent.CallTransferStatusDesc,
        agent.CurrentAvailability
      );

      const availabilityDisplay =
        agent.CallTransferStatusDesc || 'Unknown';

      row.innerHTML = `
        <td>${agent.FullName || ''}</td>
        <td>${agent.TeamName || ''}</td>
        <td>${agent.PhoneExt || ''}</td>
        <td class="availability-cell">
          <span class="availability-pill availability-${availabilityClass}">
            ${availabilityDisplay}
          </span>
        </td>
        <td class="numeric-cell">${inboundCalls}</td>
        <td class="numeric-cell">${missedCalls}</td>
        <td class="numeric-cell">${transferredCalls}</td>
        <td class="numeric-cell">${outboundCalls}</td>
        <td>${formatSecondsToHHMMSS(avgHandleSeconds)}</td>
        <td>${new Date(agent.StartDateUtc || '').toLocaleString() || ''}</td>
      `;

      // flashing red when on call over threshold
      const secondsInStatus = agent.SecondsInCurrentStatus || 0;
      const statusLower = (agent.CallTransferStatusDesc || '').toLowerCase();
      if (
        (statusLower.includes('call') || statusLower.includes('busy')) &&
        secondsInStatus >= (agent.NormalOnCallInterval || AGENT_ONCALL_THRESHOLD_SECONDS)
      ) {
        row.classList.add('agent-over-threshold');
      }

      if (index % 2 === 1) {
        row.classList.add('row-alt');
      }

      agentBody.appendChild(row);
    });

    enableAgentTableSorting(agentTable, agentBody);
  } catch (err) {
    console.error('Error loading agent data:', err);
    agentBody.innerHTML =
      `<tr><td colspan="10" class="error-cell">Unable to load agent data.</td></tr>`;
  }
}

// ---------- Agent table sorting ----------

function enableAgentTableSorting(table, tbody) {
  const headers = table.querySelectorAll('thead th');
  headers.forEach((th, index) => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const ascending =
        !th.classList.contains('sorted-asc') || th.classList.contains('sorted-desc');

      headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(ascending ? 'sorted-asc' : 'sorted-desc');

      const rows = Array.from(tbody.querySelectorAll('tr'));
      rows.sort((a, b) => {
        const aText = a.children[index]?.textContent.trim() || '';
        const bText = b.children[index]?.textContent.trim() || '';

        const aNum = parseFloat(aText.replace(/[^0-9.-]/g, ''));
        const bNum = parseFloat(bText.replace(/[^0-9.-]/g, ''));

        const bothNumeric = !isNaN(aNum) && !isNaN(bNum);
        if (bothNumeric) {
          return ascending ? aNum - bNum : bNum - aNum;
        }

        return ascending
          ? aText.localeCompare(bText)
          : bText.localeCompare(aText);
      });

      rows.forEach(r => tbody.appendChild(r));
    });
  });
}

// ---------- KPI metrics from agent sessions ----------

async function loadKpiMetrics() {
  const kpiQueued = $('#kpi-total-queued');
  const kpiAnsNum = $('#kpi-answered-num');
  const kpiAnsPct = $('#kpi-answered-pct');
  const kpiAbnNum = $('#kpi-abandoned-num');
  const kpiAbnPct = $('#kpi-abandoned-pct');

  // If KPI container is not present in the HTML, do nothing
  if (!kpiQueued || !kpiAnsNum || !kpiAnsPct || !kpiAbnNum || !kpiAbnPct) {
    return;
  }

  try {
    const date = todayISODate();
    const response = await fetch(`${SESSIONS_URL}/${date}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const sessions = await response.json();

    // Only include voice sessions (MediaTypeId "CSI")
    const voiceSessions = sessions.filter(
      s => (s.MediaTypeId || '').toUpperCase() === 'CSI'
    );

    const totalAnswered = voiceSessions.reduce(
      (sum, s) => sum + (s.CallCount || 0),
      0
    );

    const totalAbandoned = voiceSessions.reduce(
      (sum, s) => sum + (s.MissedCallCount || 0),
      0
    );

    const totalOutbound = voiceSessions.reduce(
      (sum, s) => sum + (s.DialOutCount || 0),
      0
    );

    const totalQueued = totalAnswered + totalAbandoned;

    const answerRate = totalQueued
      ? (totalAnswered / totalQueued) * 100
      : 0;

    const abandonRate = totalQueued
      ? (totalAbandoned / totalQueued) * 100
      : 0;

    // Update KPI card
    kpiQueued.textContent = totalQueued.toString();
    kpiAnsNum.textContent = totalAnswered.toString();
    kpiAnsPct.textContent = `${answerRate.toFixed(1)}%`;
    kpiAbnNum.textContent = totalAbandoned.toString();
    kpiAbnPct.textContent = `${abandonRate.toFixed(1)}%`;

    // Extra: outbound metric if you ever want to display it
    const outboundEl = $('#kpi-outbound');
    if (outboundEl) {
      outboundEl.textContent = totalOutbound.toString();
    }
  } catch (err) {
    console.error('Error loading KPI metrics:', err);
    // Leave existing placeholders if the KPI call fails
  }
}

// ---------- Dark mode ----------

function initDarkMode() {
  const toggleButton = document.getElementById('dark-mode-toggle');
  if (!toggleButton) return;

  const stored = localStorage.getItem('vb-dark-mode');
  if (stored === 'true') {
    document.body.classList.add('dark-mode');
    toggleButton.textContent = 'Light mode';
  }

  toggleButton.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('vb-dark-mode', isDark ? 'true' : 'false');
    toggleButton.textContent = isDark ? 'Light mode' : 'Dark mode';
  });
}

// ---------- Initialization ----------

document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  loadQueueStatus();
  loadAgentStatus();
  loadKpiMetrics();

  // refresh periodically
  setInterval(() => {
    loadQueueStatus();
    loadAgentStatus();
    loadKpiMetrics();
  }, 30000); // every 30 seconds
});
