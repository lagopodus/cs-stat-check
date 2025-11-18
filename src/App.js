import { useEffect, useMemo, useState } from 'react';
import './App.css';

const friendlyLabel = (key = '') =>
  key
    .replace(/_/g, ' ')
    .replace(/\bct\b/gi, 'CT')
    .replace(/\bt\b/gi, 'T')
    .replace(/\bcs\b/gi, 'CS')
    .replace(/\bleetify\b/i, 'Leetify')
    .replace(/\belo\b/i, 'ELO')
    .replace(/\b([a-z])(\w*)/gi, (_, first, rest) => `${first.toUpperCase()}${rest.toLowerCase()}`)
    .trim();

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
};

const formatRatioPercent = (ratio) => {
  if (ratio === null || ratio === undefined) return '—';
  return formatPercent(ratio * 100);
};

const formatNumber = (value) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const severityScores = { safe: 20, watch: 60, alert: 95 };
const getSusScore = (status, overrides = {}) => {
  const base = severityScores[status] ?? 50;
  if (overrides.max) return Math.min(overrides.max, base);
  if (overrides.min) return Math.max(overrides.min, base);
  if (overrides.value !== undefined) return overrides.value;
  return base;
};

const buildIntegritySignals = (playerData) => {
  if (!playerData) return [];
  const signals = [];
  const pushSignal = (payload) => signals.push({ ...payload, susScore: getSusScore(payload.status, payload.susScoreOverrides) });

  if (typeof playerData.winrate === 'number') {
    const winPercent = playerData.winrate * 100;
    let status = 'safe';
    let detail = 'Within normal win patterns.';
    if (winPercent >= 70) {
      status = 'alert';
      detail = 'Extremely high winrate. Review POVs/demos.';
    } else if (winPercent >= 60) {
      status = 'watch';
      detail = 'Above average winrate. Keep an eye on consistency.';
    }
    const susScoreOverrides = winPercent >= 70 ? { value: 100 } : winPercent >= 60 ? { min: 70 } : {};
    pushSignal({ label: 'Winrate', value: formatPercent(winPercent), status, detail, susScoreOverrides });
  }

  const aim = playerData.rating?.aim;
  if (typeof aim === 'number') {
    let status = 'safe';
    let detail = 'Tracking looks human.';
    if (aim >= 75) {
      status = 'watch';
      detail = 'Very strong mechanical aim.';
    }
    if (aim >= 85) {
      status = 'alert';
      detail = 'Pro-level aim spikes. Check for suspicious vods.';
    }
    const susScoreOverrides = aim >= 90 ? { value: 100 } : aim >= 80 ? { min: 75 } : {};
    pushSignal({ label: 'Aim rating', value: aim.toFixed(1), status, detail, susScoreOverrides });
  }

  const reaction = playerData.stats?.reaction_time_ms;
  if (typeof reaction === 'number') {
    let status = 'safe';
    let detail = 'Reaction time is realistic.';
    if (reaction <= 250) {
      status = 'watch';
      detail = 'Unusually fast reactions. Compare across matches.';
    }
    if (reaction <= 200) {
      status = 'alert';
      detail = 'Borderline impossible reaction speed.';
    }
    const susScoreOverrides = reaction <= 200 ? { value: 100 } : reaction <= 250 ? { min: 70 } : {};
    pushSignal({ label: 'Reaction time', value: `${reaction.toFixed(0)} ms`, status, detail, susScoreOverrides });
  }

  const headAccuracy = playerData.stats?.accuracy_head;
  if (typeof headAccuracy === 'number') {
    let status = 'safe';
    let detail = 'Headshot ratio in expected range.';
    if (headAccuracy >= 30) {
      status = 'watch';
      detail = 'High headshot rate—check rifle rounds.';
    }
    if (headAccuracy >= 45) {
      status = 'alert';
      detail = 'Headshot rate far above average.';
    }
    const susScoreOverrides = headAccuracy >= 45 ? { value: 100 } : headAccuracy >= 30 ? { min: 70 } : {};
    pushSignal({ label: 'Head accuracy', value: formatPercent(headAccuracy), status, detail, susScoreOverrides });
  }

  const bans = Array.isArray(playerData.bans) ? playerData.bans.length : 0;
  pushSignal({
    label: 'Ban history',
    value: bans ? `${bans} ban${bans > 1 ? 's' : ''}` : 'Clean',
    status: bans ? 'alert' : 'safe',
    detail: bans ? 'Existing bans are a huge red flag.' : 'No bans reported by Leetify.',
    susScoreOverrides: bans ? { value: Math.min(100, 70 + bans * 15) } : { value: 10 },
  });

  return signals;
};

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
  const encode = encodeURIComponent;
  if (configured) {
    if (configured.includes('{steamId}')) {
      return configured.replace('{steamId}', steamId);
    }
    const hasQuery = configured.includes('?');
    const needsAmpersand = hasQuery && !configured.endsWith('?') && !configured.endsWith('&');
    const separator = hasQuery ? (needsAmpersand ? '&' : '') : '?';
    return `${configured}${separator}steam64_id=${encode(steamId)}`;
  }
  return `https://api-public.cs-prod.leetify.com/v3/profile?steam64_id=${encode(steamId)}`;
};

