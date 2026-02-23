// Exam page — option selection, progress, timer, flags, question map, report
(function () {
  var answered    = 0;
  var answeredSet = {};   // keyed by "q{idx}"
  var flaggedSet  = {};   // keyed by numeric idx
  var visibleCards = {};  // keyed by numeric idx (IntersectionObserver)
  var timedOut    = false;

  var progressBar   = document.getElementById('progress-bar');
  var progressText  = document.getElementById('progress-text');
  var answeredCount = document.getElementById('answered-count');
  var form          = document.getElementById('exam-form');

  // ── Progress ─────────────────────────────────────────────────
  function updateProgress() {
    var pct = TOTAL > 0 ? (answered / TOTAL) * 100 : 0;
    if (progressBar)   progressBar.style.width = pct + '%';
    if (progressText)  progressText.textContent = answered + ' / ' + TOTAL;
    if (answeredCount) answeredCount.textContent = answered;
  }

  // ── Option selection ──────────────────────────────────────────
  window.selectOption = function (el, name, value) {
    var siblings = el.parentNode.querySelectorAll('.option-item');
    siblings.forEach(function (sib) { sib.classList.remove('selected'); });
    el.classList.add('selected');

    var radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    var card = el.closest('.question-card');
    if (card) card.classList.add('answered');

    var idx = parseInt(name.replace('q', ''), 10);
    if (!answeredSet[name]) {
      answeredSet[name] = true;
      answered++;
    }
    updateProgress();
    _updateMapBox(idx);
  };

  // ── Flag for review ───────────────────────────────────────────
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
    _updateMapBox(idx);
  };

  function _updateFlagCount() {
    var count   = Object.keys(flaggedSet).length;
    var wrap    = document.getElementById('flag-count-wrap');
    var disp    = document.getElementById('flag-count');
    var jumpBtn = document.getElementById('q-map-flagged-btn');
    if (wrap)    wrap.style.display    = count > 0 ? '' : 'none';
    if (disp)    disp.textContent      = count;
    if (jumpBtn) jumpBtn.style.display = count > 0 ? '' : 'none';
  }

  // ── Report inaccuracy ─────────────────────────────────────────
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

  // ── Question map ──────────────────────────────────────────────
  function _buildMap() {
    var grid = document.getElementById('q-map-grid');
    if (!grid) return;

    for (var i = 0; i < TOTAL; i++) {
      (function (idx) {
        var box = document.createElement('button');
        box.type      = 'button';
        box.className = 'q-map-box';
        box.id        = 'map-box-' + idx;
        box.title     = 'Q' + (idx + 1);
        box.textContent = idx + 1;
        box.onclick = function () {
          var card = document.getElementById('qcard-' + idx);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        grid.appendChild(box);
      })(i);
    }

    // Track which card is topmost in the viewport
    if (window.IntersectionObserver) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var idx = parseInt(entry.target.id.replace('qcard-', ''), 10);
          if (entry.isIntersecting) {
            visibleCards[idx] = true;
          } else {
            delete visibleCards[idx];
          }
        });
        _updateCurrentBox();
      }, { rootMargin: '-56px 0px -20% 0px', threshold: 0.15 });

      for (var j = 0; j < TOTAL; j++) {
        var card = document.getElementById('qcard-' + j);
        if (card) observer.observe(card);
      }
    }
  }

  function _updateCurrentBox() {
    var keys = Object.keys(visibleCards).map(Number);
    var topmost = keys.length > 0 ? Math.min.apply(null, keys) : -1;
    for (var i = 0; i < TOTAL; i++) {
      var box = document.getElementById('map-box-' + i);
      if (box) {
        if (i === topmost) box.classList.add('is-current');
        else               box.classList.remove('is-current');
      }
    }
  }

  // Reflects answered + flagged state on a single map box
  function _updateMapBox(idx) {
    var box = document.getElementById('map-box-' + idx);
    if (!box) return;
    box.classList.remove('is-answered', 'is-flagged');
    if (flaggedSet[idx]) {
      box.classList.add('is-flagged');
    } else if (answeredSet['q' + idx]) {
      box.classList.add('is-answered');
    }
  }

  window.toggleMap = function () {
    var body    = document.getElementById('q-map-body');
    var chevron = document.getElementById('q-map-chevron');
    if (!body) return;
    if (body.style.display === 'none') {
      body.style.display = '';
      if (chevron) chevron.textContent = '▴';
    } else {
      body.style.display = 'none';
      if (chevron) chevron.textContent = '▾';
    }
  };

  window.jumpToFirstFlagged = function () {
    var keys = Object.keys(flaggedSet).map(Number);
    if (keys.length === 0) return;
    var first = Math.min.apply(null, keys);
    var card  = document.getElementById('qcard-' + first);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  // ── Submit guard ──────────────────────────────────────────────
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

  // ── Abort ─────────────────────────────────────────────────────
  window.confirmAbort = function () {
    if (confirm('ABORT MISSION?\nAll progress will be lost.')) {
      if (typeof SESSION_TOKEN !== 'undefined') {
        sessionStorage.removeItem('cad_timer_'   + SESSION_TOKEN);
        sessionStorage.removeItem('cad_elapsed_' + SESSION_TOKEN);
      }
      window.location.href = '/reset';
    }
  };

  // ── Timer ─────────────────────────────────────────────────────
  var timerEl      = document.getElementById('exam-timer');
  var timerDisplay = document.getElementById('timer-display');

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  if (typeof TIME_LIMIT !== 'undefined' && TIME_LIMIT > 0) {
    // Countdown
    var totalSeconds = TIME_LIMIT * 60;
    var storageKey   = 'cad_timer_' + SESSION_TOKEN;
    var stored       = sessionStorage.getItem(storageKey);
    var startTime    = stored ? parseInt(stored, 10) : Date.now();
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
    // Count-up elapsed
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

  // ── Init ──────────────────────────────────────────────────────
  updateProgress();
  _buildMap();
})();
