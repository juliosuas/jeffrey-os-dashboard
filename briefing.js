/**
 * briefing.js — JARVIS-style Morning Briefing System for Jeffrey OS
 * Handles: voice narration, news feed, real-time clock
 */

'use strict';

// ====== STATE ======
let hnStories = [];
let briefingSpoken = false;
let speechSynth = window.speechSynthesis;

// ====== CLOCK ======
/**
 * Update the large time display and date string.
 */
function updateBriefingClock() {
  const now = new Date();
  const timeEl = document.getElementById('briefing-time');
  const dateEl = document.getElementById('briefing-date');
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-US', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      timeZone: 'America/Mexico_City',
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    }).toUpperCase();
  }
}
setInterval(updateBriefingClock, 1000);
updateBriefingClock();

// ====== VOICE BRIEFING ======
/**
 * Pick the best available voice — prefers Google UK English Male, then any English UK voice, then English.
 * @returns {SpeechSynthesisVoice|null}
 */
function pickVoice() {
  const voices = speechSynth.getVoices();
  const order = [
    v => v.name === 'Google UK English Male',
    v => v.name.includes('UK') && v.lang.startsWith('en'),
    v => v.name === 'Daniel',            // macOS UK Male
    v => v.name === 'Fred',              // macOS deep male
    v => v.lang === 'en-GB',
    v => v.lang.startsWith('en'),
  ];
  for (const test of order) {
    const found = voices.find(test);
    if (found) return found;
  }
  return voices[0] || null;
}

/**
 * Build the JARVIS briefing script from live state and news data.
 * @param {Object} state - state.json data
 * @returns {string} Narration script
 */
function buildBriefing(state) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const load = state?.system?.loadAvg?.[0] ?? 'unknown';
  const mem = state?.system?.memPercent ?? 'unknown';
  const disk = state?.system?.diskPercent?.replace('%', '') ?? 'unknown';

  // Count active projects
  const projects = state?.projects ?? {};
  const activeCount = Object.values(projects).filter(p => p.health === 'active').length;
  const totalCount = Object.keys(projects).length;

  // PRs
  const prs = state?.prs ?? [];
  const openPRs = prs.filter(p => p.state === 'OPEN').length;

  // Weather
  const weather = state?.weather;
  let weatherLine = '';
  if (weather?.cdmx?.temp) {
    weatherLine = `Mexico City is currently ${weather.cdmx.temp} degrees, ${weather.cdmx.condition}. `;
  }

  // Garden
  const garden = state?.garden;
  let gardenLine = '';
  if (garden?.citizens) {
    gardenLine = `The AI Garden is at version ${garden.version ?? '?'} with ${garden.citizens} citizens. `;
  }

  // News
  let newsLine = '';
  if (hnStories.length > 0) {
    newsLine = `Top story on Hacker News: ${hnStories[0].title}. `;
  }

  // Crons with errors
  const crons = state?.crons ?? [];
  const errorCrons = crons.filter(c => c.lastStatus === 'error').length;
  const cronLine = errorCrons > 0 ? `Warning: ${errorCrons} cron job${errorCrons > 1 ? 's' : ''} reported errors. ` : '';

  return `${greeting}, sir. Jeffrey OS is online. ${weatherLine}` +
    `System load is at ${load}. Memory usage at ${mem} percent. ` +
    `${activeCount} of ${totalCount} projects are active today. ` +
    (openPRs > 0 ? `You have ${openPRs} open pull request${openPRs > 1 ? 's' : ''} awaiting review. ` : '') +
    `${gardenLine}${newsLine}${cronLine}` +
    `All systems nominal. Standing by for your command, sir.`;
}

/**
 * Speak the briefing using Web Speech API with JARVIS-style settings.
 * @param {string} text - Text to speak
 */
