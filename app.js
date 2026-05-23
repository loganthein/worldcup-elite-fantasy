/**
 * app.js — Core data structures, scoring engine, and data layer
 *
 * Data flow:
 *   1. Try GitHub Gist cache (fast, no quota cost).
 *   2. If cache is stale or missing, fetch from API-Football.
 *   3. On a successful API fetch, write result back to Gist.
 *
 * Expects CONFIG to be defined by config.js loaded before this script.
 */

// ── Participants ───────────────────────────────────────────────────────────────
// name → [team1, team2]

const PARTICIPANTS = {
  Ashleigh: ['Brazil',      'Canada'],
  Baker:    ['Germany',     'Croatia'],
  Chad:     ['Japan',       'Paraguay'],
  Jackie:   ['Morocco',     'Sweden'],
  Jake:     ['Argentina',   'Australia'],
  Joren:    ['Norway',      'Scotland'],
  Keillor:  ['France',      'Uruguay'],
  Kyle:     ['England',     'Senegal'],
  Logan:    ['USA',         'Switzerland'],
  Patrick:  ['Portugal',    'Austria'],
  Sara:     ['Spain',       'Mexico'],
  TJ:       ['Colombia',    'Turkey'],
  'Tom Moran': ['Belgium',  'South Korea'],
  Goon:     ['Netherlands', 'Ecuador'],
};

// ── Groups ─────────────────────────────────────────────────────────────────────

const GROUPS = {
  A: ['Mexico',      'South Korea', 'Czechia',    'South Africa'],
  B: ['Switzerland', 'Canada',      'Bosnia',     'Qatar'],
  C: ['Brazil',      'Morocco',     'Haiti',      'Scotland'],
  D: ['USA',         'Paraguay',    'Australia',  'Turkey'],
  E: ['Germany',     'Ecuador',     'Ivory Coast','Curacao'],
  F: ['Netherlands', 'Japan',       'Sweden',     'Tunisia'],
  G: ['Belgium',     'Egypt',       'Iran',       'New Zealand'],
  H: ['Spain',       'Uruguay',     'Saudi Arabia','Cape Verde'],
  I: ['France',      'Senegal',     'Norway',     'Iraq'],
  J: ['Argentina',   'Austria',     'Algeria',    'Jordan'],
  K: ['Portugal',    'Colombia',    'Congo',      'Uzbekistan'],
  L: ['England',     'Croatia',     'Ghana',      'Panama'],
};

// ── Tiers ──────────────────────────────────────────────────────────────────────
// Tier A: no win bonus. Tier B: +2 per group-stage win.

const TIER_A = new Set([
  'Spain', 'France', 'England', 'Brazil',
  'Argentina', 'Portugal', 'Germany', 'Netherlands',
]);

// ── Scoring ────────────────────────────────────────────────────────────────────

const SCORING = {
  group_win:       2,   // + tier bonus if Tier B
  group_win_bonus: 2,   // added for Tier B teams only
  group_draw:      1,
  group_advance:   3,   // advancing from group stage (any method)
  round_of_32:     4,
  round_of_16:     6,
  quarterfinal:    8,
  semifinal:       10,
  champion:        15,
};

// ── Team flags ─────────────────────────────────────────────────────────────────

const TEAM_FLAGS = {
  // Group A
  Mexico:         '🇲🇽',
  'South Korea':  '🇰🇷',
  Czechia:        '🇨🇿',
  'South Africa': '🇿🇦',
  // Group B
  Switzerland:    '🇨🇭',
  Canada:         '🇨🇦',
  Bosnia:         '🇧🇦',
  Qatar:          '🇶🇦',
  // Group C
  Brazil:         '🇧🇷',
  Morocco:        '🇲🇦',
  Haiti:          '🇭🇹',
  Scotland:       '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  // Group D
  USA:            '🇺🇸',
  Paraguay:       '🇵🇾',
  Australia:      '🇦🇺',
  Turkey:         '🇹🇷',
  // Group E
  Germany:        '🇩🇪',
  Ecuador:        '🇪🇨',
  'Ivory Coast':  '🇨🇮',
  Curacao:        '🇨🇼',
  // Group F
  Netherlands:    '🇳🇱',
  Japan:          '🇯🇵',
  Sweden:         '🇸🇪',
  Tunisia:        '🇹🇳',
  // Group G
  Belgium:        '🇧🇪',
  Egypt:          '🇪🇬',
  Iran:           '🇮🇷',
  'New Zealand':  '🇳🇿',
  // Group H
  Spain:          '🇪🇸',
  Uruguay:        '🇺🇾',
  'Saudi Arabia': '🇸🇦',
  'Cape Verde':   '🇨🇻',
  // Group I
  France:         '🇫🇷',
  Senegal:        '🇸🇳',
  Norway:         '🇳🇴',
  Iraq:           '🇮🇶',
  // Group J
  Argentina:      '🇦🇷',
  Austria:        '🇦🇹',
  Algeria:        '🇩🇿',
  Jordan:         '🇯🇴',
  // Group K
  Portugal:       '🇵🇹',
  Colombia:       '🇨🇴',
  Congo:          '🇨🇬',
  Uzbekistan:     '🇺🇿',
  // Group L
  England:        '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Croatia:        '🇭🇷',
  Ghana:          '🇬🇭',
  Panama:         '🇵🇦',
};

