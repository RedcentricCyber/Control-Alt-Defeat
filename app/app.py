import json
import logging
import os
import random
import re
import secrets
import sqlite3
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, abort, flash, get_flashed_messages, make_response, render_template, request, session, redirect, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "cyberpunk-secret-key-change-in-prod")

# ── Session cookie hardening ─────────────────────────────────
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
# Set Secure flag when running in production (HTTPS)
_PRODUCTION = os.environ.get("CAD_PRODUCTION", "").strip().lower() in ("1", "true", "yes")
if _PRODUCTION:
    app.config["SESSION_COOKIE_SECURE"] = True

# ── Logging ───────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_DEFAULT_SECRET = "cyberpunk-secret-key-change-in-prod"
if app.secret_key == _DEFAULT_SECRET:
    logger.warning(
        "SECRET_KEY is set to the default development value — "
        "set the SECRET_KEY environment variable before deploying to production!"
    )

EXAMS_DIR = Path(__file__).parent / "exams"
DB_PATH = Path(os.environ.get("HISTORY_DB", Path(__file__).parent / "data" / "history.db"))

CLIENT_ID_COOKIE = "cad_client_id"
ALIAS_COOKIE     = "cad_alias"
CLIENT_ID_MAX_AGE = 365 * 24 * 3600  # 1 year
ALIAS_MAX_LENGTH = 32
GITHUB_REPO = os.environ.get("GITHUB_REPO", "RedcentricCyber/Control-Alt-Defeat")

# UUID4 pattern for validating client_id cookies
_UUID4_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)

# ── Rate limiting ─────────────────────────────────────────────
# Simple in-memory store: client_id → last submit timestamp.
# Note: not shared across gunicorn workers; provides per-worker limiting.

_submit_times: dict = {}
_SUBMIT_COOLDOWN = 10  # seconds between submissions per client


def _check_rate_limit(client_id: str) -> bool:
    """Return True if the request is within the allowed rate, False if throttled."""
    now = time.time()
    last = _submit_times.get(client_id, 0)
    if now - last < _SUBMIT_COOLDOWN:
        return False
    _submit_times[client_id] = now
    # Prune stale entries to avoid unbounded growth
    if len(_submit_times) > 5000:
        cutoff = now - _SUBMIT_COOLDOWN * 2
        stale = [k for k, v in _submit_times.items() if v < cutoff]
        for k in stale:
            del _submit_times[k]
    return True


# ── CSRF ──────────────────────────────────────────────────────

def _get_csrf_token() -> str:
    """Return (and lazily create) the per-session CSRF token."""
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return session["csrf_token"]


def _generate_csp_nonce() -> str:
    """Generate a per-request CSP nonce and store it on flask.g."""
    from flask import g
    nonce = secrets.token_urlsafe(32)
    g.csp_nonce = nonce
    return nonce


def _check_csrf():
    """Abort 403 if the submitted CSRF token doesn't match the session token."""
    token = request.form.get("csrf_token", "")
    if not token or token != session.get("csrf_token"):
        logger.warning("CSRF check failed — remote_addr=%s", request.remote_addr)
        abort(403)


# ── Security headers ──────────────────────────────────────────

