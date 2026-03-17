// Index page — alias validation, exam launch, slider sync
(function () {
  const aliasInput = document.getElementById('alias');
  const qHidden    = document.getElementById('num-questions-hidden');
  const tlHidden   = document.getElementById('time-limit-hidden');

  let aliasOk = aliasInput ? aliasInput.value.trim().length > 0 : false;

  if (aliasInput) {
    aliasInput.addEventListener('input', function () {
      aliasOk = this.value.trim().length > 0;
    });
  }

  // Expand hidden category tags
  window.expandTags = function (btn) {
    var tagsRow = btn.parentElement;
    tagsRow.querySelectorAll('.card-tag-overflow').forEach(function (el) {
      el.classList.remove('card-tag-overflow');
    });
    btn.remove();
  };

  // Called by each card's launch button
  window.launchExam = function (examId) {
    if (!aliasOk) {
      if (aliasInput) {
        aliasInput.focus();
        aliasInput.classList.add('input-nudge');
        setTimeout(function () { aliasInput.classList.remove('input-nudge'); }, 700);
      }
      return;
    }

    var radio = document.getElementById('exam-' + examId);
    if (radio) radio.checked = true;

    var card   = document.getElementById('card-' + examId);
    var qInput = card && card.querySelector('.card-q-input');
    var tInput = card && card.querySelector('.card-time-val');
    if (qHidden && qInput) qHidden.value  = qInput.value;
    if (tlHidden && tInput) tlHidden.value = tInput.value;

    if (card) {
      card.classList.add('launching');
      setTimeout(function () {
        document.getElementById('start-form').submit();
      }, 180);
    } else {
      document.getElementById('start-form').submit();
    }
  };
})();
