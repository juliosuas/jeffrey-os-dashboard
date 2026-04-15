# DASHBOARD_STATUS.md — Jeffrey OS Dashboard v6.2

**Last Updated:** 2026-04-03  
**Status:** LIVE at http://localhost:8080 / http://192.168.1.66:8080

---

## ✅ What Works (Live Data)

### Phase 1 — Morning Briefing System
- **Voice Narration** (`briefing.js`): Web Speech API with JARVIS-style settings
  - Pitch: 0.8, Rate: 0.9 — prefers Google UK English Male voice
  - Auto-plays after first user interaction (click/keypress) — browser policy compliance
  - Manual trigger: "▶ PLAY BRIEFING" button in top panel
  - Pause/resume toggle support
  - Builds briefing from live state: load, memory, project count, PR count, weather, garden stats, Hacker News headline
- **Briefing Panel** (full-width top): Large animated clock, date, weather widget, play button, summary stats
- **Hacker News Feed** (`briefing.js`): 5 top stories, refreshes every 5 min, click opens in new tab
  - Primary: HN Firebase API; Fallback: Algolia API

### Phase 2 — Real-Time Data (`update-state.py`)
- **GitHub PRs**: `gh pr list --author juliosuas` — live open PR count and mergeable status
- **Weather**: wttr.in for Mexico City + Acapulco — temp, condition, humidity, wind, emoji icon
- **OpenClaw Status**: `openclaw doctor --non-interactive` — parsed into ok/warn/error
- **State refresh**: Every 15 seconds (Node server internal loop)

### Phase 3 — New UI Panels
- **Morning Briefing Panel** (col-12): Clock, weather, play button, summary stats
- **PR Intelligence Panel** (col-4): Open PRs grouped by repo with MERGEABLE ✅ / CONFLICTING ❌ badges
- **Hacker News Feed Panel** (col-4): Live headlines, auto-refresh every 5 min
- **System Health Panel** (col-4): OpenClaw status, WhatsApp, iMessage, Dashboard, State Feed age, Cron errors

### Phase 4 — Deployment
- **Server**: `node server.js` running on :8080 — regenerates state every 15s
- **start.sh**: `./start.sh` — kills existing server, generates fresh state, starts node
- **State.json keys**: timestamp, system, garden, projects, crons, prs, weather, openclawStatus, infrastructure, tokens

---

## 🟡 Mock / Hardcoded Data

| Item | Status | Notes |
|------|--------|-------|
| Airbnb bookings | Hardcoded | `0 reservas` — real API not integrated |
| Airbnb prices | Hardcoded | $3,200 / $3,500 / $2,500 |
| WhatsApp status | Hardcoded | Shows "CONNECTED" always |
| iMessage status | Hardcoded | Shows "ACTIVE" always |
| LinkedIn metrics | Hardcoded | Cron-based, no real metrics |
| Brightspace | Hardcoded | Cron-based only |
| OSS PR list | Parses markdown | From `/api/contribution-queue` endpoint |

---

## 🔴 Known Issues / Limitations

1. **Voice auto-play**: Browsers require a user gesture before TTS — briefing plays on first click, not literally on page load
2. **GitHub PRs**: If `gh` CLI has no auth or juliosuas has no open PRs, returns empty list (gracefully shows "No open PRs — all clear")
3. **Server restart**: ✅ RESUELTO — `install-autostart.sh` instala launchd plist que arranca en cada login
4. **Mobile landscape**: Basic responsive CSS from col-12 fallback — works but not optimized

---

## 🚀 Next Steps

1. **Auto-restart on reboot**: ✅ DONE — `install-autostart.sh` crea launchd plist + abre Chrome automáticamente
2. **Real Airbnb integration**: Connect to Airbnb API or calendar scrape for actual booking data
3. **WhatsApp/iMessage health**: Check via OpenClaw API endpoint for real plugin status
4. **PR detail view**: Click PR to open GitHub URL directly from dashboard
5. **Notification system**: Alert panel when cron errors exceed threshold or PRs go stale
6. **Webcam/Snapshot**: Add camera panel (living-room cam noted in TOOLS.md)
7. **OpenClaw cron for state**: Add `openclaw cron create` that runs `python3 update-state.py` every 5m for redundancy when Node server is down

---

## Architecture

```
jeffery-os-dashboard/
├── index.html          # Main dashboard UI (v6.2) — cyberpunk JARVIS UI
├── briefing.js         # Morning briefing: voice, news feed, PR rendering
├── server.js           # Node.js server — serves files + API endpoints, regenerates state every 15s
├── server.py           # Python server (legacy, replaced by server.js)
├── update-state.py     # State generator — system, garden, projects, PRs, weather, OpenClaw
├── state.json          # Live state data (auto-updated)
├── start.sh            # Server startup script
└── DASHBOARD_STATUS.md # This file
```

**Server Endpoints:**
- `GET /` → index.html
- `GET /api/state` → state.json
- `GET /api/crons` → live openclaw cron list
- `GET /api/contribution-queue` → OSS PR markdown report
- `GET /api/cron-log` → recent cron log entries
- `POST /api/cron/:id/run` → trigger cron
- `POST /api/cron/:id/toggle` → enable/disable cron
