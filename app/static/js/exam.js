// Exam page — option selection, progress tracking, submit guard, timer, flag, report
(function () {
  var answered = 0;
  var answeredSet = {};
  var flaggedSet  = {};
  var timedOut = false;

  var progressBar   = document.getElementById('progress-bar');
  var progressText  = document.getElementById('progress-text');
  var answeredCount = document.getElementById('answered-count');
  var form          = document.getElementById('exam-form');

  function updateProgress() {
    var pct = TOTAL > 0 ? (answered / TOTAL) * 100 : 0;
    if (progressBar)  progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = answered + ' / ' + TOTAL;
    if (answeredCount) answeredCount.textContent = answered;
  }

  // Called from inline onclick in the template
  window.selectOption = function (el, name, value) {
    var siblings = el.parentNode.querySelectorAll('.option-item');
    siblings.forEach(function (sib) { sib.classList.remove('selected'); });

    el.classList.add('selected');

    var radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    var card = el.closest('.question-card');
    if (card) card.classList.add('answered');

    if (!answeredSet[name]) {
      answeredSet[name] = true;
      answered++;
    }

    updateProgress();
  };

  // ── Flag for review ──────────────────────────────────────────
  window.toggleFlag = function (idx) {
    var card = document.getElementById('qcard-'    + idx);
    var btn  = document.getElementById('flag-btn-' + idx);
    if (flaggedSet[idx]) {
      delete flaggedSet[idx];
      if (card) card.classList.remove('flagged');
      if (btn)  { btn.textContent = '⚑ FLAG'; btn.classList.remove('is-flagged'); }
    } else {
      flaggedSet[idx] = true;
      if (card) card.classList.add('flagged');
      if (btn)  { btn.textContent = '⚑ FLAGGED'; btn.classList.add('is-flagged'); }
    }
    _updateFlagCount();
  };

  function _updateFlagCount() {
    var count = Object.keys(flaggedSet).length;
    var wrap  = document.getElementById('flag-count-wrap');
    var disp  = document.getElementById('flag-count');
    if (wrap) wrap.style.display = count > 0 ? '' : 'none';
    if (disp) disp.textContent = count;
  }

  // ── Report inaccuracy ────────────────────────────────────────
  // GITHUB_REPO is optionally injected by the template.
  window.reportQuestion = function (idx) {
    if (typeof GITHUB_REPO === 'undefined') return;
    var card = document.getElementById('qcard-' + idx);
    var questionText = card
      ? card.querySelector('.question-text').textContent.trim()
      : 'Question ' + (idx + 1);

    var title = '[Report] Q' + (idx + 1) + ' — ' +
                questionText.substring(0, 60) + (questionText.length > 60 ? '…' : '');
    var body  =
      '## Inaccuracy Report\n\n' +
      '**Exam:** ' + EXAM_TITLE + '\n' +
      '**Question #' + (idx + 1) + ':**\n> ' + questionText + '\n\n' +
      '**What is inaccurate:**\n\n\n' +
      '**Suggested correction (if known):**\n\n';

    var url = 'https://github.com/' + GITHUB_REPO + '/issues/new' +
              '?title='  + encodeURIComponent(title) +
              '&body='   + encodeURIComponent(body)  +
              '&labels=' + encodeURIComponent('inaccuracy');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // ── Submit guard — bypassed when timer expires ───────────────
  if (form) {
    form.addEventListener('submit', function (e) {
      if (timedOut) return;
      if (answered < TOTAL) {
        var missing = TOTAL - answered;
        var ok = confirm(
          'WARNING: ' + missing + ' quer' + (missing === 1 ? 'y' : 'ies') +
          ' unanswered.\nUnanswered questions count as incorrect.\n\nProceed with upload?'
        );
        if (!ok) e.preventDefault();
      }
    });
  }

  // ── Abort ────────────────────────────────────────────────────
  window.confirmAbort = function () {
    if (confirm('ABORT MISSION?\nAll progress will be lost.')) {
      if (typeof SESSION_TOKEN !== 'undefined') {
        sessionStorage.removeItem('cad_timer_'   + SESSION_TOKEN);
        sessionStorage.removeItem('cad_elapsed_' + SESSION_TOKEN);
      }
      window.location.href = '/reset';
    }
  };

  // ── Timer ────────────────────────────────────────────────────
  var timerEl      = document.getElementById('exam-timer');
  var timerDisplay = document.getElementById('timer-display');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  if (typeof TIME_LIMIT !== 'undefined' && TIME_LIMIT > 0) {
    // ── Countdown mode ───────────────────────────────────────
    var totalSeconds = TIME_LIMIT * 60;
    var storageKey   = 'cad_timer_' + SESSION_TOKEN;

    var stored    = sessionStorage.getItem(storageKey);
    var startTime = stored ? parseInt(stored, 10) : Date.now();
    if (!stored) sessionStorage.setItem(storageKey, startTime);

    function tick() {
      var elapsed   = Math.floor((Date.now() - startTime) / 1000);
      var remaining = totalSeconds - elapsed;

      if (remaining <= 0) {
        timedOut = true;
        if (timerDisplay) timerDisplay.textContent = '00:00';
        sessionStorage.removeItem(storageKey);
        clearInterval(timerInterval);
        if (form) form.submit();
        return;
      }

      if (timerDisplay) {
        timerDisplay.textContent = pad(Math.floor(remaining / 60)) + ':' + pad(remaining % 60);
      }

      var pctLeft = remaining / totalSeconds;
      if (timerEl) {
        timerEl.classList.remove('timer-warn', 'timer-critical');
        if      (pctLeft <= 0.10) timerEl.classList.add('timer-critical');
        else if (pctLeft <= 0.25) timerEl.classList.add('timer-warn');
      }
    }

    tick();
    var timerInterval = setInterval(tick, 1000);

  } else {
    // ── Count-up elapsed mode ────────────────────────────────
    var elapsedKey   = 'cad_elapsed_' + SESSION_TOKEN;
    var storedStart  = sessionStorage.getItem(elapsedKey);
    var elapsedStart = storedStart ? parseInt(storedStart, 10) : Date.now();
    if (!storedStart) sessionStorage.setItem(elapsedKey, elapsedStart);

    function tickElapsed() {
      var secs = Math.floor((Date.now() - elapsedStart) / 1000);
      if (timerDisplay) {
        timerDisplay.textContent = pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
      }
    }

    tickElapsed();
    setInterval(tickElapsed, 1000);
  }

  updateProgress();
})();