function App() {
  const [steamIdInput, setSteamIdInput] = useState(() => parseSteamIdFromPath());
  const [activeSteamId, setActiveSteamId] = useState(() => parseSteamIdFromPath());
  const [playerData, setPlayerData] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showMechanics, setShowMechanics] = useState(false);

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

  useEffect(() => {
    setShowMechanics(false);
  }, [playerData]);

  const playerName = useMemo(
    () =>
      findValue(playerData, [
        ['name'],
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

  const overviewMetrics = useMemo(() => {
    if (!playerData) return [];
    const metrics = [
      { label: 'Privacy mode', value: friendlyLabel(playerData.privacy_mode) || '—' },
      { label: 'Win rate', value: formatRatioPercent(playerData.winrate) },
      { label: 'Matches tracked', value: formatNumber(playerData.total_matches) },
      { label: 'First tracked match', value: formatDate(playerData.first_match_date) },
      { label: 'Steam ID', value: playerData.steam64_id || activeSteamId },
      { label: 'Leetify profile ID', value: playerData.id },
    ];
    return metrics.filter((metric) => metric.value !== undefined && metric.value !== null && metric.value !== '—' && metric.value !== '');
  }, [playerData, activeSteamId]);

  const ratingMetrics = useMemo(() => {
    if (!playerData || !playerData.rating) return [];
    const order = ['aim', 'positioning', 'utility', 'clutch', 'opening', 'ct_leetify', 't_leetify'];
    const metrics = order
      .filter((key) => playerData.rating[key] !== undefined)
      .map((key) => ({ label: friendlyLabel(key), value: playerData.rating[key].toFixed(2) }));
    const remaining = Object.entries(playerData.rating)
      .filter(([key]) => !order.includes(key))
      .map(([key, value]) => ({ label: friendlyLabel(key), value: typeof value === 'number' ? value.toFixed(2) : value }));
    return [...metrics, ...remaining];
  }, [playerData]);

  const statMetrics = useMemo(() => {
    if (!playerData || !playerData.stats) return [];
    const keys = [
      'accuracy_enemy_spotted',
      'accuracy_head',
      'spray_accuracy',
      'preaim',
      'reaction_time_ms',
      'counter_strafing_good_shots_ratio',
      'flashbang_hit_foe_per_flashbang',
      'flashbang_hit_friend_per_flashbang',
      'flashbang_leading_to_kill',
      'he_foes_damage_avg',
      'he_friends_damage_avg',
      'utility_on_death_avg',
      'trade_kill_opportunities_per_round',
      'trade_kills_success_percentage',
      'traded_deaths_success_percentage',
      'ct_opening_aggression_success_rate',
      'ct_opening_duel_success_percentage',
      't_opening_aggression_success_rate',
      't_opening_duel_success_percentage',
    ];
    return keys
      .filter((key) => playerData.stats[key] !== undefined)
      .map((key) => {
        const rawValue = playerData.stats[key];
        const isPercentage = /percentage|rate|ratio|accuracy|per_round|per_flashbang/i.test(key);
        let value;
        if (typeof rawValue === 'number') {
          if (/(_ms)$/i.test(key)) {
            value = `${rawValue.toFixed(0)} ms`;
          } else if (isPercentage) {
            value = formatPercent(rawValue);
          } else {
            value = rawValue.toFixed(3).replace(/\.000$/, '');
          }
        } else {
          value = rawValue;
        }
        return { label: friendlyLabel(key), value };
      });
  }, [playerData]);

  const rankMetrics = useMemo(() => {
    if (!playerData || !playerData.ranks) return [];
    const rankKeys = ['leetify', 'premier', 'faceit', 'faceit_elo', 'wingman', 'renown'];
    return rankKeys
      .filter((key) => playerData.ranks[key] !== undefined)
      .map((key) => ({ label: friendlyLabel(key), value: formatNumber(playerData.ranks[key]) }));
  }, [playerData]);

  const mapRanks = useMemo(() => {
    if (!playerData || !Array.isArray(playerData.ranks?.competitive)) return [];
    return playerData.ranks.competitive.filter((item) => item.map_name);
  }, [playerData]);

  const integritySignals = useMemo(() => buildIntegritySignals(playerData), [playerData]);

  const bans = useMemo(() => ({
    list: Array.isArray(playerData?.bans) ? playerData.bans : [],
    count: Array.isArray(playerData?.bans) ? playerData.bans.length : 0,
  }), [playerData]);

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
          <h1>Steam integrity scanner</h1>
          <p>
            Drop a Steam ID in the URL (<code>/{'{steam64_id}'}</code>) and we will pull every public Leetify signal so you can
            spot suspicious performance spikes before queueing.
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
            Tip: navigate straight to <code>/{'{steamId}'}</code> after deploying and the page will fetch automatically so you
            can share "is this guy legit?" links.
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
            Make sure the Steam ID is valid and, if you are proxying through your own endpoint, that any required credentials are
            configured for the build.
          </p>
        </section>
      )}

      {!activeSteamId && (
        <section className="panel info">
          <p>Enter a Steam ID above or append it to the URL to see Leetify data.</p>
        </section>
      )}

      {playerData && !loading && !error && (
        <>
          {integritySignals.length > 0 && (
            <section className="panel integrity">
              <p className="eyebrow">Cheat radar</p>
              <p className="muted">Automated heuristics to highlight suspicious trends.</p>
              <div className="signal-grid">
                {integritySignals.map((signal) => (
                  <div key={signal.label} className={`signal-card ${signal.status}`}>
                    <div className="signal-heading">
                      <p className="metric-label">{signal.label}</p>
                      <span className={`pill ${signal.status}`}>{signal.status}</span>
                    </div>
                    <p className="metric-value">{signal.value}</p>
                    <div className="sus-meter" aria-label={`Suspicion score ${signal.susScore} out of 100`}>
                      <div className="sus-meter-track">
                        <div className="sus-meter-fill" style={{ width: `${signal.susScore}%` }} />
                      </div>
                      <span>{signal.susScore}/100 sus</span>
                    </div>
                    <p className="signal-detail">{signal.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="panel stats overview">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Player overview</p>
                <h2>{playerName}</h2>
                <p className="steam-link">
                  Steam ID: <code>{playerData.steam64_id || activeSteamId}</code>
                </p>
              </div>
              {playerData.privacy_mode && <span className="pill neutral">{friendlyLabel(playerData.privacy_mode)}</span>}
            </div>

            {overviewMetrics.length > 0 ? (
              <div className="metric-grid">
                {overviewMetrics.map((metric) => (
                  <div key={metric.label} className="metric-card">
                    <p className="metric-label">{metric.label}</p>
                    <p className="metric-value">{metric.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No overview metrics available in the API response.</p>
            )}
          </section>

          <section className={`panel bans ${bans.count ? 'alert' : 'success'}`}>
            <p className="eyebrow">Ban check</p>
            {bans.count ? (
              <div>
                <h3>{bans.count} ban{bans.count > 1 ? 's' : ''} reported</h3>
                <p>Review the raw payload below for ban details before trusting this account.</p>
              </div>
            ) : (
              <div>
                <h3>No bans detected</h3>
                <p>Leetify has not flagged this account with VAC, game, or third-party bans.</p>
              </div>
            )}
          </section>

          {rankMetrics.length > 0 && (
            <section className="panel ranks">
              <p className="eyebrow">Global ranks</p>
              <div className="metric-grid">
                {rankMetrics.map((rank) => (
                  <div key={rank.label} className="metric-card">
                    <p className="metric-label">{rank.label}</p>
                    <p className="metric-value">{rank.value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {mapRanks.length > 0 && (
            <section className="panel map-ranks">
              <p className="eyebrow">Per-map competitive ranks</p>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Map</th>
                      <th>Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapRanks.map((map) => (
                      <tr key={map.map_name}>
                        <td>{friendlyLabel(map.map_name)}</td>
                        <td>{map.rank ? formatNumber(map.rank) : 'Unranked'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {(ratingMetrics.length > 0 || statMetrics.length > 0) && (
            <section className="panel advanced">
              <div className="collapsible-header">
                <div>
                  <p className="eyebrow">Advanced mechanical stats</p>
                  <p className="muted">Ausgeklappt view for deep aim, utility, and trade data.</p>
                </div>
                <button type="button" className="toggle-button" onClick={() => setShowMechanics((prev) => !prev)}>
                  {showMechanics ? 'Hide breakdown' : 'Show breakdown'}
                </button>
              </div>

              {showMechanics && (
                <div className="advanced-content">
                  {ratingMetrics.length > 0 && (
                    <div>
                      <p className="eyebrow">Skill ratings</p>
                      <div className="metric-grid">
                        {ratingMetrics.map((metric) => (
                          <div key={metric.label} className="metric-card">
                            <p className="metric-label">{metric.label}</p>
                            <p className="metric-value">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {statMetrics.length > 0 && (
                    <div className="stats-grid">
                      <p className="eyebrow">Utility & behavior stats</p>
                      <div className="metric-grid dense">
                        {statMetrics.map((metric) => (
                          <div key={metric.label} className="metric-card compact">
                            <p className="metric-label">{metric.label}</p>
                            <p className="metric-value">{metric.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </>
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
