// Index page — form validation + exam card selection
(function () {
  const aliasInput  = document.getElementById('alias');
  const launchBtn   = document.getElementById('launch-btn');
  const examCards   = document.querySelectorAll('.exam-card');
  const radios      = document.querySelectorAll('input[name="exam_id"]');

  // Config panel elements
  const configPanel = document.getElementById('config-panel');
  const qRange      = document.getElementById('cfg-questions-range');
  const qValEl      = document.getElementById('cfg-q-val');
  const qMaxEl      = document.getElementById('cfg-q-max');
  const qHidden     = document.getElementById('num-questions-hidden');
  const timeInput   = document.getElementById('cfg-time');

  let aliasOk = aliasInput ? aliasInput.value.trim().length > 0 : false;
  let examOk  = false;

  function updateBtn() {
    launchBtn.disabled = !(aliasOk && examOk);
  }

  if (aliasInput) {
    aliasInput.addEventListener('input', function () {
      aliasOk = this.value.trim().length > 0;
      updateBtn();
    });
  }

  // Reflect pre-filled alias immediately
  updateBtn();

  // Populate and reveal the config panel for the selected exam
  function populateConfig(examId) {
    var card = document.getElementById('card-' + examId);
    if (!card) return;
    var poolSize    = parseInt(card.dataset.poolSize, 10)         || 100;
    var defaultQ    = parseInt(card.dataset.defaultQuestions, 10) || poolSize;
    var defaultTime = parseInt(card.dataset.defaultTime, 10)      || 0;

    if (qRange) {
      qRange.min   = 1;
      qRange.max   = poolSize;
      qRange.value = defaultQ;
    }
    if (qValEl)  qValEl.textContent  = defaultQ;
    if (qMaxEl)  qMaxEl.textContent  = ' / ' + poolSize;
    if (qHidden) qHidden.value       = defaultQ;
    if (timeInput) timeInput.value   = defaultTime;

    if (configPanel) configPanel.style.display = '';
  }

  // Keep hidden field in sync with the range slider
  if (qRange) {
    qRange.addEventListener('input', function () {
      if (qValEl)  qValEl.textContent = this.value;
      if (qHidden) qHidden.value      = this.value;
    });
  }

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      // Deselect all cards
      examCards.forEach(function (card) { card.classList.remove('selected'); });
      // Select clicked card
      const card = document.getElementById('card-' + radio.value);
      if (card) card.classList.add('selected');
      examOk = true;
      updateBtn();
      populateConfig(radio.value);
    });
  });

  // Click on card label toggles radio
  examCards.forEach(function (card) {
    card.addEventListener('click', function () {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Double-click to launch immediately (alias must be filled first)
    card.addEventListener('dblclick', function () {
      const radio = card.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (aliasOk) {
        card.classList.add('launching');
        setTimeout(function () {
          document.getElementById('start-form').submit();
        }, 180);
      } else {
        // Alias missing — nudge the user toward it
        if (aliasInput) {
          aliasInput.focus();
          aliasInput.classList.add('input-nudge');
          setTimeout(function () { aliasInput.classList.remove('input-nudge'); }, 700);
        }
      }
    });
  });
})();