@app.after_request
def set_security_headers(response):
    # Use per-request nonce for inline scripts (set by the view via g.csp_nonce)
    from flask import g
    nonce = getattr(g, "csp_nonce", "")
    nonce_src = f"'nonce-{nonce}'" if nonce else "'unsafe-inline'"
    csp = (
        "default-src 'self'; "
        f"script-src 'self' {nonce_src}; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data:; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )
    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if _PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Database ─────────────────────────────────────────────────

def get_db():
    db = sqlite3.connect(str(DB_PATH))
    db.row_factory = sqlite3.Row
    return db


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_db() as db:
        db.execute("""
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                client_id   TEXT    NOT NULL,
                exam_title  TEXT,
                alias       TEXT,
                score       INTEGER,
                total       INTEGER,
                percentage  INTEGER,
                pass_mark   INTEGER,
                passed      INTEGER,
                grade_label TEXT,
                grade_class TEXT,
                token       TEXT,
                timestamp   TEXT
            )
        """)
        db.execute("CREATE INDEX IF NOT EXISTS idx_client_id ON history(client_id)")
        # Migrate: add answers column for per-attempt question detail
        try:
            db.execute("ALTER TABLE history ADD COLUMN answers TEXT")
        except sqlite3.OperationalError:
            pass  # column already exists
        # Migrate: add time_taken for duration tracking
        try:
            db.execute("ALTER TABLE history ADD COLUMN time_taken INTEGER")
        except sqlite3.OperationalError:
            pass  # column already exists
        db.commit()


init_db()


def get_history(client_id):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM history WHERE client_id = ? ORDER BY id DESC LIMIT 50",
            (client_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def insert_history(client_id, entry, answers=None, time_taken=None):
    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO history
               (client_id, exam_title, alias, score, total, percentage,
                pass_mark, passed, grade_label, grade_class, token, timestamp, answers, time_taken)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                client_id,
                entry["exam_title"],
                entry["alias"],
                entry["score"],
                entry["total"],
                entry["percentage"],
                entry["pass_mark"],
                int(entry["passed"]),
                entry["grade_label"],
                entry["grade_class"],
                entry["token"],
                entry["timestamp"],
                json.dumps(answers) if answers is not None else None,
                time_taken,
            ),
        )
        db.commit()
        return cursor.lastrowid


def get_history_entry(entry_id, client_id):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM history WHERE id = ? AND client_id = ?",
            (entry_id, client_id),
        ).fetchone()
    return dict(row) if row else None


def _compute_category_breakdown(answers):
    """Return per-category correct/total/percentage, preserving question order."""
    by_cat = {}
    order = []
    for r in answers:
        cat = r.get("category", "")
        if not cat:
            continue
        if cat not in by_cat:
            by_cat[cat] = {"correct": 0, "total": 0}
            order.append(cat)
        by_cat[cat]["total"] += 1
        if r.get("is_correct"):
            by_cat[cat]["correct"] += 1
    return [
        {
            "category": cat,
            "correct": by_cat[cat]["correct"],
            "total": by_cat[cat]["total"],
            "percentage": round(by_cat[cat]["correct"] / by_cat[cat]["total"] * 100),
        }
        for cat in order
    ]


def _ensure_client_id(response):
    """Return (client_id, modified) — sets cookie on response if new."""
    client_id = request.cookies.get(CLIENT_ID_COOKIE)
    if client_id and _UUID4_RE.match(client_id):
        return client_id, False
    client_id = str(uuid.uuid4())
    response.set_cookie(
        CLIENT_ID_COOKIE,
        client_id,
        max_age=CLIENT_ID_MAX_AGE,
        samesite="Lax",
        httponly=True,
    )
    return client_id, True


# ── Exam helpers ─────────────────────────────────────────────

def load_exam(exam_id):
    # Validate exam_id to prevent path traversal — allow only alphanumeric, hyphens, underscores
    if not exam_id or not all(c.isalnum() or c in "-_" for c in exam_id):
        return None
    exam_path = (EXAMS_DIR / f"{exam_id}.json").resolve()
    # Double-check the resolved path is inside the exams directory
    if not str(exam_path).startswith(str(EXAMS_DIR.resolve())):
        return None
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
            pool_size = len(data.get("questions", []))
            exams.append({
                "id": path.stem,
                "title": data.get("title", path.stem),
                "description": data.get("description", ""),
                "based_on": data.get("based_on", ""),
                "created_by": data.get("created_by", ""),
                "difficulty": data.get("difficulty", "UNKNOWN"),
                "num_questions": data.get("num_questions", pool_size),
                "pool_size": pool_size,
                "categories": sorted({
                    q["category"] for q in data.get("questions", []) if q.get("category")
                }),
                "pass_mark": data.get("pass_mark", 70),
                "time_limit": data.get("time_limit", 0),
                "links": data.get("links", []),
            })
        except (json.JSONDecodeError, KeyError) as exc:
            logger.error("Failed to load exam %s: %s", path.name, exc)
            continue
    return exams


