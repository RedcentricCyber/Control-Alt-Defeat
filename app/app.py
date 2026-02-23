import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template, request, session, redirect, url_for, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "cyberpunk-secret-key-change-in-prod")

EXAMS_DIR = Path(__file__).parent / "exams"


def load_exam(exam_id):
    exam_path = EXAMS_DIR / f"{exam_id}.json"
    if not exam_path.exists():
        return None
    with open(exam_path) as f:
        return json.load(f)


def list_exams():
    exams = []
    for path in sorted(EXAMS_DIR.glob("*.json")):
        try:
            with open(path) as f:
                data = json.load(f)
            exams.append({
                "id": path.stem,
                "title": data.get("title", path.stem),
                "description": data.get("description", ""),
                "difficulty": data.get("difficulty", "UNKNOWN"),
                "question_count": len(data.get("questions", [])),
                "pass_mark": data.get("pass_mark", 70),
            })
        except (json.JSONDecodeError, KeyError):
            continue
    return exams


@app.route("/")
def index():
    exams = list_exams()
    history = session.get("history", [])
    return render_template("index.html", exams=exams, history=history)


@app.route("/start", methods=["POST"])
def start():
    alias = request.form.get("alias", "").strip()
    exam_id = request.form.get("exam_id", "").strip()

    if not alias:
        return redirect(url_for("index"))

    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    # Preserve history across exam starts
    history = session.get("history", [])
    session.clear()
    session["history"] = history

    # Store exam state in session
    session["alias"] = alias
    session["exam_id"] = exam_id
    session["exam_title"] = exam.get("title", exam_id)
    session["answers"] = {}
    session["started"] = True
    session["session_token"] = str(uuid.uuid4())[:8].upper()

    return redirect(url_for("exam"))


@app.route("/exam")
def exam():
    if not session.get("started"):
        return redirect(url_for("index"))

    exam_id = session.get("exam_id")
    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    return render_template(
        "exam.html",
        exam=exam,
        alias=session.get("alias"),
        token=session.get("session_token"),
    )


@app.route("/submit", methods=["POST"])
def submit():
    if not session.get("started"):
        return redirect(url_for("index"))

    exam_id = session.get("exam_id")
    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    questions = exam.get("questions", [])
    pass_mark = exam.get("pass_mark", 70)
    answers = {}
    score = 0
    results = []

    for i, question in enumerate(questions):
        key = f"q{i}"
        selected = request.form.get(key)
        correct = question.get("correct")
        is_correct = selected == correct
        if is_correct:
            score += 1
        answers[key] = selected
        results.append({
            "index": i,
            "question": question.get("question"),
            "options": question.get("options", {}),
            "selected": selected,
            "correct": correct,
            "is_correct": is_correct,
            "explanation": question.get("explanation", ""),
        })

    total = len(questions)
    percentage = round((score / total) * 100) if total > 0 else 0
    passed = percentage >= pass_mark

    grade = _grade(percentage)

    # Append to session history
    history = session.get("history", [])
    history.append({
        "exam_title": session.get("exam_title", exam_id),
        "alias": session.get("alias", "UNKNOWN"),
        "score": score,
        "total": total,
        "percentage": percentage,
        "pass_mark": pass_mark,
        "passed": passed,
        "grade_label": grade["label"],
        "grade_class": grade["class"],
        "token": session.get("session_token", "--------"),
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    })

    session["results"] = results
    session["score"] = score
    session["total"] = total
    session["percentage"] = percentage
    session["pass_mark"] = pass_mark
    session["passed"] = passed
    session["grade"] = grade
    session["started"] = False
    session["history"] = history

    return redirect(url_for("results"))


def _grade(pct):
    if pct >= 90:
        return {"label": "ELITE HACKER", "class": "elite", "msg": "You've cracked the mainframe. The net is yours."}
    elif pct >= 75:
        return {"label": "NETRUNNER", "class": "netrunner", "msg": "Solid jack-in. You know your way around the system."}
    elif pct >= 60:
        return {"label": "SCRIPT KID", "class": "scriptkid", "msg": "Not bad. Keep practicing and you'll level up."}
    elif pct >= 40:
        return {"label": "LURKER", "class": "lurker", "msg": "You're on the outside looking in. Hit the databanks harder."}
    else:
        return {"label": "FLATLINED", "class": "flatlined", "msg": "You got iced. Time to re-learn the basics."}


@app.route("/results")
def results():
    if not session.get("results"):
        return redirect(url_for("index"))

    return render_template(
        "results.html",
        alias=session.get("alias"),
        token=session.get("session_token"),
        exam_title=session.get("exam_title"),
        results=session.get("results", []),
        score=session.get("score", 0),
        total=session.get("total", 0),
        percentage=session.get("percentage", 0),
        pass_mark=session.get("pass_mark", 70),
        passed=session.get("passed", False),
        grade=session.get("grade", {}),
    )


@app.route("/reset")
def reset():
    # Preserve history across resets so it persists within the session
    history = session.get("history", [])
    session.clear()
    session["history"] = history
    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
