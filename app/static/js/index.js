// Index page — form validation + exam card selection
(function () {
  const aliasInput  = document.getElementById('alias');
  const launchBtn   = document.getElementById('launch-btn');
  const examCards   = document.querySelectorAll('.exam-card');
  const radios      = document.querySelectorAll('input[name="exam_id"]');
  const qHidden     = document.getElementById('num-questions-hidden');
  const tlHidden    = document.getElementById('time-limit-hidden');

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

  // Show config for the selected card, hide all others, sync hidden fields
  function showConfig(examId) {
    examCards.forEach(function (card) {
      var cfg = card.querySelector('.card-config');
      if (cfg) cfg.style.display = 'none';
    });

    var card = document.getElementById('card-' + examId);
    if (!card) return;

    var cfg     = card.querySelector('.card-config');
    var qSlider = card.querySelector('.card-q-range');
    var tInput  = card.querySelector('.card-time-val');

    if (cfg) cfg.style.display = '';
    if (qHidden && qSlider) qHidden.value  = qSlider.value;
    if (tlHidden && tInput) tlHidden.value = tInput.value;
  }

  // Delegated: keep hidden fields in sync as sliders / number inputs change
  document.addEventListener('input', function (e) {
    var card = e.target.closest('.exam-card');
    if (!card) return;

    if (e.target.classList.contains('card-q-range')) {
      var valEl = e.target.closest('.card-config').querySelector('.card-q-val');
      if (valEl) valEl.textContent = e.target.value;
      if (qHidden) qHidden.value = e.target.value;
    }

    if (e.target.classList.contains('card-time-val')) {
      if (tlHidden) tlHidden.value = e.target.value;
    }
  });

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      examCards.forEach(function (card) { card.classList.remove('selected'); });
      const card = document.getElementById('card-' + radio.value);
      if (card) card.classList.add('selected');
      examOk = true;
      updateBtn();
      showConfig(radio.value);
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
        if (aliasInput) {
          aliasInput.focus();
          aliasInput.classList.add('input-nudge');
          setTimeout(function () { aliasInput.classList.remove('input-nudge'); }, 700);
        }
      }
    });
  });
})();
