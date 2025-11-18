import { useEffect, useMemo, useState } from 'react';
import './App.css';

const SUMMARY_FIELDS = [
  { label: 'Leetify Rating', paths: [['leetifyRating'], ['stats', 'leetifyRating'], ['overall', 'leetifyRating']] },
  { label: 'K/D Ratio', paths: [['kdRatio'], ['stats', 'kdRatio'], ['lifetime', 'kdRatio'], ['stats', 'kd']] },
  { label: 'Win %', paths: [['winRate'], ['stats', 'winRate'], ['lifetime', 'winRate']] },
  { label: 'HS %', paths: [['headshotPercentage'], ['stats', 'headshotPercentage'], ['stats', 'hsPercent']] },
  { label: 'ADR', paths: [['adr'], ['stats', 'adr'], ['lifetime', 'adr']] },
  { label: 'Matches Played', paths: [['matches'], ['stats', 'matches'], ['lifetime', 'matchesPlayed']] },
];

const ensurePath = (value = '') => {
  if (!value) return '';
  if (value.startsWith('http')) {
    try {
      return new URL(value).pathname.replace(/\/$/, '');
    } catch (error) {
      return value;
    }
  }
  return value.replace(window.location.origin, '').replace(/\/$/, '').replace(/^\//, '');
};

const getBasePath = () => {
  const base = ensurePath(process.env.PUBLIC_URL || '');
  return base === '/' ? '' : base;
};

const parseSteamIdFromPath = () => {
  const base = getBasePath();
  let relativePath = window.location.pathname;
  if (base && relativePath.startsWith(`/${base}`)) {
    relativePath = relativePath.slice(base.length + 1);
  }
  if (base && !relativePath.startsWith('/') && window.location.pathname.startsWith(base)) {
    relativePath = window.location.pathname.slice(base.length);
  }
  return relativePath.replace(/^\/+|\/+$/g, '');
};

const updatePathWithSteamId = (steamId) => {
  const base = getBasePath();
  const segments = [''];
  if (base) segments.push(base);
  if (steamId) segments.push(steamId);
  const nextPath = segments.join('/').replace(/\/+/g, '/');
  window.history.replaceState({}, '', nextPath || '/');
};

const findValue = (data, paths) => {
  if (!data) return undefined;
  for (const path of paths) {
    let current = data;
    let found = true;
    for (const key of path) {
      if (current !== null && typeof current === 'object' && Object.prototype.hasOwnProperty.call(current, key)) {
        current = current[key];
      } else {
        found = false;
        break;
      }
    }
    if (found && current !== undefined && current !== null) {
      return current;
    }
  }
  return undefined;
};

const extractMatches = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.recentMatches)) return payload.recentMatches;
  if (Array.isArray(payload.matches)) return payload.matches;
  if (payload.matches && Array.isArray(payload.matches.docs)) return payload.matches.docs;
  if (payload.stats && Array.isArray(payload.stats.recentMatches)) return payload.stats.recentMatches;
  return [];
};

const buildLeetifyUrl = (steamId) => {
  if (!steamId) return null;
  const configured = (process.env.REACT_APP_LEETIFY_API_URL || '').trim();
  if (configured) {
    if (configured.includes('{steamId}')) {
      return configured.replace('{steamId}', steamId);
    }
    const normalized = configured.replace(/\/$/, '');
    return `${normalized}/${steamId}`;
  }
  return `https://api.leetify.com/api/stats/users/${steamId}`;
};