// ── Team name aliases ──────────────────────────────────────────────────────────
// API-Football sometimes uses different names. Map their names → our names.

const TEAM_ALIASES = {
  'United States':          'USA',
  'Korea Republic':         'South Korea',
  "Côte d'Ivoire":          'Ivory Coast',
  'Cote d\'Ivoire':         'Ivory Coast',
  'Bosnia and Herzegovina': 'Bosnia',
  'Bosnia & Herzegovina':   'Bosnia',
  'DR Congo':               'Congo',
  'Republic of Congo':      'Congo',
  'Türkiye':                'Turkey',
  'Czechia':                'Czechia',
  'Czech Republic':         'Czechia',
};

/** Normalize a team name from API-Football to our canonical name. */
function canonicalTeam(apiName) {
  return TEAM_ALIASES[apiName] ?? apiName;
}

// ── Data layer ─────────────────────────────────────────────────────────────────

class DataLayer {
  constructor() {
    this._apiBase     = 'https://api-football-v1.p.rapidapi.com/v3';
    this._gistApiBase = 'https://api.github.com/gists';
    this._source      = null; // 'live' | 'cached' | 'error'
  }

  /** Fetch all fixtures for the configured league/season. */
  async getMatches() {
    // 1. Try Gist cache
    const cached = await this._readGistCache();
    if (cached && !this._isCacheStale(cached.fetchedAt)) {
      this._source = 'cached';
      return cached.matches;
    }

    // 2. Try API-Football
    try {
      const matches = await this._fetchFromAPI();
      this._source = 'live';
      this._writeGistCache(matches).catch(console.warn);
      return matches;
    } catch (apiErr) {
      console.warn('API-Football fetch failed:', apiErr.message);
      if (cached) {
        this._source = 'cached';
        return cached.matches;
      }
      this._source = 'error';
      throw new Error('No data available: API failed and no cache found.');
    }
  }

  get source() { return this._source; }

  async _fetchFromAPI() {
    const res = await this._apiFetch(
      `/fixtures?league=${CONFIG.LEAGUE_ID}&season=${CONFIG.SEASON}`
    );
    return res.response;
  }

  async _apiFetch(path) {
    const res = await fetch(`${this._apiBase}${path}`, {
      headers: {
        'X-RapidAPI-Key':  CONFIG.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'api-football-v1.p.rapidapi.com',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`API-Football ${res.status}: ${body}`);
    }
    return res.json();
  }

  async _readGistCache() {
    if (!CONFIG.GIST_ID) return null;
    try {
      const res = await fetch(`${this._gistApiBase}/${CONFIG.GIST_ID}`, {
        headers: this._gistHeaders(),
      });
      if (!res.ok) return null;
      const gist = await res.json();
      const file = gist.files[CONFIG.GIST_FILENAME];
      if (!file) return null;
      return JSON.parse(file.content);
    } catch {
      return null;
    }
  }

  async _writeGistCache(matches) {
    if (!CONFIG.GIST_ID || !CONFIG.GITHUB_TOKEN) return;
    const payload = { fetchedAt: Date.now(), matches };
    await fetch(`${this._gistApiBase}/${CONFIG.GIST_ID}`, {
      method: 'PATCH',
      headers: { ...this._gistHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        files: {
          [CONFIG.GIST_FILENAME]: { content: JSON.stringify(payload, null, 2) },
        },
      }),
    });
  }

  _gistHeaders() {
    const h = { Accept: 'application/vnd.github+json' };
    if (CONFIG.GITHUB_TOKEN) h['Authorization'] = `Bearer ${CONFIG.GITHUB_TOKEN}`;
    return h;
  }

  _isCacheStale(fetchedAt) {
    return Date.now() - fetchedAt > CONFIG.CACHE_TTL_MS;
  }
}

// ── Scoring engine ─────────────────────────────────────────────────────────────

// Maps API-Football round strings → scoring keys
const ROUND_SCORING = {
  'round of 32':    'round_of_32',
  'round of 16':    'round_of_16',
  'quarter-finals': 'quarterfinal',
  'semi-finals':    'semifinal',
  'final':          'champion',
};

const FINISHED = new Set(['FT', 'AET', 'PEN']);

class ScoringEngine {
  constructor() {
    this._data    = new DataLayer();
    this._matches = [];
  }

  async init() {
    try {
      this._matches = await this._data.getMatches();
    } catch (err) {
      this._renderError(err.message);
      return;
    }

    this._updateStatusBar();
    this._renderMatches();
    this._renderLeaderboard();
  }

