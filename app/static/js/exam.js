// Exam page — option selection, progress tracking, submit guard, countdown timer
(function () {
  var answered = 0;
  var answeredSet = {};
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

  // Submit guard — bypassed when timer expires (timedOut = true)
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

  // Abort — also clears the persisted timer start time
  window.confirmAbort = function () {
    if (confirm('ABORT MISSION?\nAll progress will be lost.')) {
      if (typeof SESSION_TOKEN !== 'undefined') {
        sessionStorage.removeItem('cad_timer_' + SESSION_TOKEN);
      }
      window.location.href = '/reset';
    }
  };

  // ── Countdown timer ─────────────────────────────────────────
  // TIME_LIMIT is injected by the template (minutes); 0 = untimed.
  // Start time is stored in sessionStorage so a page refresh does not
  // reset the clock — the timer picks up where it left off.
  if (typeof TIME_LIMIT !== 'undefined' && TIME_LIMIT > 0) {
    var totalSeconds = TIME_LIMIT * 60;
    var storageKey   = 'cad_timer_' + SESSION_TOKEN;
    var timerEl      = document.getElementById('exam-timer');
    var timerDisplay = document.getElementById('timer-display');

    var stored    = sessionStorage.getItem(storageKey);
    var startTime = stored ? parseInt(stored, 10) : Date.now();
    if (!stored) sessionStorage.setItem(storageKey, startTime);

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

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

    tick(); // run immediately so display is correct on load
    var timerInterval = setInterval(tick, 1000);
  }

  updateProgress();
})();
