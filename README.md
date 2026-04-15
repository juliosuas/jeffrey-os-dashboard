# JEFFREY OS v7.0 — Personal Command Center

> A JARVIS-style personal dashboard with a cyberpunk terminal aesthetic. Built for a single developer who wants a living, breathing readout of everything that matters — system health, active projects, open PRs, weather, cron jobs, and a morning voice briefing that greets you like Tony Stark's AI.

---

## What It Looks Like

The dashboard runs full-screen in a browser and renders in **pure green-on-black terminal aesthetics**:

- Deep black background (`#0a0a0f`) with a faint animated Matrix rain canvas behind everything
- Phosphor-green primary text (`#00ff41`) with cyan accents for highlights
- CRT scanline overlay for authenticity
- **Boot sequence** on first load: simulates a system startup log with typing animation before revealing the dashboard
- Panel grid with glowing borders, hover glow effects, and pulsing live indicators
- Two fonts: `Orbitron` (headings, badges — geometric sci-fi) and `Share Tech Mono` (body — terminal monospace)

Everything auto-refreshes every 15 seconds. No frameworks — pure vanilla HTML/CSS/JS on the frontend.

---

## Features

### Real-Time System Metrics
- **CPU load averages** (1m / 5m / 15m) via `os.getloadavg()`
- **Memory usage** (GB used / total, %) — parsed from macOS `vm_stat` output, accounting for active + wired + compressed pages
- **Disk usage** (used / available / percent) for the root filesystem
- **System uptime** string from `uptime` command
- **Hostname** and infrastructure details (machine type, LAN IP, OS version, architecture)

