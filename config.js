// !! This file is gitignored. Fill in real values here. !!
// See config.example.js for documentation on each key.

const CONFIG = {
  RAPIDAPI_KEY:   '4935100a31fe078e09fc7fbfff2cfc1b',
  GITHUB_TOKEN:   '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',
  GIST_ID:        '935c07fbd48d4adff60dec07ba2f3218',
  GIST_FILENAME:  'worldcup-matches.json',
  LEAGUE_ID:      1,
  SEASON:         2026,
  CACHE_TTL_MS:   5 * 60 * 1000,
};

// ── Your fantasy league roster ─────────────────────────────────────────────────
// Add one object per league participant.
// picks[].position: G = Goalkeeper, D = Defender, M = Midfielder, F = Forward
// picks[].name must match the player name returned by API-Football exactly.

const ROSTER = [
  {
    teamName: 'Team Alpha',
    picks: [
      { name: 'Emiliano Martínez', position: 'G' },
      { name: 'Achraf Hakimi',     position: 'D' },
      { name: 'Pedri',             position: 'M' },
      { name: 'Kylian Mbappé',     position: 'F' },
      { name: 'Erling Haaland',    position: 'F' },
    ],
  },
  {
    teamName: 'Team Beta',
    picks: [
      { name: 'Alisson Becker',    position: 'G' },
      { name: 'Virgil van Dijk',   position: 'D' },
      { name: 'Jude Bellingham',   position: 'M' },
      { name: 'Lionel Messi',      position: 'F' },
      { name: 'Vinicius Junior',   position: 'F' },
    ],
  },
];
