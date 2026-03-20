#!/usr/bin/env python3
"""Generate state.json for Jeffrey OS Dashboard — run periodically or on demand"""
import json, subprocess, os, time
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

CDT = timezone(timedelta(hours=-6))
now = datetime.now(CDT)

def run(cmd, timeout=10):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.stdout.strip()
    except:
        return ""

def get_crons():
    raw = run("openclaw cron list --json 2>/dev/null")
    if not raw:
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [{"name": c.get("name",""), "schedule": c.get("description",""), "enabled": c.get("enabled",True), "lastStatus": c.get("state",{}).get("lastStatus",""), "nextRun": c.get("state",{}).get("nextRunAtMs",0)} for c in data]
    except:
        pass
    return []

def get_garden_stats():
    try:
        ws_path = os.path.expanduser("~/jeffrey/workspace/projects/ai-garden/experiments/world-state.json")
        with open(ws_path) as f:
            d = json.load(f)
        return {
            "plants": len(d.get("plants", [])),
            "citizens": len(d.get("citizens", [])),
            "factions": len(d.get("factions", [])),
            "threats": len(d.get("threats", [])),
            "events": len(d.get("events", [])),
            "version": d.get("version", 0),
            "structures": len(d.get("structuresBuilt", [])),
        }
    except:
        return {}

def get_git_status(repo_path):
    try:
        # Single git command for both branch and last commit
        raw = run(f"cd {repo_path} && git log --oneline -1 && echo '---SPLIT---' && git branch --show-current")
        parts = raw.split('---SPLIT---')
        return {"lastCommit": parts[0].strip() if len(parts) > 0 else "", "branch": parts[1].strip() if len(parts) > 1 else ""}
    except:
        return {}

def get_pr_count():
    try:
        raw = run("cd ~/jeffrey/workspace/projects/ai-garden && gh pr list --json number 2>/dev/null", timeout=5)
        return len(json.loads(raw)) if raw else 0
    except:
        return 0

# Build state — parallelize slow subprocess calls
with ThreadPoolExecutor(max_workers=5) as pool:
    f_uptime = pool.submit(run, "uptime -p 2>/dev/null || uptime")
    f_hostname = pool.submit(run, "hostname")
    f_git_garden = pool.submit(get_git_status, os.path.expanduser("~/jeffrey/workspace/projects/ai-garden"))
    f_git_airbnb = pool.submit(get_git_status, os.path.expanduser("~/jeffrey/workspace/projects/airbnb-manager"))
    f_prs = pool.submit(get_pr_count)
    f_crons = pool.submit(get_crons)
    f_garden_stats = pool.submit(get_garden_stats)

state = {
    "timestamp": now.isoformat(),
    "uptime": f_uptime.result(),
    "hostname": f_hostname.result(),
    
    "projects": {
        "ai-garden": {
            "status": "active",
            "git": f_git_garden.result(),
            "stats": f_garden_stats.result(),
            "openPRs": f_prs.result(),
            "url": "https://juliosuas.github.io/ai-garden/",
            "repo": "https://github.com/juliosuas/ai-garden",
        },
        "airbnb-manager": {
            "status": "building-mvp",
            "git": f_git_airbnb.result(),
            "phase": "Phase 1: Multi-tenant foundation",
            "repo": "https://github.com/juliosuas/airbnb-manager",
        },
    },

    "tasks": {
        "active": [
            {"name": "AI Garden Civilization", "status": "building", "priority": "high", "detail": "Step-by-step implementation via cron every 30min"},
            {"name": "Airbnb Manager MVP", "status": "building", "priority": "high", "detail": "Multi-tenant, auth, iCal, landing page"},
            {"name": "Garden Camera Fix", "status": "done", "detail": "Reverted to stable, rebuilding carefully"},
        ],
        "pending": [
            {"name": "Lovable → GitHub sync", "status": "blocked", "detail": "Browser was down, needs UI access"},
            {"name": "Dashboard público (internet)", "status": "pending", "detail": "Needs auth before exposing"},
            {"name": "Cobrar página web $15k", "detail": "Hija de Añorve Baños"},
        ],
        "done_today": [
            "PR #4-#13 merged (AI Garden)",
            "Civilization world-state v7",
            "Garden reverted to stable",
            "Airbnb audit complete",
            "README + one-command contribution",
            "Outreach in 3 GitHub communities",
            "Cron configured (garden 30min)",
            "Token optimization (Sonnet for crons)",
        ],
    },

    "reminders": [
        {"text": "Palacio de Hierro $1,915 MXN", "due": "2026-03-20", "status": "OVERDUE"},
        {"text": "2x tokens promo ends", "due": "2026-03-27", "status": "active"},
    ],

    "crons": f_crons.result(),

    "tokens": {
        "plan": "Claude Max 5x",
        "promo": "2x until March 27",
        "model_main": "claude-opus-4-6",
        "model_crons": "claude-sonnet-4",
        "optimization": "Sonnet for routine tasks, Opus for complex builds",
    },

    "infrastructure": {
        "host": "Mac mini M4",
        "ip": "192.168.1.66",
        "os": "macOS (Darwin arm64)",
        "dashboardPort": 8080,
    },
}

# Write state
out_path = os.path.expanduser("~/jeffrey/workspace/projects/jeffrey-os-dashboard/state.json")
with open(out_path, "w") as f:
    json.dump(state, f, indent=2, ensure_ascii=False)

print(f"State updated: {now.strftime('%Y-%m-%d %H:%M:%S')} CDT")
print(f"Garden: {state['projects']['ai-garden']['stats'].get('plants',0)} plants, {state['projects']['ai-garden']['stats'].get('citizens',0)} citizens")
