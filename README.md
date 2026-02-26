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
