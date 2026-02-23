// Index page — form validation + exam card selection
(function () {
  const aliasInput  = document.getElementById('alias');
  const launchBtn   = document.getElementById('launch-btn');
  const examCards   = document.querySelectorAll('.exam-card');
  const radios      = document.querySelectorAll('input[name="exam_id"]');

  let aliasOk = false;
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
  });
})();
