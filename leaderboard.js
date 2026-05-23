/**
 * leaderboard.js — Leaderboard DOM rendering
 *
 * Called by ScoringEngine._renderLeaderboard() with:
 *
 * standings: Array of {
 *   name:  string,           — participant name
 *   total: number,           — combined points
 *   teams: Array<{
 *     teamName:  string,
 *     total:     number,
 *     breakdown: { [label]: number }
 *   }>
 * }
 */

function renderLeaderboard(standings) {
  const container = document.getElementById('leaderboard-container');
  container.innerHTML = '';

  if (!standings.length) {
    container.innerHTML = '<p class="loading">No standings yet.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', 'Fantasy leaderboard');

  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">#</th>
        <th scope="col">Participant</th>
        <th scope="col">Teams</th>
        <th scope="col" style="text-align:right">Pts</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');

  standings.forEach((entry, idx) => {
    const rank      = idx + 1;
    const rankClass = rank <= 3 ? ` rank-${rank}` : '';

    const teamsStr = entry.teams.map(t => {
      const flag = TEAM_FLAGS[t.teamName] || '';
      return `${flag} ${t.teamName} <span class="team-pts">(${t.total})</span>`;
    }).join(' &nbsp;·&nbsp; ');

    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="rank${rankClass}">${rank}</td>
      <td class="player-name">${escHtml(entry.name)}</td>
      <td class="team-name">${teamsStr}</td>
      <td class="score">${entry.total}</td>
    `;

    row.style.cursor = 'pointer';
    row.addEventListener('click', () => toggleBreakdown(row, entry));
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function toggleBreakdown(row, entry) {
  const existing = row.nextElementSibling;
  if (existing && existing.classList.contains('breakdown-row')) {
    existing.remove();
    return;
  }

  const detail = document.createElement('tr');
  detail.className = 'breakdown-row';

  const cell = document.createElement('td');
  cell.setAttribute('colspan', '4');
  cell.style.cssText = 'padding: 0.25rem 1rem 1rem 3rem;';

  const teamBlocks = entry.teams.map(t => {
    const flag = TEAM_FLAGS[t.teamName] || '';
    const bk = Object.entries(t.breakdown)
      .map(([k, v]) => `${formatKey(k)}: ${v > 0 ? '+' : ''}${v}`)
      .join(' &nbsp;·&nbsp; ');

    return `
      <div style="padding: 0.4rem 0; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
        <span style="font-weight:600">${flag} ${escHtml(t.teamName)}</span>
        <span style="color:var(--text-muted); margin-left: 0.75rem">${bk || 'No results yet'}</span>
        <span style="float:right; font-weight:700">${t.total} pts</span>
      </div>
    `;
  }).join('');

  cell.innerHTML = teamBlocks;
  detail.appendChild(cell);
  row.after(detail);
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatKey(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