### Morning Voice Briefing
See the [Voice Briefing deep-dive](#voice-briefing-deep-dive) section below. This is the headline feature.

### Hacker News Live Feed
- Fetches top 5 front-page stories every 5 minutes
- Primary source: HN Firebase API (`hacker-news.firebaseio.com/v1`)
- Fallback: Algolia HN API (`hn.algolia.com/api/v1`)
- Shows rank, title, score, author, comment count
- Click any story to open it in a new tab
- Top story title is read aloud in the morning briefing

### GitHub PR Intelligence
- Fetches all open PRs authored by the configured user via `gh pr list --author <user> --json`
- Groups PRs by repository
- Shows merge status badges: `MERGE ✅` / `CONFLICT ❌` / `PENDING ⏳`
- Open PR count surfaced in the voice briefing
- Gracefully handles missing `gh` auth or zero open PRs

### Weather Widget
- Powered by [wttr.in](https://wttr.in) (no API key required)
- Shows Mexico City and Acapulco by default
- Data: temperature (°C), feels-like, humidity, wind speed (km/h), condition string, emoji icon
- Weather condition read aloud in the morning briefing

### Airbnb Command Center Panel
- Displays listing status and pricing for Airbnb properties
- Currently showing static/hardcoded pricing ($3,200 / $3,500 / $2,500 MXN) and `0 reservas`
- Intended hook point for Airbnb API or calendar scrape integration

### LinkedIn Engine / Cron Jobs Panel
- Pulls live cron job list from OpenClaw (`openclaw cron list --json`)
- Shows each job: name, description, schedule (e.g. `every 30m`), enabled/disabled toggle, last status, last run duration, next run time
- **Run** button: `POST /api/cron/:id/run` — triggers a cron immediately
- **Toggle** button: `POST /api/cron/:id/toggle` — enable or disable a cron
- Live cron execution log: last 60 lines from `/tmp/openclaw/openclaw-YYYY-MM-DD.log`, parsed from JSON log format

### OpenClaw Integration
- Runs `openclaw doctor --non-interactive` to check system health
- Reports `ok` / `warn` / `error` status
- OpenClaw crons and log tail served via dedicated API endpoints
- Homebrew-installed OpenClaw binary path (`~/homebrew/bin/openclaw`) is configured in server.js

### System Health Panel
- OpenClaw status indicator
- WhatsApp/iMessage plugin status (currently hardcoded to CONNECTED/ACTIVE)
- Dashboard server uptime and state.json age (healthy if < 60s old)
- Cron error count

### Projects Overview
- Scans all git repositories under `~/jeffrey/workspace/projects/`
- For each project: branch, last commit hash, last commit message, time ago, dirty file count
- **Health badges** based on commit age: `ACTIVE` (< 24h), `RECENT` (< 7 days), `STALE` (> 7 days)
- Active project count surfaced in the voice briefing

### OSS Contribution Queue
- Reads `~/jeffrey/workspace/projects/contribution-queue.md`
- Served as plaintext via `GET /api/contribution-queue`
- Rendered in the dashboard as a scrollable list

### AI Garden Stats
- Reads `~/jeffrey/workspace/projects/ai-garden/experiments/world-state.json`
- Shows: citizens count, plants count, factions, threats, events, structures, version, last updated
- Garden citizen count read aloud in the voice briefing

### LAN Access
The server binds to `0.0.0.0:8080` — accessible from any device on your local network. Pull up the dashboard on your phone at `http://192.168.x.x:8080`.

---

## Architecture

```
jeffrey-os-dashboard/
├── index.html          # Dashboard UI — all CSS, layout, panel rendering, boot sequence
├── briefing.js         # Voice briefing, HN feed, PR panel rendering, weather widget
├── server.js           # Node.js HTTP server — API endpoints + 15s state refresh loop
├── update-state.py     # State generator — collects all data, writes state.json
├── state.json          # Live state snapshot (auto-generated, not committed)
├── start.sh            # Dev startup script — kills old process, generates state, starts server
├── install-autostart.sh # macOS launchd service installer
├── server.py           # Legacy Python server (replaced by server.js)
└── DASHBOARD_STATUS.md # Internal tracking of what's live vs hardcoded
```

### Data Flow

```
                   ┌─────────────────────────┐
                   │    Browser (index.html)  │
                   │                          │
                   │  GET /api/state (15s)    │
                   │  GET /api/crons          │
                   │  POST /api/cron/:id/run  │
                   └────────────┬────────────┘
                                │
                        ┌───────▼────────┐
                        │   server.js    │
                        │   :8080        │
                        │                │
                        │  Serves files  │
                        │  + API routes  │
                        │                │
                        │  setInterval   │
                        │  15s → spawn   │
                        └───────┬────────┘
                                │
                     ┌──────────▼──────────┐
                     │  update-state.py    │
                     │                     │
                     │  ThreadPoolExecutor │
                     │  8 parallel workers │
                     │                     │
                     │  - system metrics   │
                     │  - git projects     │
                     │  - openclaw crons   │
                     │  - github PRs (gh)  │
                     │  - weather (wttr.in)│
                     │  - garden stats     │
                     │  - openclaw doctor  │
                     └──────────┬──────────┘
                                │
                         ┌──────▼──────┐
                         │ state.json  │
                         └─────────────┘
```

### State Refresh Cycle

`server.js` calls `update-state.py` immediately on startup, then every **15 seconds** via `setInterval`. The generator is non-blocking — if the previous run is still executing, the new tick is skipped (`stateGenerating` guard). A 12-second timeout kills hung processes. The browser polls `/api/state` on its own 15-second cycle, ensuring data is always < ~30 seconds stale.

The Python generator uses a `ThreadPoolExecutor` with 8 workers to parallelize all data fetches simultaneously (system metrics, git scans, GitHub API, weather API, OpenClaw calls all run concurrently).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard UI (`index.html`) |
| `GET` | `/api/state` | Full state snapshot as JSON |
| `GET` | `/api/health` | Server health: uptime, state age, status |
| `GET` | `/api/crons` | Live cron list from OpenClaw (falls back to state.json) |
| `GET` | `/api/cron-log` | Last 60 lines of today's OpenClaw log file |
| `GET` | `/api/contribution-queue` | Raw markdown from `contribution-queue.md` |
| `POST` | `/api/cron/:id/run` | Trigger cron job immediately |
| `POST` | `/api/cron/:id/toggle` | Enable or disable a cron job |

All API responses include CORS headers (`Access-Control-Allow-Origin: *`) and `no-cache` directives.

### Example: `/api/health`

```json
{
  "ok": true,
  "status": "healthy",
  "stateAgeSeconds": 8,
  "uptime": 3721,
  "time": "2026-04-15T14:22:01.000Z"
}
```

---

## State.json Schema

`state.json` is written atomically by `update-state.py` on every refresh cycle. Here is the complete schema:

```jsonc
{
  "timestamp": "2026-04-15T08:22:01.000000-06:00",  // CDT ISO 8601
  "hostname": "jeffrey-mac-mini.local",
  "uptime": " 8:22  up 3 days, 14:11, 2 users...",  // raw uptime string

  "system": {
    "loadAvg": [1.23, 1.10, 0.98],        // 1m, 5m, 15m load averages
    "memUsedGB": 12.4,                     // Active + wired + compressed RAM
    "memTotalGB": 24.0,
    "memPercent": 51.7,
    "diskTotal": "926G",
    "diskUsed": "421G",
    "diskAvail": "506G",
    "diskPercent": "46%"
  },

  "weather": {
    "cdmx": {
      "temp": "22",                        // Celsius
      "feelsLike": "21",
      "humidity": "58",
      "condition": "Partly cloudy",
      "windKph": "15",
      "icon": "⛅",
      "updated": "2026-04-15T08:22:00-06:00"
    },
    "acapulco": { /* same shape */ }
  },

  "projects": {
    "my-project": {
      "branch": "main",
      "lastCommitHash": "a1b2c3d4",
      "lastCommitMsg": "fix: repair broken auth flow",
      "lastCommitTime": "2026-04-15T07:10:00-06:00",
      "lastCommitAgo": "72 minutes ago",
      "dirty": 3,                          // uncommitted file count
      "health": "active"                   // "active" | "recent" | "stale"
    }
    // ... one entry per git repo in PROJECTS_DIR
  },

  "crons": [
    {
      "name": "linkedin-post",
      "description": "Post daily LinkedIn update",
      "schedule": "every 24h",
      "enabled": true,
      "lastStatus": "success",             // "success" | "error" | ""
      "lastDurationMs": 4821,
      "nextRun": 1744900000000,            // Unix ms
      "consecutiveErrors": 0
    }
  ],

  "prs": [
    {
      "number": 42,
      "title": "feat: add new feature",
      "state": "OPEN",
      "mergeable": "MERGEABLE",            // "MERGEABLE" | "CONFLICTING" | "UNKNOWN"
      "repository": { "name": "my-repo" }
    }
  ],

  "garden": {
    "plants": 24,
    "citizens": 87,
    "factions": 5,
    "threats": 2,
    "events": 14,
    "version": 312,
    "structures": 18,
    "lastUpdated": "2026-04-15T08:20:00-06:00"
  },

  "openclawStatus": {
    "status": "ok",                        // "ok" | "warn" | "error" | "unknown"
    "raw": "All systems healthy..."
  },

  "infrastructure": {
    "host": "Mac mini M4",
    "ip": "192.168.1.66",                  // LAN IP from en0/en1
    "os": "macOS 15.3.2",
    "arch": "arm64",
    "dashboardPort": 8080
  },

  "tokens": {
    "plan": "Claude Max 5x",
    "model_main": "claude-opus-4-6",
    "model_crons": "claude-sonnet-4"
  }
}
```

---

## Setup Guide

### Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Node.js 18+ | HTTP server |
| Python 3.9+ | State generator |
| `gh` CLI (authenticated) | GitHub PR fetching |
| macOS (or adapt for Linux) | `vm_stat`, `uptime`, `ipconfig` commands |
| OpenClaw | Cron job management (optional) |
| Google Chrome | Best voice support for TTS briefing |

### 1. Clone and Install

```bash
git clone https://github.com/juliosuas/jeffrey-os-dashboard.git
cd jeffrey-os-dashboard

# No npm install needed — server.js uses only Node built-ins
# No pip install needed — update-state.py uses only stdlib
```

### 2. Configure Paths

Open `server.js` and `update-state.py` and update the hardcoded paths to match your system:

**`server.js` line 5:**
```js
const DIR = path.join(process.env.HOME, 'YOUR_PATH/jeffrey-os-dashboard');
```

**`update-state.py` lines 11–13:**
```python
PROJECTS_DIR = Path.home() / "YOUR_PATH/projects"
GARDEN_WORLD_STATE = PROJECTS_DIR / "ai-garden/experiments/world-state.json"
OUTPUT = PROJECTS_DIR / "jeffrey-os-dashboard/state.json"
```

### 3. Configure GitHub Username

In `update-state.py`, `get_github_prs()` uses a hardcoded author filter. Change it to your GitHub username:

```python
raw = run("gh pr list --author YOUR_GITHUB_USERNAME --limit 20 --json number,title,state,mergeable,repository")
```

In `briefing.js`, the `renderPRIntelligence()` function renders `state.prs` — no changes needed there.

### 4. Configure Weather Cities

In `update-state.py`, the `get_weather()` function defaults to Mexico City and Acapulco. Update to your cities:

```python
cities = {"home": "San+Francisco", "work": "New+York"}
```

The keys (`home`, `work`) propagate to `state.weather` and to the `updateBriefingWeather()` call in `briefing.js`. Update `briefing.js` accordingly:

```js
const w = weather.home || weather.work || {};
```

### 5. Run

```bash
chmod +x start.sh
./start.sh
```

This will:
1. Kill any existing process on port 8080
2. Run `python3 update-state.py` once to generate initial `state.json`
3. Start `node server.js` in the background
4. Open `http://localhost:8080` in Google Chrome
5. Tail the server log

Or run the server directly:

```bash
node server.js
```

### 6. Access from LAN

Open `http://192.168.x.x:8080` from any device on the same network. The server binds to `0.0.0.0`. Your LAN IP is printed at startup and shown in the `infrastructure.ip` field of `state.json`.

---

## Voice Briefing Deep-Dive

The morning briefing is the defining feature of the dashboard. It uses the browser-native **Web Speech API** — no external TTS service, no API key, zero cost.

### How It Works

When you click **▶ PLAY BRIEFING** (or press any key/click anywhere for the first time), `briefing.js` builds a narration script from live state data and speaks it using `SpeechSynthesisUtterance`.

```
User gesture → toggleBriefing() → buildBriefing(state) → speak(text)
                                                              │
                                         SpeechSynthesisUtterance
                                         pitch: 0.8, rate: 0.9
                                         voice: Google UK English Male
```

### Voice Selection

The dashboard prefers voices in this priority order:

```js
const order = [
  v => v.name === 'Google UK English Male',  // Chrome on most platforms
  v => v.name.includes('UK') && v.lang.startsWith('en'),
  v => v.name === 'Daniel',                  // macOS UK Male (System Preferences)
  v => v.name === 'Fred',                    // macOS deep male
  v => v.lang === 'en-GB',
  v => v.lang.startsWith('en'),              // any English fallback
];
```

To see which voices are available in your browser, open DevTools console and run:

```js
speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang, v.localService));
```

For the JARVIS effect, **Google UK English Male** is the best option and is available in Chrome when online. On macOS, install the **Daniel** voice (`System Settings → Accessibility → Spoken Content → System voice → Manage voices → English (United Kingdom) → Daniel`).

### JARVIS-Style Settings

```js
const utt = new SpeechSynthesisUtterance(text);
utt.pitch = 0.8;   // lower than default (1.0) — more authoritative
utt.rate  = 0.9;   // slightly slower — deliberate, calm
utt.volume = 1.0;
```

Adjust `pitch` (0.0–2.0) and `rate` (0.1–10.0) in `briefing.js` to taste.

### What the Briefing Says

`buildBriefing(state)` in `briefing.js` assembles this script at runtime:

```
{Good morning|Good afternoon|Good evening}, sir. Jeffrey OS is online.
Mexico City is currently {temp}°C, {condition}.
System load is at {load1m}. Memory usage at {memPercent} percent.
{activeCount} of {totalCount} projects are active today.
You have {openPRs} open pull requests awaiting review.
The AI Garden is at version {version} with {citizens} citizens.
Top story on Hacker News: {hnStories[0].title}.
Warning: {n} cron jobs reported errors.          ← only if errors exist
All systems nominal. Standing by for your command, sir.
```

### Customizing the Briefing Script

Edit `buildBriefing()` in `briefing.js`. It's plain string concatenation — add, remove, or rephrase any line:

```js
// Add a custom message:
const myLine = `Your next calendar event is at ${nextEventTime}. `;

return `${greeting}, sir. Jeffrey OS is online. ${weatherLine}` +
  myLine +                         // <-- insert here
  `System load is at ${load}. ...`;
```

### Browser Autoplay Policy

Browsers block audio output until the user has interacted with the page. The dashboard works around this in two ways:

1. **Manual button**: The **▶ PLAY BRIEFING** button always works because it fires on a direct click event.
2. **Auto-play on first interaction**: `scheduleAutoBriefing()` attaches one-shot `click` and `keydown` listeners. The first time you interact with the page (any click, any key), the briefing fires 1.5 seconds later. After that it does not repeat automatically.

```js
function scheduleAutoBriefing() {
  const trigger = () => {
    briefingSpoken = true;
    setTimeout(() => speak(buildBriefing(window.STATE || {})), 1500);
  };
  document.addEventListener('click', trigger, { once: true });
  document.addEventListener('keydown', trigger, { once: true });
}
```

---

## Auto-Start on macOS

`install-autostart.sh` installs a **launchd LaunchAgent** that starts the dashboard server automatically on every login and keeps it alive if it crashes.

```bash
chmod +x install-autostart.sh
./install-autostart.sh
```

This creates `~/Library/LaunchAgents/com.jeffrey.dashboard.plist`, loads it with `launchctl`, and opens Chrome.

The plist uses `KeepAlive: true` — launchd will restart the server automatically if it dies.

**Log files:**
- stdout: `/tmp/jeffrey-dashboard.log`
- stderr: `/tmp/jeffrey-dashboard-error.log`

**Manage the service manually:**

```bash
# Stop
launchctl unload ~/Library/LaunchAgents/com.jeffrey.dashboard.plist

# Start
launchctl load ~/Library/LaunchAgents/com.jeffrey.dashboard.plist

# Check status
launchctl list | grep jeffrey

# Tail logs
tail -f /tmp/jeffrey-dashboard.log
```

**Note:** The plist uses `/usr/local/bin/node` by default. If your Node.js is installed via Homebrew in a non-standard location (e.g. `~/homebrew/bin/node` on Apple Silicon), the installer auto-detects this and patches the plist.

---

## Customization Guide

### Change the Color Scheme

All colors are CSS custom properties in `index.html`:

```css
:root {
  --green:    #00ff41;   /* Primary text, borders */
  --cyan:     #00d4ff;   /* Highlights, clock */
  --red:      #ff3333;   /* Errors, live indicator */
  --yellow:   #ffcc00;   /* Warnings */
  --orange:   #ff8800;   /* Accent */
  --purple:   #b44dff;   /* Accent */
  --bg:       #0a0a0f;   /* Background */
  --panel-bg: rgba(10, 15, 20, 0.88);
  --border:   rgba(0, 255, 65, 0.2);
}
```

For an amber terminal look, swap `--green` to `#ff8c00` and `--bg` to `#0a0500`.

### Change the Boot Sequence

The boot sequence is JavaScript-driven in `index.html`. Look for the `bootLines` array in the inline script:

```js
const bootLines = [
  'JEFFREY OS v7.0 KERNEL LOADING...',
  'INITIALIZING NEURAL INTERFACE...',
  // Add or change lines here
];
```

Each line is typed out character by character. Adjust the timing and content freely.

### Add a New Panel

1. Add a new `<div class="panel col-N">` block in `index.html` inside `.grid`
2. Give it a panel-header and panel-body
3. In the state refresh loop (the `tick()` function in `index.html`), add a renderer for your new panel
4. If the data comes from the server, add it to `state.json` in `update-state.py`

```html
<div class="panel col-4">
  <div class="panel-header">
    <i data-lucide="activity"></i> MY PANEL
  </div>
  <div class="panel-body" id="my-panel-body">
    Loading...
  </div>
</div>
```

```js
// In tick():
document.getElementById('my-panel-body').innerHTML = renderMyPanel(state.myData);
```

### Add a New Data Source

Add a function to `update-state.py` and submit it to the thread pool:

```python
def get_my_data():
    raw = run("my-cli-tool --json")
    return json.loads(raw) if raw else {}

# In the ThreadPoolExecutor block:
f_mydata = pool.submit(get_my_data)

# In the state dict:
state = {
    ...
    "myData": f_mydata.result(),
}
```

### Modify the 15-Second Refresh Interval

In `server.js`:

```js
setInterval(regenState, 15000);  // Change 15000 to desired ms
```

In `index.html`, the browser poll interval is separate — find the `setInterval(tick, ...)` call.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Server** | Node.js (built-ins only) | `http`, `fs`, `child_process` — no npm dependencies |
| **State generator** | Python 3 stdlib | `subprocess`, `concurrent.futures`, `urllib.request` |
| **Frontend** | Vanilla JS / HTML / CSS | No frameworks, no build step |
| **Voice** | Web Speech API | Browser-native TTS, no API key |
| **Fonts** | Google Fonts | Orbitron + Share Tech Mono |
| **Icons** | Lucide (CDN) | `unpkg.com/lucide` |
| **Weather** | wttr.in JSON API | Free, no key required |
| **GitHub PRs** | `gh` CLI | Requires `gh auth login` |
| **Cron jobs** | OpenClaw | `openclaw cron list/run/enable/disable` |
| **Process manager** | macOS launchd | via `install-autostart.sh` |

---

## Known Limitations

| Item | Status |
|------|--------|
| Airbnb booking data | Hardcoded — real API not integrated |
| WhatsApp/iMessage health | Hardcoded CONNECTED/ACTIVE |
| LinkedIn metrics | No real LinkedIn API — cron job output only |
| Mobile layout | Works but not optimized for portrait phone |
| Voice auto-play | Requires user gesture (browser policy) — by design |

---

## License

Personal project — use it as inspiration for your own dashboard. No formal license.

---

*Built with caffeine and Claude Code. JARVIS not included.*
