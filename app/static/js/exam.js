// Exam page — option selection, progress, timer, flags, question map, keyboard nav, report
(function () {
  var answered     = 0;
  var answeredSet  = {};   // keyed by "q{idx}"
  var flaggedSet   = {};   // keyed by numeric idx
  var currentCard  = 0;    // index of the card currently at/past the sticky bar
  var timedOut     = false;

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

  // ── Current-card tracking (scroll-based) ─────────────────────
  //
  // We find the sticky bar's height once so we know where the
  // "reading line" is.  A card becomes current the moment its top
  // edge scrolls up to that line.
  var _stickyOffset = (function () {
    var bar = document.querySelector('.exam-sticky-bar');
    return bar ? bar.offsetHeight + 16 : 64;
  })();

  // Scan all cards and return the index of the last one whose top
  // edge is at or above the sticky reading line.
  function _computeCurrentCard() {
    var found = 0;
    for (var i = 0; i < TOTAL; i++) {
      var card = document.getElementById('qcard-' + i);
      if (!card) continue;
      if (card.getBoundingClientRect().top <= _stickyOffset) {
        found = i;
      } else {
        break; // cards are in DOM order — safe to stop early
      }
    }
    return found;
  }

  function _syncCurrentCard() {
    var found = _computeCurrentCard();
    if (found !== currentCard) {
      currentCard = found;
      _updateCurrentBox();
    }
  }

  // Passive scroll listener — fires on every scroll tick
  window.addEventListener('scroll', _syncCurrentCard, { passive: true });

  // ── Question map ──────────────────────────────────────────────
  function _buildMap() {
    var grid = document.getElementById('q-map-grid');
    if (!grid) return;

    for (var i = 0; i < TOTAL; i++) {
      (function (idx) {
        var box = document.createElement('button');
        box.type        = 'button';
        box.className   = 'q-map-box';
        box.id          = 'map-box-' + idx;
        box.title       = 'Q' + (idx + 1);
        box.textContent = idx + 1;
        box.onclick = function () {
          // Optimistically highlight the clicked box immediately so it
          // feels responsive before the scroll animation completes.
          currentCard = idx;
          _updateCurrentBox();
          var card = document.getElementById('qcard-' + idx);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        grid.appendChild(box);
      })(i);
    }

    // Auto-expand the map on wide screens
    if (window.innerWidth >= 900) {
      var body    = document.getElementById('q-map-body');
      var chevron = document.getElementById('q-map-chevron');
      if (body)    body.style.display = '';
      if (chevron) chevron.textContent = '▴';
    }

    // Sync initial highlight after layout has settled
    setTimeout(_syncCurrentCard, 50);
  }

  function _updateCurrentBox() {
    for (var i = 0; i < TOTAL; i++) {
      var box = document.getElementById('map-box-' + i);
      if (box) {
        if (i === currentCard) box.classList.add('is-current');
        else                   box.classList.remove('is-current');
      }
    }
  }

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
    _scrollToCard(first);
  };

  // ── Keyboard navigation ───────────────────────────────────────
  function _scrollToCard(idx) {
    if (idx < 0)      idx = 0;
    if (idx >= TOTAL) idx = TOTAL - 1;
    var card = document.getElementById('qcard-' + idx);
    if (card) {
      // Optimistic update so rapid key presses immediately advance
      currentCard = idx;
      _updateCurrentBox();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function _selectCurrentAnswer(letter) {
    var optEl = document.getElementById('opt-' + currentCard + '-' + letter);
    if (optEl) selectOption(optEl, 'q' + currentCard, letter);
  }

  document.addEventListener('keydown', function (e) {
    // Don't intercept when typing in a form field
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Don't intercept modifier combos (Ctrl+S, Cmd+R, etc.)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    switch (e.key) {
      // ── Navigation
      case 'ArrowDown':
      case 'PageDown':
      case 'j': case 'J':
        e.preventDefault();
        _scrollToCard(currentCard + 1);
        break;
      case 'ArrowUp':
      case 'PageUp':
      case 'k': case 'K':
        e.preventDefault();
        _scrollToCard(currentCard - 1);
        break;

      // ── Answer selection
      case 'a': case 'A': _selectCurrentAnswer('A'); break;
      case 'b': case 'B': _selectCurrentAnswer('B'); break;
      case 'c': case 'C': _selectCurrentAnswer('C'); break;
      case 'd': case 'D': _selectCurrentAnswer('D'); break;

      // ── Flag
      case 'f': case 'F':
        toggleFlag(currentCard);
        break;

      // ── Map toggle
      case 'm': case 'M':
        toggleMap();
        break;
    }
  });

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

  // ── DOM event bindings (replaces inline onclick handlers) ────
  document.querySelectorAll('.flag-btn[data-qidx]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      toggleFlag(parseInt(this.dataset.qidx, 10));
    });
  });

  document.querySelectorAll('.report-btn[data-qidx]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      reportQuestion(parseInt(this.dataset.qidx, 10));
    });
  });

  document.querySelectorAll('.option-item[data-qidx]').forEach(function (el) {
    el.addEventListener('click', function () {
      selectOption(this, 'q' + this.dataset.qidx, this.dataset.key);
    });
  });

  var abortBtn = document.getElementById('abort-btn');
  if (abortBtn) {
    abortBtn.addEventListener('click', confirmAbort);
  }

  var flaggedJumpBtn = document.getElementById('q-map-flagged-btn');
  if (flaggedJumpBtn) {
    flaggedJumpBtn.addEventListener('click', jumpToFirstFlagged);
  }

  var mapToggleBtn = document.getElementById('q-map-toggle');
  if (mapToggleBtn) {
    mapToggleBtn.addEventListener('click', toggleMap);
  }

  // ── Init ──────────────────────────────────────────────────────
  updateProgress();
  _buildMap();
})();
