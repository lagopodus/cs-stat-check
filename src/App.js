import { useState } from 'react';
import './App.css';

const CORS_PROXY = 'https://cors.isomorphic-git.org/';

function parseProfileInput(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Please provide a Steam profile link, vanity URL, or SteamID64.');
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const segmentIndex = parts.findIndex((part) => part === 'id' || part === 'profiles');

    if (segmentIndex !== -1 && parts[segmentIndex + 1]) {
      const identifier = parts[segmentIndex + 1].replace(/\/$/, '');
      return parts[segmentIndex] === 'profiles'
        ? { type: 'steamid', value: identifier }
        : { type: 'vanity', value: identifier };
    }

    if (parts.length) {
      const identifier = parts[parts.length - 1].replace(/\/$/, '');
      return /^\d+$/.test(identifier)
        ? { type: 'steamid', value: identifier }
        : { type: 'vanity', value: identifier };
    }
  } catch (error) {
    // Not a URL, fall through to direct parsing.
  }

  return /^\d+$/.test(trimmed)
    ? { type: 'steamid', value: trimmed }
    : { type: 'vanity', value: trimmed.replace(/\/$/, '') };
}

async function fetchXml(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to reach Steam right now. Please try again.');
  }

  const xmlText = await response.text();
  const parser = new DOMParser();
  const document = parser.parseFromString(xmlText, 'text/xml');

  if (document.querySelector('parsererror')) {
    throw new Error('Received an unexpected response from Steam.');
  }

  return document;
}

async function resolveVanity(vanity) {
  const vanityUrl = `${CORS_PROXY}https://steamcommunity.com/id/${encodeURIComponent(vanity)}/?xml=1`;
  const document = await fetchXml(vanityUrl);
  const steamId = document.querySelector('steamID64')?.textContent;

  if (!steamId) {
    throw new Error('Could not resolve that custom URL. Double-check the name and try again.');
  }

  return steamId;
}

async function loadProfileBySteamId(steamId) {
  const profileUrl = `${CORS_PROXY}https://steamcommunity.com/profiles/${steamId}/?xml=1`;
  const document = await fetchXml(profileUrl);

  const headline = document.querySelector('headline')?.textContent || '';
  const summary = document.querySelector('summary')?.textContent?.trim() || '';
  const personaName = document.querySelector('steamID')?.textContent || 'Unknown user';
  const avatar = document.querySelector('avatarFull')?.textContent || '';
  const customUrl = document.querySelector('customURL')?.textContent || '';

  return {
    steamId,
    personaName,
    avatar,
    headline,
    summary,
    customUrl,
  };
}

function App() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState('');
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('Resolving profile...');
    setError('');
    setProfile(null);

    try {
      const descriptor = parseProfileInput(input);
      const steamId = descriptor.type === 'steamid'
        ? descriptor.value
        : await resolveVanity(descriptor.value);

      const profileData = await loadProfileBySteamId(steamId);
      setProfile(profileData);
      setStatus('Profile loaded successfully.');
    } catch (caughtError) {
      setStatus('');
      setError(caughtError.message || 'Something went wrong.');
    }
  };

  return (
    <div className="App">
      <div className="panel">
        <h1>Steam Profile Loader</h1>
        <p className="helper">
          Paste a Steam profile URL (vanity or SteamID64). Custom domains that mirror Steam profile paths are supported.
        </p>

        <form className="input-row" onSubmit={handleSubmit}>
          <input
            aria-label="Steam profile input"
            placeholder="https://steamcommunity.com/id/tigerbozo/"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit">Load profile</button>
        </form>

        {status && <div className="status info">{status}</div>}
        {error && <div className="status error">{error}</div>}

        {profile && (
          <div className="profile-card">
            {profile.avatar && (
              <img className="avatar" src={profile.avatar} alt={`${profile.personaName} avatar`} />
            )}
            <div className="profile-details">
              <h2>{profile.personaName}</h2>
              <p className="steam-id">SteamID64: {profile.steamId}</p>
              {profile.customUrl && (
                <p className="custom-url">Custom URL: {profile.customUrl}</p>
              )}
              {profile.headline && <p className="headline">{profile.headline}</p>}
              {profile.summary && <p className="summary">{profile.summary}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