def select_question_indices(questions, num_questions):
    """Return a shuffled list of indices into `questions` to serve.

    When questions carry a 'category' field the selection is stratified:
    slots are divided as evenly as possible across all categories so every
    category is represented.  Questions without a category fall into a
    fallback pool used to top up any shortfall.

    If num_questions >= pool size every question is returned (shuffled).
    """
    n = len(questions)
    if num_questions >= n:
        result = list(range(n))
        random.shuffle(result)
        return result

    # Bucket indices by category
    by_cat = defaultdict(list)
    for i, q in enumerate(questions):
        by_cat[q.get("category") or ""].append(i)

    uncategorized = by_cat.pop("", [])
    cats = list(by_cat.keys())

    if not cats:
        # No categories defined — plain random sample
        pool = list(range(n))
        random.shuffle(pool)
        return pool[:num_questions]

    # Distribute slots across categories
    n_cats = len(cats)
    base = num_questions // n_cats
    remainder = num_questions % n_cats

    selected = []
    for idx, cat in enumerate(cats):
        take = base + (1 if idx < remainder else 0)
        pool = by_cat[cat][:]
        random.shuffle(pool)
        selected.extend(pool[:take])

    # Top up with uncategorized / overflow if any category was under-stocked
    if len(selected) < num_questions:
        already = set(selected)
        extras = [i for i in uncategorized if i not in already]
        # Also pull from over-stocked categories if still short
        for cat in cats:
            extras += [i for i in by_cat[cat] if i not in already and i not in extras]
        random.shuffle(extras)
        selected.extend(extras[:num_questions - len(selected)])

    random.shuffle(selected)
    return selected


# ── Routes ───────────────────────────────────────────────────

@app.route("/")
def index():
    exams = list_exams()
    resp = make_response()
    client_id, _ = _ensure_client_id(resp)
    history = get_history(client_id)
    saved_alias = request.cookies.get(ALIAS_COOKIE, "")
    csrf_token = _get_csrf_token()
    resp.response = [render_template(
        "index.html",
        exams=exams,
        history=history,
        saved_alias=saved_alias,
        csrf_token=csrf_token,
    ).encode()]
    resp.content_type = "text/html"
    return resp


@app.route("/start", methods=["POST"])
def start():
    _check_csrf()

    alias = request.form.get("alias", "").strip()[:ALIAS_MAX_LENGTH]
    exam_id = request.form.get("exam_id", "").strip()

    if not alias:
        return redirect(url_for("index"))

    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    all_questions = exam.get("questions", [])
    pool_size = len(all_questions)

    # Number of questions — use form override if valid, else exam default
    try:
        num_questions = max(1, min(int(request.form.get("num_questions", "")), pool_size))
    except (ValueError, TypeError):
        num_questions = min(exam.get("num_questions", pool_size), pool_size)

    question_indices = select_question_indices(all_questions, num_questions)

    session.clear()
    session["alias"] = alias
    session["exam_id"] = exam_id
    session["exam_title"] = exam.get("title", exam_id)
    session["question_indices"] = question_indices
    session["started"] = True
    session["session_token"] = str(uuid.uuid4())[:8].upper()
    session["start_time"] = int(time.time())

    # Time limit — use form override if valid, else leave unset (exam default used in /exam)
    try:
        session["time_limit_override"] = max(0, min(int(request.form.get("time_limit_override", "")), 9999))
    except (ValueError, TypeError):
        pass  # no override — /exam will use exam.time_limit directly

    logger.info("Exam started — alias=%r exam=%r questions=%d", alias, exam_id, len(question_indices))

    resp = redirect(url_for("exam"))
    resp.set_cookie(ALIAS_COOKIE, alias, max_age=CLIENT_ID_MAX_AGE, samesite="Lax", httponly=True)
    return resp


@app.route("/exam")
def exam():
    if not session.get("started"):
        return redirect(url_for("index"))

    exam_id = session.get("exam_id")
    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    all_questions = exam.get("questions", [])
    indices = session.get("question_indices", list(range(len(all_questions))))
    exam["questions"] = [all_questions[i] for i in indices]

    # Apply time limit override if the user customised it on the index page
    tl_override = session.get("time_limit_override")
    if tl_override is not None:
        exam["time_limit"] = tl_override

    return render_template(
        "exam.html",
        exam=exam,
        alias=session.get("alias"),
        token=session.get("session_token"),
        github_repo=GITHUB_REPO,
        csrf_token=_get_csrf_token(),
        csp_nonce=_generate_csp_nonce(),
    )


