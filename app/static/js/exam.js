// Exam page — option selection, progress tracking, submit guard
(function () {
  var answered = 0;
  var answeredSet = {};

  var progressBar   = document.getElementById('progress-bar');
  var progressText  = document.getElementById('progress-text');
  var answeredCount = document.getElementById('answered-count');

  function updateProgress() {
    var pct = TOTAL > 0 ? (answered / TOTAL) * 100 : 0;
    if (progressBar)  progressBar.style.width = pct + '%';
    if (progressText) progressText.textContent = answered + ' / ' + TOTAL;
    if (answeredCount) answeredCount.textContent = answered;
  }

  // Called from inline onclick in the template
  window.selectOption = function (el, name, value) {
    // Deselect all options in this question
    var siblings = el.parentNode.querySelectorAll('.option-item');
    siblings.forEach(function (sib) { sib.classList.remove('selected'); });

    // Select this option
    el.classList.add('selected');

    // Check the hidden radio
    var radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;

    // Mark parent card as answered
    var card = el.closest('.question-card');
    if (card) card.classList.add('answered');

    // Track answered questions
    if (!answeredSet[name]) {
      answeredSet[name] = true;
      answered++;
    }

    updateProgress();
  };

  // Submit guard
  var form = document.getElementById('exam-form');
  if (form) {
    form.addEventListener('submit', function (e) {
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

  // Abort
  window.confirmAbort = function () {
    if (confirm('ABORT MISSION?\nAll progress will be lost.')) {
      window.location.href = '/reset';
    }
  };

  updateProgress();
})();