function speak(text) {
  if (!speechSynth) { console.warn('TTS not supported'); return; }
  speechSynth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.pitch = 0.8;
  utt.rate = 0.9;
  utt.volume = 1.0;
  const voice = pickVoice();
  if (voice) utt.voice = voice;

  utt.onstart = () => {
    const btn = document.getElementById('briefing-play-btn');
    if (btn) { btn.textContent = '⏸ PAUSE'; btn.classList.add('active'); }
    const indicator = document.getElementById('briefing-speaking');
    if (indicator) indicator.style.display = 'flex';
  };
  utt.onend = utt.onerror = () => {
    const btn = document.getElementById('briefing-play-btn');
    if (btn) { btn.textContent = '▶ PLAY BRIEFING'; btn.classList.remove('active'); }
    const indicator = document.getElementById('briefing-speaking');
    if (indicator) indicator.style.display = 'none';
  };

  speechSynth.speak(utt);
}

/**
 * Toggle play/pause for the voice briefing.
 */
window.toggleBriefing = function() {
  if (!speechSynth) {
    alert('Text-to-speech not supported in this browser.');
    return;
  }
  if (speechSynth.speaking && !speechSynth.paused) {
    speechSynth.pause();
    const btn = document.getElementById('briefing-play-btn');
    if (btn) btn.textContent = '▶ RESUME';
    return;
  }
  if (speechSynth.paused) {
    speechSynth.resume();
    const btn = document.getElementById('briefing-play-btn');
    if (btn) { btn.textContent = '⏸ PAUSE'; btn.classList.add('active'); }
    return;
  }
  // Fresh briefing
  const state = window.STATE || {};
  speak(buildBriefing(state));
};

/**
 * Auto-play briefing once after first user interaction (click anywhere).
 * Browsers block auto-play without user gesture.
 */
function scheduleAutoBriefing() {
  if (briefingSpoken) return;
  const trigger = () => {
    if (briefingSpoken) return;
    briefingSpoken = true;
    document.removeEventListener('click', trigger);
    document.removeEventListener('keydown', trigger);
    // Small delay so the click doesn't feel like it immediately fires TTS
    setTimeout(() => {
      const state = window.STATE || {};
      speak(buildBriefing(state));
    }, 1500);
  };
  document.addEventListener('click', trigger, { once: true });
  document.addEventListener('keydown', trigger, { once: true });
}

// ====== HACKER NEWS FEED ======
/**
 * Fetch top Hacker News stories and populate the news panel.
 * Falls back to Algolia API if Firebase fails.
 */
async function fetchHackerNews() {
  const container = document.getElementById('hn-feed');
  if (!container) return;

  try {
    // Try HN Firebase API first
    const topRes = await fetch('https://hacker-news.firebaseio.com/v1/topstories.json?limitToFirst=10&orderBy="$key"');
    if (!topRes.ok) throw new Error('Firebase API failed');
    const ids = await topRes.json();
    const top5 = ids.slice(0, 5);
    const stories = await Promise.all(
      top5.map(id => fetch(`https://hacker-news.firebaseio.com/v1/item/${id}.json`).then(r => r.json()))
    );
    hnStories = stories.filter(Boolean);
    renderHNFeed(hnStories);
  } catch (e) {
    console.warn('HN Firebase failed, trying Algolia...', e);
    try {
      const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=5');
      if (!res.ok) throw new Error('Algolia failed');
      const data = await res.json();
      hnStories = data.hits.map(h => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        score: h.points,
        by: h.author,
        descendants: h.num_comments,
        id: h.objectID,
      }));
      renderHNFeed(hnStories);
    } catch (e2) {
      console.error('Both HN APIs failed:', e2);
      if (container) container.innerHTML = '<div class="hn-error">⚠ News feed unavailable</div>';
    }
  }
}

/**
 * Render Hacker News stories into the feed container.
 * @param {Array} stories - Array of HN story objects
 */
