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

// ── Team name map ──────────────────────────────────────────────────────────────
// API-Football name → our canonical name.
// Only entries that differ need to be listed.

const NAME_MAP = {
  // USA
  'United States':            'USA',
  'United States of America': 'USA',
  // South Korea
  'Korea Republic':           'South Korea',
  'Republic of Korea':        'South Korea',
  // Ivory Coast
  "Côte d'Ivoire":            'Ivory Coast',
  "Cote d'Ivoire":            'Ivory Coast',
  'Côte D\'Ivoire':           'Ivory Coast',
  // Bosnia
  'Bosnia and Herzegovina':   'Bosnia',
  'Bosnia & Herzegovina':     'Bosnia',
  // Congo
  'DR Congo':                 'Congo',
  'Congo DR':                 'Congo',
  'Republic of Congo':        'Congo',
  'Congo Republic':           'Congo',
  // Turkey
  'Türkiye':                  'Turkey',
  // Czechia
  'Czech Republic':           'Czechia',
  // Scotland / England (sometimes returned as full GB names)
  'Scotland (GB-SCT)':        'Scotland',
  'England (GB-ENG)':         'England',
  // Cape Verde
  'Cape Verde Islands':       'Cape Verde',
  // New Zealand
  'New-Zealand':              'New Zealand',
  // Saudi Arabia
  'Saudi-Arabia':             'Saudi Arabia',
  // South Africa
  'South-Africa':             'South Africa',
  // South Korea (alternate hyphenated form)
  'South-Korea':              'South Korea',
};

/** Normalize an API-Football team name to our canonical name. */
function canonicalTeam(apiName) {
  return NAME_MAP[apiName] ?? apiName;
}

// ── Round parser ───────────────────────────────────────────────────────────────
// Maps API-Football league.round strings → internal round keys.

function parseRound(apiRound) {
  const r = (apiRound || '').toLowerCase().trim();
  if (r.startsWith('group'))   return 'group';
  if (r === 'round of 32')     return 'round_of_32';
  if (r === 'round of 16')     return 'round_of_16';
  if (r === 'quarter-finals' || r === 'quarterfinals') return 'quarterfinal';
  if (r === 'semi-finals'    || r === 'semifinals')    return 'semifinal';
  if (r === 'final')           return 'final';
  return r; // pass-through for anything unexpected
}

// ── Live status helpers ────────────────────────────────────────────────────────

const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN']);
const LIVE_STATUSES     = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE']);

function isFinished(status) { return FINISHED_STATUSES.has(status); }
function isLive(status)     { return LIVE_STATUSES.has(status); }

// ── Data layer ─────────────────────────────────────────────────────────────────

const LS_MATCHES_KEY   = 'wc_matches_cache';
const LS_STANDINGS_KEY = 'wc_standings_cache';

// Cache TTLs in ms
const TTL_LIVE    = 5  * 60 * 1000;  //  5 min — when a match is in progress
const TTL_IDLE    = 60 * 60 * 1000;  // 60 min — between matches
const TTL_STANDINGS = 10 * 60 * 1000; // 10 min