@app.route("/submit", methods=["POST"])
def submit():
    _check_csrf()

    if not session.get("started"):
        return redirect(url_for("index"))

    raw_cid = request.cookies.get(CLIENT_ID_COOKIE, "")
    client_id = raw_cid if _UUID4_RE.match(raw_cid) else str(uuid.uuid4())

    if not _check_rate_limit(client_id):
        logger.warning("Rate limit hit on /submit — client_id=%s", client_id)
        return render_template("429.html"), 429

    exam_id = session.get("exam_id")
    exam = load_exam(exam_id)
    if not exam:
        return redirect(url_for("index"))

    all_questions = exam.get("questions", [])
    indices = session.get("question_indices", list(range(len(all_questions))))
    questions = [all_questions[i] for i in indices]

    pass_mark = exam.get("pass_mark", 70)
    score = 0
    results = []

    for i, question in enumerate(questions):
        key = f"q{i}"
        selected = request.form.get(key)
        correct = question.get("correct")
        is_correct = selected == correct
        if is_correct:
            score += 1
        results.append({
            "index": i,
            "question": question.get("question"),
            "options": question.get("options", {}),
            "selected": selected,
            "correct": correct,
            "is_correct": is_correct,
            "explanation": question.get("explanation", ""),
            "category": question.get("category", ""),
        })

    total = len(questions)
    percentage = round((score / total) * 100) if total > 0 else 0
    passed = percentage >= pass_mark
    grade = _grade(percentage)
    time_taken = int(time.time()) - session.get("start_time", int(time.time()))

    entry_id = insert_history(client_id, {
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
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    }, answers=results, time_taken=time_taken)

    if passed and exam.get("reward"):
        flash(exam["reward"], "reward")

    logger.info(
        "Exam submitted — alias=%r exam=%r score=%d/%d (%.0f%%) passed=%s entry_id=%d",
        session.get("alias"), exam_id, score, total, percentage, passed, entry_id,
    )

    session["started"] = False

    return redirect(url_for("history_detail", entry_id=entry_id))


def _grade(pct):
    if pct >= 90:
        return {"label": "ELITE HACKER",  "class": "elite",     "msg": "You've cracked the mainframe. The net is yours."}
    elif pct >= 75:
        return {"label": "NETRUNNER",     "class": "netrunner", "msg": "Solid jack-in. You know your way around the system."}
    elif pct >= 60:
        return {"label": "SCRIPT KID",    "class": "scriptkid", "msg": "Not bad. Keep practicing and you'll level up."}
    elif pct >= 40:
        return {"label": "LURKER",        "class": "lurker",    "msg": "You're on the outside looking in. Hit the databanks harder."}
    else:
        return {"label": "FLATLINED",     "class": "flatlined", "msg": "You got iced. Time to re-learn the basics."}


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


@app.route("/history")
def history_list():
    client_id = request.cookies.get(CLIENT_ID_COOKIE, "")
    if not _UUID4_RE.match(client_id):
        return redirect(url_for("index"))
    history = get_history(client_id)
    return render_template("history_list.html", history=history)


@app.route("/history/<int:entry_id>")
def history_detail(entry_id):
    client_id = request.cookies.get(CLIENT_ID_COOKIE, "")
    if not _UUID4_RE.match(client_id):
        return redirect(url_for("index"))

    entry = get_history_entry(entry_id, client_id)
    if not entry:
        return redirect(url_for("index"))

    answers = json.loads(entry["answers"]) if entry.get("answers") else None
    category_breakdown = _compute_category_breakdown(answers) if answers else []
    grade = {"label": entry["grade_label"], "class": entry["grade_class"]}

    reward_messages = get_flashed_messages(category_filter=["reward"])
    reward = reward_messages[0] if reward_messages else None

    return render_template(
        "history_detail.html",
        entry=entry,
        answers=answers,
        category_breakdown=category_breakdown,
        grade=grade,
        reward=reward,
        github_repo=GITHUB_REPO,
        csp_nonce=_generate_csp_nonce(),
    )


@app.route("/reset")
def reset():
    session.clear()
    return redirect(url_for("index"))


# ── Error handlers ────────────────────────────────────────────

@app.errorhandler(403)
def forbidden(e):
    return render_template("403.html"), 403


@app.errorhandler(404)
def not_found(e):
    return render_template("404.html"), 404


@app.errorhandler(429)
def too_many_requests(e):
    return render_template("429.html"), 429


@app.errorhandler(500)
def server_error(e):
    logger.exception("Internal server error")
    return render_template("500.html"), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
