# Control-Alt-Defeat
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

## Exams

The current exams have been generated using ChatGPT, after giving it some (public) information about exams it's supposed to be helping you prepare for.

Exams live in `/app/exams/*.json`. Each file defines:

- `title`, `description`, `difficulty`, `time_limit` (minutes, 0 = untimed), `pass_mark` (percentage)
- `questions[]` — each with `question`, `options` (object keyed A/B/C/D), `answer` (key), optional `explanation` and `category`
- Optional `based_on`, `created_by`, `links[]` metadata shown in the UI

Question selection is **stratified by category** — the app samples proportionally from each category so all domains are represented in every session.

### Creating Exams

1. Follow the JSON format outlined above, if your using AI to create your exam then worth giving it an example json file as well.
2. Place the file in `/app/exams/` and rebuild the container `docker-compose up --build`

### Reporting Issues/Inaccuracies

For exams build via AI, inaccuracies and issues can be expected. Use the "report" button on the question to create a templated github issue. Alternatively, just create the issue directly try to detail both the issue and the correction.

