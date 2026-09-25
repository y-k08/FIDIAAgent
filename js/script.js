/* ==========================================================================
   FIDIA Agent LP - script.js
   多段フォーム / FAQアコーディオン / アドバイザーカルーセル / スティッキーCTA
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initMultiStepForms();
  initFaqAccordion();
  initAdvisorCarousel();
  initStickyCta();
  initCtaScroll();
});

/* --------------------------------------------------------------------------
   多段フォーム
   ステップ内の必須項目がすべて入力されたら「次へ進む」ボタンを
   有効化（グレー→ピンク）し、クリックで次のステップへスライドする。
   -------------------------------------------------------------------------- */
function initMultiStepForms() {
  const forms = document.querySelectorAll('.js-multistep-form');

  forms.forEach((form) => {
    const track = form.querySelector('.form-card__steps-track');
    const steps = Array.from(form.querySelectorAll('.form-step'));
    let currentStep = 1;

    // 選択式（性別・卒業年度）ボタンの単一選択処理
    form.querySelectorAll('.js-radio-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        form.querySelectorAll(`.js-radio-option[data-group="${group}"]`).forEach((el) => {
          el.classList.remove('is-selected');
        });
        btn.classList.add('is-selected');
        validateStep(steps[currentStep - 1]);
      });
    });

    // テキスト入力・チェックボックスの入力監視
    form.querySelectorAll('.js-required-field').forEach((field) => {
      const eventName = field.type === 'checkbox' ? 'change' : 'input';
      field.addEventListener(eventName, () => {
        validateStep(steps[currentStep - 1]);
      });
    });

    // 「次へ進む」ボタン
    form.querySelectorAll('.js-next-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        goToStep(currentStep + 1);
      });
    });

    // 「戻る」ボタン
    form.querySelectorAll('.js-prev-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToStep(currentStep - 1);
      });
    });

    // 最終ステップの送信ボタン
    const submitBtn = form.querySelector('.js-submit-form');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (submitBtn.disabled) return;
        // TODO: 最終ページのリンク先が決まったら、ここに遷移処理を実装する
      });
    }

    function goToStep(stepNumber) {
      if (stepNumber < 1 || stepNumber > steps.length) return;
      currentStep = stepNumber;
      track.style.transform = `translateX(-${(stepNumber - 1) * (100 / steps.length)}%)`;
      validateStep(steps[currentStep - 1]);
      updateTrackHeight();
    }

    // 各ステップの高さが異なるため、表示中のステップに合わせて
    // トラックの高さを都度更新する（余白ができるのを防ぐ）
    function updateTrackHeight() {
      track.style.height = `${steps[currentStep - 1].offsetHeight}px`;
    }

    window.addEventListener('resize', updateTrackHeight);

    function validateStep(stepEl) {
      const requiredFields = Array.from(stepEl.querySelectorAll('.js-required-field'));
      const radioGroups = new Set(
        Array.from(stepEl.querySelectorAll('.js-radio-option')).map((el) => el.dataset.group)
      );

      const fieldsFilled = requiredFields.every((field) => {
        if (field.type === 'checkbox') return field.checked;
        const hasValue = field.value.trim() !== '';
        // email/tel等はブラウザの形式チェックも合わせて見る
        return hasValue && field.checkValidity();
      });

      const radiosSelected = Array.from(radioGroups).every((group) =>
        stepEl.querySelector(`.js-radio-option.is-selected[data-group="${group}"]`)
      );

      const isValid = fieldsFilled && radiosSelected;
      const nextBtn = stepEl.querySelector('.js-next-step, .js-submit-form');
      if (nextBtn) {
        nextBtn.disabled = !isValid;
        nextBtn.classList.toggle('is-ready', isValid);
      }
    }

    // 初期状態のバリデーション
    validateStep(steps[0]);
    updateTrackHeight();
  });
}

/* --------------------------------------------------------------------------
   FAQアコーディオン
   -------------------------------------------------------------------------- */
function initFaqAccordion() {
  document.querySelectorAll('.js-faq-item').forEach((item) => {
    const toggle = item.querySelector('.js-faq-toggle');
    toggle.addEventListener('click', () => {
      item.classList.toggle('is-open');
    });
  });
}

/* --------------------------------------------------------------------------
   アドバイザーカルーセル（5名をループ表示）
   -------------------------------------------------------------------------- */
function initAdvisorCarousel() {
  const carousel = document.querySelector('.js-advisor-carousel');
  if (!carousel) return;

  const track = carousel.querySelector('.advisor-carousel__track');
  const originals = Array.from(track.children);
  const total = originals.length;
  if (total === 0) return;

  const firstClone = originals[0].cloneNode(true);
  const lastClone = originals[total - 1].cloneNode(true);
  firstClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('aria-hidden', 'true');
  track.insertBefore(lastClone, originals[0]);
  track.appendChild(firstClone);

  const cardStep = 324;
  const peekOffset = 35;
  let index = 1;
  let animating = false;

  function render(animate) {
    track.style.transition = animate ? 'transform 0.4s ease' : 'none';
    track.style.transform = `translateX(${peekOffset - index * cardStep}px)`;
  }

  function goTo(nextIndex) {
    if (animating) return;
    animating = true;
    index = nextIndex;
    render(true);
  }

  track.addEventListener('transitionend', (event) => {
    if (event.target !== track || event.propertyName !== 'transform') return;
    if (index === 0) {
      index = total;
      render(false);
    } else if (index === total + 1) {
      index = 1;
      render(false);
    }
    animating = false;
  });

  carousel.querySelector('.js-advisor-prev').addEventListener('click', () => {
    goTo(index - 1);
  });

  carousel.querySelector('.js-advisor-next').addEventListener('click', () => {
    goTo(index + 1);
  });

  render(false);
}

/* --------------------------------------------------------------------------
   スティッキーCTA
   1つ目のフォームの下端を過ぎてから、2つ目のフォームが固定CTAの位置まで
   近づくまで表示する。下のフォームが見え始めたら、すでに入力できる
   フォームがあるため固定CTAは不要になる。
   -------------------------------------------------------------------------- */
function initStickyCta() {
  const sticky = document.querySelector('.js-cta-sticky');
  const formTop = document.getElementById('form-top');
  const formBottomSection = document.getElementById('form-bottom');
  if (!sticky || !formTop || !formBottomSection) return;

  function updateVisibility() {
    const formTopBottom = formTop.getBoundingClientRect().bottom;
    const formBottomTop = formBottomSection.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;

    const pastForm = formTopBottom <= viewportHeight;
    const beforeBottomForm = formBottomTop > viewportHeight;

    const shouldShow = pastForm && beforeBottomForm;
    sticky.classList.toggle('is-visible', shouldShow);
    sticky.setAttribute('aria-hidden', String(!shouldShow));
  }

  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility);
  updateVisibility();
}

/* --------------------------------------------------------------------------
   LP内すべてのCTAを1つ目のフォームへスクロールさせる
   -------------------------------------------------------------------------- */
function initCtaScroll() {
  const target = document.getElementById('form-top');
  if (!target) return;

  document.querySelectorAll('.js-cta-scroll').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
