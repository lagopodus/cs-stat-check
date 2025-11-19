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

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const clampScore = (value) => Math.max(0, Math.min(100, value));
const resolveSusLevel = (score) => {
  if (score >= 75) return 'alert';
  if (score >= 40) return 'risk';
  return 'safe';
};

const curvedProgress = (progress, exponent = 1.2) => Math.pow(progress, exponent);

const calculateDynamicScore = (value, { safe, danger, direction = 'high', exponent = 1.2 }) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || safe === danger) return 0;
  if (direction === 'low') {
    if (value >= safe) return 0;
    if (value <= danger) return 100;
    const progress = (safe - value) / (safe - danger);
    return clampScore(Math.round(curvedProgress(progress, exponent) * 100));
  }

  if (value <= safe) return 0;
  if (value >= danger) return 100;
  const progress = (value - safe) / (danger - safe);
  return clampScore(Math.round(curvedProgress(progress, exponent) * 100));
};

const buildIntegritySignals = (playerData) => {
  if (!playerData) return [];
  const signals = [];
  const pushSignal = ({ label, value, detail, susScore = 0 }) => {
    const normalized = clampScore(Math.round(susScore));
    signals.push({
      label,
      value,
      detail,
      susScore: normalized,
      status: resolveSusLevel(normalized),
    });
  };

  const parsedFaceit = Number(playerData?.ranks?.faceit);
  const faceitLevel = Number.isFinite(parsedFaceit) && parsedFaceit > 0 ? parsedFaceit : null;
  const fallbackFaceit = 7;

  if (typeof playerData.winrate === 'number') {
    const winPercent = playerData.winrate * 100;
    const susScore = calculateDynamicScore(winPercent, { safe: 60, danger: 80, exponent: 1.1 });
    let detail = 'Win rate sits within normal matchmaking variance.';
    if (susScore >= 75) {
      detail = 'Insanely high win rate—scout VODs or check for smurf boosts.';
    } else if (susScore > 0) {
      detail = 'Elevated win rate. Make sure streaks match the visible rank.';
    }
    pushSignal({ label: 'Winrate', value: formatPercent(winPercent), detail, susScore });
  }

  const aim = playerData.rating?.aim;
  if (typeof aim === 'number') {
    const effectiveFaceit = faceitLevel && faceitLevel > 0 ? faceitLevel : fallbackFaceit;
    const safeAimCeiling = effectiveFaceit * 10;
    const alertAimThreshold = faceitLevel ? safeAimCeiling + 20 : Math.max(80, safeAimCeiling + 10);
    const susScore = calculateDynamicScore(aim, {
      safe: safeAimCeiling,
      danger: alertAimThreshold,
      exponent: 1.3,
    });
    let detail = `Aim rating matches a Faceit level ${faceitLevel || '≈7'} player.`;
    if (susScore >= 75) {
      detail = 'Aim rating is far ahead of the visible Faceit level.';
    } else if (susScore > 0) {
      detail = 'Aim is creeping ahead of the expected Faceit bracket.';
    }
    pushSignal({ label: 'Aim rating', value: aim.toFixed(1), detail, susScore });
  }

  const reaction = playerData.stats?.reaction_time_ms;
  if (typeof reaction === 'number') {
    const susScore = calculateDynamicScore(reaction, {
      safe: 520,
      danger: 450,
      direction: 'low',
      exponent: 1.2,
    });
    let detail = 'Reaction time looks human.';
    if (susScore >= 75) {
      detail = 'Lightning-fast reactions rarely show up without external help.';
    } else if (susScore > 0) {
      detail = 'Fast flick window—double-check POVs for consistency.';
    }
    pushSignal({ label: 'Reaction time', value: `${reaction.toFixed(0)} ms`, detail, susScore });
  }

  const headAccuracy = playerData.stats?.accuracy_head;
  if (typeof headAccuracy === 'number') {
    const accuracyPercent = headAccuracy > 1 ? headAccuracy : headAccuracy * 100;
    const susScore = calculateDynamicScore(accuracyPercent, {
      safe: 60,
      danger: 75,
      exponent: 1.1,
    });
    let detail = 'Head accuracy is in the typical range for legit players.';
    if (susScore >= 75) {
      detail = 'Head accuracy is unnaturally high—possible hard-lock aim assistance.';
    } else if (susScore > 0) {
      detail = 'Precision is trending upward; make sure POVs back it up.';
    }
    pushSignal({ label: 'Head accuracy', value: formatPercent(accuracyPercent), detail, susScore });
  }

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

const STEAM_ID_REGEX = /\b\d{17}\b/;

const extractSteamId = (value = '') => {
  if (!value) return null;
  const match = value.match(STEAM_ID_REGEX);
  return match ? match[0] : null;
};

const decodeSegment = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch (error) {
    return segment;
  }
};