function App() {
  const [steamIdInput, setSteamIdInput] = useState(() => parseSteamIdFromPath());
  const [activeSteamId, setActiveSteamId] = useState(() => parseSteamIdFromPath());
  const [playerData, setPlayerData] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSteamIdInput(activeSteamId);
    updatePathWithSteamId(activeSteamId);
  }, [activeSteamId]);

  useEffect(() => {
    if (!activeSteamId) {
      setPlayerData(null);
      setRecentMatches([]);
      setError('');
      return undefined;
    }

    const controller = new AbortController();
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError('');
        const url = buildLeetifyUrl(activeSteamId);
        const headers = { Accept: 'application/json' };
        if (process.env.REACT_APP_LEETIFY_API_KEY) {
          headers.Authorization = `Bearer ${process.env.REACT_APP_LEETIFY_API_KEY}`;
        }
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Leetify API responded with ${response.status}`);
        }
        const payload = await response.json();
        setPlayerData(payload);
        setRecentMatches(extractMatches(payload));
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') return;
        setError(fetchError.message || 'Unable to load player stats');
        setPlayerData(null);
        setRecentMatches([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    return () => controller.abort();
  }, [activeSteamId]);

  const summaryStats = useMemo(() => {
    if (!playerData) return [];
    return SUMMARY_FIELDS.map((field) => {
      const value = findValue(playerData, field.paths);
      if (value === undefined || value === null) return null;
      const formattedValue = typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : value;
      return {
        label: field.label,
        value: formattedValue,
      };
    }).filter(Boolean);
  }, [playerData]);

  const playerName = useMemo(
    () =>
      findValue(playerData, [
        ['player', 'name'],
        ['player', 'nickname'],
        ['profile', 'name'],
        ['profile', 'steamName'],
        ['steamName'],
      ]) || activeSteamId,
    [playerData, activeSteamId],
  );

  const matchesToDisplay = useMemo(() => {
    if (!recentMatches || !recentMatches.length) return [];
    return recentMatches.slice(0, 5);
  }, [recentMatches]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = steamIdInput.trim();
    setActiveSteamId(trimmed);
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Leetify API powered</p>
          <h1>Steam player lookup</h1>
          <p>
            Deploy this page to GitHub Pages (or any static host) and open{' '}
            <code>https://&lt;your-domain&gt;/STEAM_ID</code> to instantly load stats for that Steam user.
          </p>
        </div>
      </header>

      <section className="panel">
        <form className="lookup-form" onSubmit={handleSubmit}>
          <label htmlFor="steamId">Steam ID (64-bit)</label>
          <div className="input-row">
            <input
              id="steamId"
              name="steamId"
              type="text"
              placeholder="7656119..."
              value={steamIdInput}
              onChange={(event) => setSteamIdInput(event.target.value)}
            />
            <button type="submit" disabled={!steamIdInput.trim()}>
              Load stats
            </button>
          </div>
          <p className="help-text">
            Tip: navigate straight to <code>/{'{steamId}'}</code> after deploying and the page will fetch automatically.
          </p>
        </form>
      </section>

      {loading && (
        <section className="panel status">
          <p>Loading stats for {activeSteamId}...</p>
        </section>
      )}

      {error && (
        <section className="panel error">
          <p>{error}</p>
          <p>
            Make sure your <code>REACT_APP_LEETIFY_API_KEY</code> (if required) is configured for the build and that the Steam ID is
            valid.
          </p>
        </section>
      )}

      {!activeSteamId && (
        <section className="panel info">
          <p>Enter a Steam ID above or append it to the URL to see Leetify data.</p>
        </section>
      )}

      {playerData && !loading && !error && (
        <section className="panel stats">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Player overview</p>
              <h2>{playerName}</h2>
              <p className="steam-link">
                Steam ID: <code>{activeSteamId}</code>
              </p>
            </div>
          </div>

          {summaryStats.length > 0 ? (
            <div className="stat-grid">
              {summaryStats.map((stat) => (
                <div key={stat.label} className="stat-card">
                  <p className="stat-label">{stat.label}</p>
                  <p className="stat-value">{stat.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No summary metrics available in the API response.</p>
          )}
        </section>
      )}

      {matchesToDisplay.length > 0 && (
        <section className="panel">
          <p className="eyebrow">Recent matches</p>
          <ul className="match-list">
            {matchesToDisplay.map((match, index) => {
              const title = match.map || match.mapName || match.name || match.match || `Match ${index + 1}`;
              const result = match.result || match.outcome || match.matchResult;
              const kd = match.kd || match.kdRatio || match.killsDeaths;
              const rating = match.rating || match.leetifyRating || match.score;
              return (
                <li key={match.id || match.matchId || index} className="match">
                  <div>
                    <p className="match-title">{title}</p>
                    <p className="match-meta">
                      {match.date && <span>{new Date(match.date).toLocaleDateString()}</span>}
                      {kd && <span>K/D: {kd}</span>}
                      {rating && <span>Rating: {rating}</span>}
                    </p>
                  </div>
                  {result && <span className={`pill ${result.toString().toLowerCase()}`}>{result}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {playerData && (
        <section className="panel raw">
          <details>
            <summary>Raw API response</summary>
            <pre>{JSON.stringify(playerData, null, 2)}</pre>
          </details>
        </section>
      )}
    </div>
  );
}

export default App;
