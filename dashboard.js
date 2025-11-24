// --- API endpoints via your proxy on visionbank-tle1.onrender.com ---
const QUEUES_URL = '/queues';
const AGENTS_URL = '/agents';
const AGENT_SESSIONS_URL = '/agentsessions';  // expects ?date=YYYY-MM-DD

// Main refresh
document.addEventListener('DOMContentLoaded', () => {
    setupDarkModeToggle();
    loadDashboard();
    // refresh every 30 seconds
    setInterval(loadDashboard, 30000);
});

async function loadDashboard() {
    try {
        await fetchQueueStatus();        // build queue table + KPI container
    } catch (e) {
        console.error(e);
    }
    fetchAgentStatus();                 // build agent table
    fetchAgentSessionsSummary();        // fill KPI card
}

// ---------- Helpers ----------
function formatSeconds(totalSeconds) {
    const s = Number(totalSeconds) || 0;
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const hh = String(hrs).padStart(2, '0');
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function escapeHtml(text) {
    if (text == null) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getFirstDefined(...values) {
    for (const v of values) {
        if (v !== undefined && v !== null) return v;
    }
    return null;
}

function getAvailabilityClass(desc) {
    if (!desc) return '';
    const s = desc.toLowerCase();
    if (s.includes('available')) return 'status-available';
    if (s.includes('wrap') || s.includes('break')) return 'status-wrap';
    if (s.includes('call') || s.includes('busy') || s.includes('dial')) return 'status-busy';
    return '';
}

// ---------- Queue status + KPI container ----------
async function fetchQueueStatus() {
    const container = document.getElementById('queueStatusContent');
    const summaryEl = document.getElementById('queueSummary');

    try {
        const res = await fetch(QUEUES_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Queue request failed: ${res.status}`);
        const json = await res.json();
        const queues = json.QueueStatus || json.queues || json || [];

        if (!Array.isArray(queues) || queues.length === 0) {
            container.innerHTML = '<div class="error">No queue data available.</div>';
            summaryEl.textContent = '';
            return;
        }

        const q = queues[0];

        const calls = getFirstDefined(q.CallsInQueue, q.CallsWaiting, q.Calls, 0) || 0;
        const agents = getFirstDefined(q.TotalLoggedAgents, q.LoggedInAgents, q.Agents, 0) || 0;
        const waitSecs = getFirstDefined(q.MaxWaitInterval, q.MaxWaitingTime, q.AverageWaitInterval, 0) || 0;
        const waitStr = formatSeconds(waitSecs);

        summaryEl.textContent = `${escapeHtml(q.QueueName || 'Voice Queue')} queue: ${calls} call(s) in queue, ${agents} agent(s) logged in.`;

        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Queue</th>
                        <th class="numeric">Calls</th>
                        <th class="numeric">Agents</th>
                        <th class="numeric">Wait</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${escapeHtml(q.QueueName || 'Voice Queue')}</td>
                        <td class="numeric">${calls}</td>
                        <td class="numeric">${agents}</td>
                        <td class="numeric">${waitStr}</td>
                    </tr>
                </tbody>
            </table>
            <div id="kpiContainer" class="kpi-section"></div>
        `;

        container.innerHTML = tableHtml;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="error">Unable to load queue status.</div>';
        if (summaryEl) summaryEl.textContent = '';
    }
}

// ---------- Agent performance ----------
async function fetchAgentStatus() {
    const container = document.getElementById('agentStatusContent');
    const summaryEl = document.getElementById('agentSummary');

    try {
        const res = await fetch(AGENTS_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Agent request failed: ${res.status}`);
        const json = await res.json();
        const agents = json.AgentStatus || json.agents || json || [];

        if (!Array.isArray(agents) || agents.length === 0) {
            container.innerHTML = '<div class="error">No agent data available.</div>';
            summaryEl.textContent = '';
            return;
        }

        // high-level counts
        let total = agents.length;
        let available = 0;
        let onCall = 0;
        let wrap = 0;
        let breakCount = 0;
        let other = 0;

        for (const a of agents) {
            const desc = (a.CallTransferStatusDesc || '').toLowerCase();
            if (desc.includes('available')) available++;
            else if (desc.includes('wrap')) wrap++;
            else if (desc.includes('break')) breakCount++;
            else if (desc.includes('call') || desc.includes('busy')) onCall++;
            else other++;
        }

        summaryEl.textContent =
            `${total} agents signed on, ${available} available, ${onCall} on call, ${wrap} on wrap-up, ` +
            `${breakCount} on break, ${other} in other statuses`;

        // mark longest waiting on-call agent
        let maxSecondsOnCall = -1;
        let longestSessionId = null;
        for (const a of agents) {
            const desc = (a.CallTransferStatusDesc || '').toLowerCase();
            if (desc.includes('call')) {
                const secs = a.SecondsInCurrentStatus || 0;
                if (secs > maxSecondsOnCall) {
                    maxSecondsOnCall = secs;
                    longestSessionId = a.SessionId;
                }
            }
        }

        let rowHtml = '';
        agents.forEach((a, idx) => {
            const isAlt = idx % 2 === 1;
            const rowClasses = [];
            if (isAlt) rowClasses.push('row-alt');
            if (a.SessionId && a.SessionId === longestSessionId) {
                rowClasses.push('longest-wait');
            }

            const availDesc = a.CallTransferStatusDesc || a.ExternalStatusDescription || '';
            const availClass = getAvailabilityClass(availDesc);

            const inbound = a.TotalCallsReceived || 0;
            const missed = a.TotalCallsMissed || 0;
            const transferred = a.ThirdPartyTransferCount || 0;
            const outbound = a.DialoutCount || 0;

            const avgHandleSecs = inbound > 0 ? Math.round((a.TotalSecondsOnCall || 0) / inbound) : 0;
            const avgHandle = inbound > 0 ? formatSeconds(avgHandleSecs) : '00:00:00';

            const startDate = a.StartDateUtc
                ? new Date(a.StartDateUtc + 'Z').toLocaleString()
                : '';

            rowHtml += `
                <tr class="${rowClasses.join(' ')}">
                    <td>${escapeHtml(a.FullName || '')}</td>
                    <td>${escapeHtml(a.TeamName || '')}</td>
                    <td>${escapeHtml(a.PhoneExt || a.PhoneNumber || '')}</td>
                    <td class="${availClass}">${escapeHtml(availDesc)}</td>
                    <td class="numeric">${inbound}</td>
                    <td class="numeric">${missed}</td>
                    <td class="numeric">${transferred}</td>
                    <td class="numeric">${outbound}</td>
                    <td class="numeric">${avgHandle}</td>
                    <td>${escapeHtml(startDate)}</td>
                </tr>
            `;
        });

        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Employee</th>
                        <th>Team</th>
                        <th>Phone No.</th>
                        <th>Availability</th>
                        <th class="numeric">Inbound Calls</th>
                        <th class="numeric">Missed</th>
                        <th class="numeric">Transferred</th>
                        <th class="numeric">Outbound Calls</th>
                        <th class="numeric">Average Handle Time</th>
                        <th>Start Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowHtml}
                </tbody>
            </table>
        `;

        container.innerHTML = tableHtml;
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="error">Unable to load agent data.</div>';
        if (summaryEl) summaryEl.textContent = '';
    }
}

// ---------- Daily Call Summary (Agent Sessions) ----------
async function fetchAgentSessionsSummary() {
    const kpiContainer = document.getElementById('kpiContainer');
    if (!kpiContainer) {
        // queue section has not rendered yet
        return;
    }

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
        const url = `${AGENT_SESSIONS_URL}?date=${today}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Agent sessions request failed: ${res.status}`);
        const sessions = await res.json();

        if (!Array.isArray(sessions) || sessions.length === 0) {
            kpiContainer.innerHTML =
                '<div class="kpi-card"><div class="kpi-main-label">No call history for today yet.</div></div>';
            return;
        }

        let totalInbound = 0;
        let totalMissed = 0;
        let totalOutbound = 0;
        let totalTransfers = 0;

        for (const s of sessions) {
            totalInbound += s.CallCount || 0;
            totalMissed += s.MissedCallCount || 0;
            totalOutbound += s.DialOutCount || 0;
            totalTransfers += s.ThirdPartyTransferCount || 0;
        }

        const totalQueued = totalInbound + totalMissed;
        const answerRate = totalQueued > 0 ? (totalInbound / totalQueued) * 100 : 0;
        const abandonRate = totalQueued > 0 ? (totalMissed / totalQueued) * 100 : 0;

        renderKpiCard(kpiContainer, {
            totalQueued,
            totalInbound,
            totalMissed,
            totalOutbound,
            totalTransfers,
            answerRate,
            abandonRate
        });
    } catch (err) {
        console.error(err);
        kpiContainer.innerHTML =
            '<div class="kpi-card"><div class="kpi-main-label">Unable to load daily call summary.</div></div>';
    }
}

function renderKpiCard(container, stats) {
    const {
        totalQueued,
        totalInbound,
        totalMissed,
        totalOutbound,
        totalTransfers,
        answerRate,
        abandonRate
    } = stats;

    container.innerHTML = `
        <div class="kpi-card">
            <div class="kpi-main-value">${totalQueued}</div>
            <div class="kpi-main-label">Total Calls Queued</div>

            <div class="kpi-divider"></div>

            <div class="kpi-row">
                <div class="kpi-col">
                    <div class="kpi-sub-label">Pct</div>
                    <div class="kpi-sub-value">${answerRate.toFixed(1)}%</div>
                </div>
                <div class="kpi-col">
                    <div class="kpi-sub-label">Numeric</div>
                    <div class="kpi-sub-value">${totalInbound}</div>
                </div>
            </div>
            <div class="kpi-row-label">Total Calls Answered</div>

            <div class="kpi-divider"></div>

            <div class="kpi-row">
                <div class="kpi-col">
                    <div class="kpi-sub-label">Pct</div>
                    <div class="kpi-sub-value">${abandonRate.toFixed(1)}%</div>
                </div>
                <div class="kpi-col">
                    <div class="kpi-sub-label">Numeric</div>
                    <div class="kpi-sub-value">${totalMissed}</div>
                </div>
            </div>
            <div class="kpi-row-label">Total Calls Abandoned</div>

            <div class="kpi-footer-note">
                Outbound: ${totalOutbound} &middot; Transfers: ${totalTransfers}
            </div>
        </div>
    `;
}

// ---------- Dark mode ----------
function setupDarkModeToggle() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;

    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
    });
}
