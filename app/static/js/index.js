// Index page — form validation + exam card selection
(function () {
  const aliasInput  = document.getElementById('alias');
  const launchBtn   = document.getElementById('launch-btn');
  const examCards   = document.querySelectorAll('.exam-card');
  const radios      = document.querySelectorAll('input[name="exam_id"]');

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

  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      // Deselect all cards
      examCards.forEach(function (card) { card.classList.remove('selected'); });
      // Select clicked card
      const card = document.getElementById('card-' + radio.value);
      if (card) card.classList.add('selected');
      examOk = true;
      updateBtn();
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