const extractVanitySegment = (value = '') => {
  if (!value) return null;
  const vanityUrlMatch = value.match(/steamcommunity\.com\/(?:id|profiles)\/([^/?#]+)/i);
  if (vanityUrlMatch) {
    const [, segment] = vanityUrlMatch;
    if (!STEAM_ID_REGEX.test(segment)) {
      return decodeSegment(segment);
    }
  }
  const trimmed = value.trim();
  if (trimmed && /^[a-zA-Z0-9_-]+$/.test(trimmed) && !STEAM_ID_REGEX.test(trimmed)) {
    return trimmed;
  }
  return null;
};

const VANITY_CACHE = new Map();

const buildVanityResolverUrls = (vanity) => {
  const encoded = encodeURIComponent(vanity);
  const urls = [];
  const configured = (process.env.REACT_APP_STEAM_VANITY_RESOLVER || '').trim();

  if (configured) {
    if (configured.includes('{vanity}')) {
      urls.push(configured.replace('{vanity}', encoded));
    } else {
      const hasQuery = configured.includes('?');
      const needsAmpersand = hasQuery && !configured.endsWith('?') && !configured.endsWith('&');
      const separator = hasQuery ? (needsAmpersand ? '&' : '') : '?';
      urls.push(`${configured}${separator}vanityurl=${encoded}`);
    }
  }

  urls.push(`https://steamcommunity.com/actions/ajaxresolvevanityurl/?vanityurl=${encoded}`);
  urls.push(`https://r.jina.ai/https://steamcommunity.com/actions/ajaxresolvevanityurl/?vanityurl=${encoded}`);
  urls.push(`https://cors.isomorphic-git.org/https://steamcommunity.com/actions/ajaxresolvevanityurl/?vanityurl=${encoded}`);

  return [...new Set(urls)];
};

const resolveVanitySteamId = async (vanity) => {
  if (!vanity) return null;
  const normalized = vanity.trim();
  if (!normalized) return null;
  if (VANITY_CACHE.has(normalized)) {
    return VANITY_CACHE.get(normalized);
  }

  const candidates = buildVanityResolverUrls(normalized);
  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      if (payload?.success === 1 && payload?.steamid) {
        VANITY_CACHE.set(normalized, payload.steamid);
        return payload.steamid;
      }
    } catch (error) {
      // Ignore and try the next resolver.
    }
  }

  return null;
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

  const getRankIcon = (key, rawValue) => {
    if (key === 'faceit') {
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      const level = Math.max(1, Math.min(10, parsed));
      return {
        src: `https://cdn.faceit.com/images/league/levels/faceit_lvl${level}.svg`,
        alt: `Faceit level ${level}`,
      };
    }

    if (key === 'premier') {
      return {
        src: 'https://cdn.cloudflare.steamstatic.com/apps/csgo/images/premier/premier_badge.svg',
        alt: 'Premier rating badge',
      };
    }

    return null;
  };

  const rankMetrics = useMemo(() => {
    if (!playerData || !playerData.ranks) return [];
    const rankKeys = ['leetify', 'premier', 'faceit', 'faceit_elo', 'wingman', 'renown'];
    return rankKeys
      .filter((key) => playerData.ranks[key] !== undefined)
      .map((key) => ({
        label: friendlyLabel(key),
        value: formatNumber(playerData.ranks[key]),
        icon: getRankIcon(key, playerData.ranks[key]),
      }));
  }, [playerData]);

  const mapRanks = useMemo(() => {
    if (!playerData || !Array.isArray(playerData.ranks?.competitive)) return [];
    return playerData.ranks.competitive.filter((item) => item.map_name);
  }, [playerData]);

  const integritySignals = useMemo(() => buildIntegritySignals(playerData), [playerData]);

  const overallSusScore = useMemo(() => {
    if (!integritySignals.length) return null;
    const total = integritySignals.reduce((sum, signal) => sum + signal.susScore, 0);
    return Math.round(total / integritySignals.length);
  }, [integritySignals]);

  const bans = useMemo(() => ({
    list: Array.isArray(playerData?.bans)
      ? playerData.bans.map((ban) => ({
          platform: ban.platform || 'Unknown',
          nickname: ban.platform_nickname || '—',
          bannedSince: formatDateTime(ban.banned_since),
        }))
      : [],
    count: Array.isArray(playerData?.bans) ? playerData.bans.length : 0,
  }), [playerData]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = steamIdInput.trim();
    if (!trimmed) return;
    setError('');

    const regexMatch = extractSteamId(trimmed);
    if (regexMatch) {
      setActiveSteamId(regexMatch);
      return;
    }

    const vanitySegment = extractVanitySegment(trimmed);
    if (vanitySegment) {
      const resolved = await resolveVanitySteamId(vanitySegment);
      if (resolved) {
        setActiveSteamId(resolved);
        return;
      }
    }

    setError('Unable to extract a 64-bit Steam ID. Paste a direct ID or Steam profile URL.');
    setPlayerData(null);
    setRecentMatches([]);
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
          <label htmlFor="steamId">Steam ID (64-bit) or Steam profile URL</label>
          <div className="input-row">
            <input
              id="steamId"
              name="steamId"
              type="text"
              placeholder="7656119... or https://steamcommunity.com/id/..."
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
                  {overallSusScore !== null && (
                      <div className="overall-sus">
                        <div>
                          <p className="metric-label">Cheat Probability</p>
                          <p className="metric-value">{overallSusScore}/100</p>
                        </div>
                        <div className="sus-meter" aria-label={`Overall suspicion score ${overallSusScore} out of 100`}>
                          <div className="sus-meter-track">
                            <div
                                className={`sus-meter-fill ${resolveSusLevel(overallSusScore)}`}
                                style={{width: `${overallSusScore}%`}}
                            />
                          </div>
                        </div>
                      </div>
                  )}
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
                              <div
                                  className={`sus-meter-fill ${signal.status}`}
                                  style={{width: `${signal.susScore}%`}}
                              />
                            </div>
                          </div>
                          <p className="signal-detail">{signal.detail}</p>
                        </div>
                    ))}
                  </div>
                </section>
            )}

            <section className={`panel bans ${bans.count ? 'alert' : 'success'}`}>
              <p className="eyebrow">Ban check</p>
              {bans.count ? (
                  <div>
                    <h3>{bans.count} ban{bans.count > 1 ? 's' : ''} reported</h3>
                    <p>Review the raw payload below for ban details before trusting this account.</p>
                    {bans.list.length > 0 && (
                        <div className="table-wrapper">
                          <table className="ban-table">
                            <thead>
                            <tr>
                              <th>Platform</th>
                              <th>Nickname</th>
                              <th>Banned since</th>
                            </tr>
                            </thead>
                            <tbody>
                            {bans.list.map((ban, index) => (
                                <tr key={`${ban.platform}-${ban.bannedSince}-${index}`}>
                                  <td>{friendlyLabel(ban.platform)}</td>
                                  <td>{ban.nickname}</td>
                                  <td>{ban.bannedSince}</td>
                                </tr>
                            ))}
                            </tbody>
                          </table>
                        </div>
                    )}
                  </div>
              ) : (
                  <div>
                    <h3>No bans detected</h3>
                    <p>Leetify has not flagged this account with VAC, game, or third-party bans.</p>
                  </div>
              )}
            </section>

            <section className="panel stats overview">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Player overview</p>
                  <h2>{playerName}</h2>
                  <p className="steam-link">
                    Steam ID: <code>{playerData.steam64_id || activeSteamId}</code>
                  </p>
                </div>
                {playerData.privacy_mode &&
                    <span className="pill neutral">{friendlyLabel(playerData.privacy_mode)}</span>}
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


            {rankMetrics.length > 0 && (
                <section className="panel ranks">
                  <p className="eyebrow">Global ranks</p>
                  <div className="metric-grid">
                    {rankMetrics.map((rank) => (
                        <div key={rank.label} className={`metric-card rank-card${rank.icon ? ' has-icon' : ''}`}>
                          {rank.icon && (
                              <img className="rank-icon" src={rank.icon.src} alt={rank.icon.alt} loading="lazy"/>
                          )}
                          <div>
                            <p className="metric-label">{rank.label}</p>
                            <p className="metric-value">{rank.value}</p>
                          </div>
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