class DataLayer {
  constructor() {
    this._apiBase     = 'https://api-football-v1.p.rapidapi.com/v3';
    this._gistApiBase = 'https://api.github.com/gists';
    this.source       = null; // 'live' | 'local-cache' | 'gist-cache' | 'error'
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Fetch all fixtures for the configured league/season.
   * Returns an array of parsed match objects (see parseResults).
   *
   * Cache strategy:
   *   1. localStorage — fresh if under TTL_LIVE (any live match) or TTL_IDLE
   *   2. API-Football — on cache miss
   *   3. Gist — silent fallback if API fails
   */
  async fetchMatches() {
    const local = this._lsRead(LS_MATCHES_KEY);

    if (local) {
      const ttl = local.data.some(m => isLive(m.status)) ? TTL_LIVE : TTL_IDLE;
      if (!this._isStale(local.fetchedAt, ttl)) {
        this.source = 'local-cache';
        return local.data;
      }
    }

    // Try API
    try {
      const raw     = await this._apiFetch(`/fixtures?league=${CONFIG.LEAGUE_ID}&season=${CONFIG.SEASON}`);
      const parsed  = this.parseResults(raw.response);
      this.source   = 'live';
      this._lsWrite(LS_MATCHES_KEY, parsed);
      this._writeGistCache(parsed).catch(console.warn); // fire-and-forget
      return parsed;
    } catch (err) {
      console.warn('fetchMatches API error:', err.message);
    }

    // Fallback: stale localStorage
    if (local) {
      this.source = 'local-cache';
      return local.data;
    }

    // Fallback: Gist
    const gist = await this._readGistCache();
    if (gist) {
      this.source = 'gist-cache';
      return gist;
    }

    this.source = 'error';
    throw new Error('No match data available — API failed and no cache found.');
  }

  /**
   * Fetch group standings for the configured league/season.
   * Returns the raw API-Football standings response array.
   * Cached in localStorage for TTL_STANDINGS.
   */
  async fetchStandings() {
    const local = this._lsRead(LS_STANDINGS_KEY);
    if (local && !this._isStale(local.fetchedAt, TTL_STANDINGS)) {
      return local.data;
    }

    try {
      const res  = await this._apiFetch(`/standings?league=${CONFIG.LEAGUE_ID}&season=${CONFIG.SEASON}`);
      const data = res.response;
      this._lsWrite(LS_STANDINGS_KEY, data);
      return data;
    } catch (err) {
      console.warn('fetchStandings API error:', err.message);
      return local ? local.data : null;
    }
  }

  /**
   * Convert raw API-Football fixture objects into our internal format:
   *
   * {
   *   matchId:    number,
   *   homeTeam:   string,   — canonical team name
   *   awayTeam:   string,
   *   homeScore:  number | null,
   *   awayScore:  number | null,
   *   status:     string,   — 'NS' | '1H' | 'HT' | '2H' | 'FT' | 'AET' | 'PEN' | …
   *   statusLong: string,   — "Match Finished" | "First Half" | …
   *   elapsed:    number | null,
   *   round:      string,   — 'group' | 'round_of_32' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'final'
   *   date:       string,   — ISO 8601
   * }
   */
  parseResults(fixtures) {
    return fixtures.map(f => ({
      matchId:    f.fixture.id,
      homeTeam:   canonicalTeam(f.teams.home.name),
      awayTeam:   canonicalTeam(f.teams.away.name),
      homeScore:  f.goals.home  ?? null,
      awayScore:  f.goals.away  ?? null,
      status:     f.fixture.status.short,
      statusLong: f.fixture.status.long,
      elapsed:    f.fixture.status.elapsed ?? null,
      round:      parseRound(f.league.round),
      date:       f.fixture.date,
    }));
  }

  // ── Private: HTTP ──────────────────────────────────────────────────────────

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

  // ── Private: localStorage cache ────────────────────────────────────────────

  _lsRead(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _lsWrite(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch {
      // Ignore storage errors (private browsing quota, etc.)
    }
  }

  // ── Private: Gist cache (cross-device fallback) ────────────────────────────

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
      const payload = JSON.parse(file.content);
      // Gist stores already-parsed matches
      return payload.matches ?? null;
    } catch {
      return null;
    }
  }

  async _writeGistCache(parsedMatches) {
    if (!CONFIG.GIST_ID || !CONFIG.GITHUB_TOKEN) return;
    const payload = { fetchedAt: Date.now(), matches: parsedMatches };
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

  _isStale(fetchedAt, ttl) {
    return Date.now() - fetchedAt > ttl;
  }
}

// ── Scoring engine ─────────────────────────────────────────────────────────────

const ROUND_SCORE_KEY = {
  round_of_32:  'round_of_32',
  round_of_16:  'round_of_16',
  quarterfinal: 'quarterfinal',
  semifinal:    'semifinal',
  final:        'champion',
};

class ScoringEngine {
  constructor() {
    this._data    = new DataLayer();
    this._matches = []; // parsed match objects
  }

  async init() {
    try {
      this._matches = await this._data.fetchMatches();
    } catch (err) {
      this._renderError(err.message);
      return;
    }

    this._updateStatusBar();
    this._renderMatches();
    this._renderLeaderboard();
  }