function renderHNFeed(stories) {
  const container = document.getElementById('hn-feed');
  if (!container) return;
  if (!stories.length) {
    container.innerHTML = '<div class="hn-error">No stories available</div>';
    return;
  }
  container.innerHTML = stories.map((s, i) => {
    const url = s.url || `https://news.ycombinator.com/item?id=${s.id}`;
    const score = s.score || 0;
    const comments = s.descendants || 0;
    const by = s.by || 'unknown';
    return `
      <div class="hn-story" onclick="window.open('${url}', '_blank')">
        <div class="hn-rank">${i + 1}</div>
        <div class="hn-content">
          <div class="hn-title">${escapeHtml(s.title)}</div>
          <div class="hn-meta">▲ ${score} pts · ${by} · ${comments} comments</div>
        </div>
      </div>`;
  }).join('');
  // Update last-refreshed
  const updEl = document.getElementById('hn-updated');
  if (updEl) updEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** @param {string} s @returns {string} */
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ====== PR INTELLIGENCE ======
/**
 * Render PR Intelligence panel from state.prs data.
 * @param {Array} prs - Array of PR objects from state.json
 */
function renderPRIntelligence(prs) {
  const container = document.getElementById('pr-intel-list');
  if (!container) return;
  if (!prs || !prs.length) {
    container.innerHTML = '<div class="dim">No open PRs found</div>';
    return;
  }

  const open = prs.filter(p => p.state === 'OPEN');
  if (!open.length) {
    container.innerHTML = '<div style="color:var(--green);">✓ No open PRs — all clear</div>';
    return;
  }

  // Group by repo
  const byRepo = {};
  open.forEach(pr => {
    const repo = pr.repository?.name || pr.repo || 'unknown';
    if (!byRepo[repo]) byRepo[repo] = [];
    byRepo[repo].push(pr);
  });

  let html = '';
  Object.entries(byRepo).forEach(([repo, repoPRs]) => {
    html += `<div class="pr-repo-header">${escapeHtml(repo)}</div>`;
    repoPRs.forEach(pr => {
      const mergeable = pr.mergeable;
      const badge = mergeable === 'MERGEABLE'
        ? '<span class="badge badge-ok">MERGE ✅</span>'
        : mergeable === 'CONFLICTING'
          ? '<span class="badge badge-error">CONFLICT ❌</span>'
          : '<span class="badge badge-idle">PENDING ⏳</span>';
      html += `<div class="pr-row">
        ${badge}
        <span class="pr-title" title="${escapeHtml(pr.title)}">#${pr.number} ${escapeHtml(pr.title)}</span>
      </div>`;
    });
  });

  // Summary count
  const countEl = document.getElementById('pr-intel-count');
  if (countEl) countEl.textContent = `${open.length} OPEN`;
  container.innerHTML = html;
}

// ====== WEATHER WIDGET (briefing panel) ======
/**
 * Update the briefing panel weather widget from state.weather
 * @param {Object} weather
 */
function updateBriefingWeather(weather) {
  const el = document.getElementById('briefing-weather');
  if (!el || !weather) return;
  const w = weather.cdmx || weather.mexico_city || {};
  if (w.temp) {
    el.innerHTML = `<span class="weather-temp">${w.temp}°C</span> <span class="weather-icon">${w.icon || '🌤'}</span> <span class="weather-cond">${w.condition || ''}</span>`;
  } else {
    el.innerHTML = '<span class="dim">Weather unavailable</span>';
  }
}

// ====== MAIN INIT ======
/**
 * Initialize briefing module — called after DOM is ready and state loaded.
 * @param {Object} state - Loaded state.json
 */
window.initBriefing = function(state) {
  updateBriefingWeather(state?.weather);
  renderPRIntelligence(state?.prs);
  scheduleAutoBriefing();
};

// Refresh news every 5 minutes
fetchHackerNews();
setInterval(fetchHackerNews, 5 * 60 * 1000);

// Export for state integration
window.renderPRIntelligence = renderPRIntelligence;
window.updateBriefingWeather = updateBriefingWeather;
window.buildBriefing = buildBriefing;
