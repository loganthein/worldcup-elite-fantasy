// !! This file is gitignored. Fill in real values here. !!
// See config.example.js for documentation on each key.

const CONFIG = {
  RAPIDAPI_KEY:          '4935100a31fe078e09fc7fbfff2cfc1b',
  RAPIDAPI_HOST:         'api-football-v1.p.rapidapi.com',

  WC_LEAGUE_ID:          1,
  WC_SEASON:             2026,

  GIST_ID:               '935c07fbd48d4adff60dec07ba2f3218',
  GIST_PAT:              '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',
  GIST_FILENAME:         'worldcup-matches.json',

  CACHE_TTL_LIVE_MS:     5  * 60 * 1000,
  CACHE_TTL_IDLE_MS:     60 * 60 * 1000,
  CACHE_TTL_STANDINGS:   10 * 60 * 1000,

  ADMIN_PASSWORD:        '',
  APP_TITLE:             '2026 World Cup Fantasy',
  SITE_URL:              'https://loganthein.github.io/worldcup-elite-fantasy/',
};

if (typeof module !== 'undefined') module.exports = CONFIG;