  /**
   * Calculate fantasy points for a single team across all finished matches.
   * Returns { total, breakdown } — breakdown is label → cumulative pts.
   */
  scoreTeam(teamName) {
    const breakdown = {};
    let total = 0;
    let advancedFromGroup = false;
    const isTierB = !TIER_A.has(teamName);

    const add = (key, pts) => {
      if (!pts) return;
      total += pts;
      breakdown[key] = (breakdown[key] || 0) + pts;
    };

    for (const m of this._matches) {
      if (!isFinished(m.status)) continue;
      if (m.homeTeam !== teamName && m.awayTeam !== teamName) continue;

      const teamScore = m.homeTeam === teamName ? m.homeScore : m.awayScore;
      const oppScore  = m.homeTeam === teamName ? m.awayScore : m.homeScore;
      const won  = teamScore > oppScore;
      const draw = teamScore === oppScore;

      if (m.round === 'group') {
        if (won) {
          add('group_win', SCORING.group_win);
          if (isTierB) add('tier_b_bonus', SCORING.group_win_bonus);
        } else if (draw) {
          add('group_draw', SCORING.group_draw);
        }
      } else {
        // First knockout appearance = advanced from group
        advancedFromGroup = true;
        const scoreKey = ROUND_SCORE_KEY[m.round];
        if (scoreKey && won) add(scoreKey, SCORING[scoreKey]);
      }
    }

    if (advancedFromGroup) add('group_advance', SCORING.group_advance);

    return { total, breakdown };
  }

  /**
   * Calculate total points for a participant (sum of both teams).
   * Returns { total, teams: [{ teamName, total, breakdown }] }
   */
  scoreParticipant(name) {
    const teams = PARTICIPANTS[name];
    if (!teams) return { total: 0, teams: [] };

    const teamResults = teams.map(teamName => {
      const { total, breakdown } = this.scoreTeam(teamName);
      return { teamName, total, breakdown };
    });

    return {
      total: teamResults.reduce((s, t) => s + t.total, 0),
      teams: teamResults,
    };
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  _updateStatusBar() {
    const badge = document.getElementById('data-source');
    const ts    = document.getElementById('last-updated');

    const labels = { live: 'Live', 'local-cache': 'Cached', 'gist-cache': 'Gist Cache' };
    badge.textContent = labels[this._data.source] ?? this._data.source;
    badge.className   = `badge ${this._data.source === 'live' ? 'live' : 'cached'}`;
    ts.textContent    = `Updated ${new Date().toLocaleTimeString()}`;
  }

  _renderMatches() {
    const container = document.getElementById('matches-container');

    const relevant = this._matches
      .filter(m => isFinished(m.status) || isLive(m.status))
      .slice(-12)
      .reverse();

    if (!relevant.length) {
      container.innerHTML = '<p class="loading">No completed matches yet.</p>';
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'matches-grid';

    for (const m of relevant) {
      const live      = isLive(m.status);
      const homeFlag  = TEAM_FLAGS[m.homeTeam] || '';
      const awayFlag  = TEAM_FLAGS[m.awayTeam] || '';
      const homeGoals = m.homeScore ?? '–';
      const awayGoals = m.awayScore ?? '–';
      const dateStr   = new Date(m.date).toLocaleDateString();
      const statusStr = live
        ? `<span class="status-live">${m.elapsed}'</span>`
        : m.statusLong;

      const card = document.createElement('div');
      card.className = `match-card${live ? ' live' : ''}`;
      card.innerHTML = `
        <div class="teams">
          <span>${homeFlag} ${m.homeTeam}</span>
          <span class="score-line">${homeGoals} – ${awayGoals}</span>
          <span>${m.awayTeam} ${awayFlag}</span>
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
    const standings = Object.keys(PARTICIPANTS).map(name => ({
      name,
      ...this.scoreParticipant(name),
    })).sort((a, b) => b.total - a.total);

    renderLeaderboard(standings);
  }

  _renderError(msg) {
    document.getElementById('data-source').textContent = 'Error';
    document.getElementById('data-source').className   = 'badge error';
    document.getElementById('leaderboard-container').innerHTML =
      `<p class="error-msg">${msg}</p>`;
    document.getElementById('matches-container').innerHTML =
      `<p class="error-msg">${msg}</p>`;
  }
}