  /**
   * Calculate fantasy points for a single team across all matches.
   * Returns { total, breakdown } where breakdown is a label → pts map.
   */
  scoreTeam(teamName) {
    const breakdown = {};
    let total = 0;

    const add = (key, pts) => {
      if (!pts) return;
      total += pts;
      breakdown[key] = (breakdown[key] || 0) + pts;
    };

    const isTierB  = !TIER_A.has(teamName);
    let advancedFromGroup = false;

    for (const match of this._matches) {
      if (!FINISHED.has(match.fixture.status.short)) continue;

      const home = canonicalTeam(match.teams.home.name);
      const away = canonicalTeam(match.teams.away.name);
      if (home !== teamName && away !== teamName) continue;

      const round      = (match.league.round || '').toLowerCase();
      const isHome     = home === teamName;
      const homeGoals  = match.goals.home ?? 0;
      const awayGoals  = match.goals.away ?? 0;
      const teamGoals  = isHome ? homeGoals : awayGoals;
      const oppGoals   = isHome ? awayGoals : homeGoals;
      const teamWon    = teamGoals > oppGoals;
      const isDraw     = teamGoals === oppGoals;

      if (round.startsWith('group')) {
        if (teamWon) {
          add('group_win', SCORING.group_win);
          if (isTierB) add('tier_b_bonus', SCORING.group_win_bonus);
        } else if (isDraw) {
          add('group_draw', SCORING.group_draw);
        }
      } else {
        // Knockout stage — check for advancement
        advancedFromGroup = true;

        const scoreKey = ROUND_SCORING[round];
        if (scoreKey && teamWon) {
          // "champion" key means they won the final
          add(scoreKey, SCORING[scoreKey]);
        }
      }
    }

    // Advance-from-group bonus: awarded once if team appears in any knockout match
    if (advancedFromGroup) {
      add('group_advance', SCORING.group_advance);
    }

    return { total, breakdown };
  }

  /**
   * Calculate total points for a participant (sum of both teams).
   */
  scoreParticipant(name) {
    const teams = PARTICIPANTS[name];
    if (!teams) return { total: 0, teams: [] };

    const teamResults = teams.map(teamName => {
      const { total, breakdown } = this.scoreTeam(teamName);
      return { teamName, total, breakdown };
    });

    const total = teamResults.reduce((sum, t) => sum + t.total, 0);
    return { total, teams: teamResults };
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  _updateStatusBar() {
    const badge = document.getElementById('data-source');
    const ts    = document.getElementById('last-updated');
    badge.textContent = this._data.source === 'live' ? 'Live' : 'Cached';
    badge.className   = `badge ${this._data.source}`;
    ts.textContent    = `Updated ${new Date().toLocaleTimeString()}`;
  }

  _renderMatches() {
    const container = document.getElementById('matches-container');

    const relevant = this._matches
      .filter(m => FINISHED.has(m.fixture.status.short) ||
        ['1H','2H','HT','ET','BT','P','LIVE'].includes(m.fixture.status.short))
      .slice(-12)
      .reverse();

    if (!relevant.length) {
      container.innerHTML = '<p class="loading">No completed matches yet.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'matches-grid';

    for (const m of relevant) {
      const isLive    = !FINISHED.has(m.fixture.status.short);
      const home      = canonicalTeam(m.teams.home.name);
      const away      = canonicalTeam(m.teams.away.name);
      const homeFlag  = TEAM_FLAGS[home] || '';
      const awayFlag  = TEAM_FLAGS[away] || '';
      const homeGoals = m.goals.home ?? '–';
      const awayGoals = m.goals.away ?? '–';
      const dateStr   = new Date(m.fixture.date).toLocaleDateString();
      const statusStr = isLive
        ? `<span class="status-live">${m.fixture.status.elapsed}'</span>`
        : m.fixture.status.long;

      const card = document.createElement('div');
      card.className = `match-card${isLive ? ' live' : ''}`;
      card.innerHTML = `
        <div class="teams">
          <span>${homeFlag} ${home}</span>
          <span class="score-line">${homeGoals} – ${awayGoals}</span>
          <span>${away} ${awayFlag}</span>
        </div>
        <div class="meta">
          <span>${dateStr}</span>
          <span>${statusStr}</span>
        </div>
      `;
      grid.appendChild(card);
    }

    container.innerHTML = '';
    container.appendChild(grid);
  }

  _renderLeaderboard() {
    const standings = Object.keys(PARTICIPANTS).map(name => {
      const result = this.scoreParticipant(name);
      return { name, ...result };
    }).sort((a, b) => b.total - a.total);

    renderLeaderboard(standings);
  }

  _renderError(msg) {
    const badge = document.getElementById('data-source');
    badge.textContent = 'Error';
    badge.className   = 'badge error';
    document.getElementById('leaderboard-container').innerHTML =
      `<p class="error-msg">${msg}</p>`;
    document.getElementById('matches-container').innerHTML =
      `<p class="error-msg">${msg}</p>`;
  }
}
