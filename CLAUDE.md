# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Control-Alt-Defeat is a cyberpunk-themed multichoice web exam application built with Flask. Users select an exam, answer questions, and get graded results with history tracking. Exams are defined as JSON files — no database changes needed to add new content.

## Running the App

**Docker (recommended):**
```bash
docker-compose up --build   # first run
docker-compose up           # subsequent runs
docker-compose down         # stop
```

**Local development:**
```bash
pip install -r requirements.txt
python app/app.py           # http://localhost:5000
```

Key environment variables:
- `SECRET_KEY` — Flask session signing key (defaults to a dev value)
- `HISTORY_DB` — path to SQLite DB (defaults to `app/data/history.db`)
- `GITHUB_REPO` — repo slug for the "report inaccuracy" GitHub issue link (defaults to `x41x41x41/Control-Alt-Defeat`)

There are no automated tests.

## Architecture

### Request Flow

```
/ (GET)     → pick exam + alias
/start (POST) → stratified question sampling + shuffle → session
/exam (GET) → render questions from session
/submit (POST) → grade, persist to SQLite, redirect to /history/<id>
/history/<id> (GET) → per-question breakdown with category stats
```

### State Management

Exam state lives in the Flask session (server-side, cookie-signed). The session holds the selected questions, their order, and the session token. Client identity is tracked via a separate long-lived HTTP-only cookie (`cad_cid`). The alias (display name) is stored in another cookie (`cad_alias`).

### Exam JSON Format

Exams live in `app/exams/*.json`. Each file defines:
- `title`, `description`, `difficulty`, `time_limit` (minutes, 0 = untimed), `pass_mark` (percentage)
- `questions[]` — each with `question`, `options` (object keyed A/B/C/D), `answer` (key), optional `explanation` and `category`
- Optional `based_on`, `created_by`, `links[]` metadata shown in the UI

Question selection is **stratified by category** — the app samples proportionally from each category so all domains are represented in every session.

### Database

Single SQLite table `history` in `app/data/history.db` (or `data/history.db` when running via Docker volume). The schema is created and migrated automatically on startup. Columns of note: `answers` (JSON blob of per-question answer details) and `category_breakdown` (JSON blob of per-category scores).

### Frontend

All styling is in `app/static/css/cyberpunk.css` — a single file with CSS custom properties for the colour palette at the top. No build step; plain CSS and vanilla JS.

`exam.js` handles everything on the exam page: option selection, progress tracking, flag-for-review, the scrollable question map panel, keyboard shortcuts (J/K or arrow keys to navigate, A/B/C/D to answer, F to flag, M to toggle map), and the countdown/elapsed timer via `sessionStorage`.

`index.js` handles exam card selection and alias input on the home page.

`matrix.js` renders the decorative Matrix rain canvas background.
