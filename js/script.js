/* ==========================================================================
   FIDIA Agent LP - script.js
   多段フォーム / FAQアコーディオン / アドバイザーカルーセル / スティッキーCTA
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initMultiStepForms();
  initUniversitySuggest();
  initFaqAccordion();
  initAdvisorCarousel();
  initStickyCta();
  initCtaScroll();
});

/* --------------------------------------------------------------------------
   多段フォーム
   必須が揃うとボタンがピンクになる。次へ／送信時に未入力・形式ミスがあれば
   該当項目へ赤枠と注釈を出し、揃っていれば次のステップまたはサンクスへ進む。
   -------------------------------------------------------------------------- */
function initMultiStepForms() {
  const forms = document.querySelectorAll('.js-multistep-form');

  forms.forEach((form) => {
    const steps = Array.from(form.querySelectorAll('.form-step'));
    const indicator = form.querySelector('.form-card__body > .step-indicator');
    const indicatorItems = Array.from(indicator.querySelectorAll('[data-step-indicator]'));
    let currentStep = 1;
    let autoAdvanceTimer = null;

    form.querySelectorAll('.js-radio-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        form.querySelectorAll(`.js-radio-option[data-group="${group}"]`).forEach((el) => {
          el.classList.remove('is-selected');
        });
        btn.classList.add('is-selected');
        validateStep(steps[currentStep - 1]);

        if (group === 'graduationYear' && currentStep === 1) {
          clearTimeout(autoAdvanceTimer);
          autoAdvanceTimer = setTimeout(() => {
            autoAdvanceTimer = null;
            goToStep(2);
          }, 300);
        }
      });
    });

    form.querySelectorAll('.js-required-field').forEach((field) => {
      const eventName = field.type === 'checkbox' ? 'change' : 'input';
      field.addEventListener(eventName, () => {
        validateStep(steps[currentStep - 1]);
      });

      if (field.type !== 'checkbox') {
        field.addEventListener('blur', (event) => {
          const suggest = field.closest('.js-university-suggest');
          if (suggest && suggest.contains(event.relatedTarget)) return;
          const fieldEl = field.closest('.form-field');
          if (fieldEl) fieldEl.dataset.attempted = 'true';
          validateStep(steps[currentStep - 1]);
        });
      }
    });

    form.querySelectorAll('.js-next-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!validateStep(steps[currentStep - 1], { showErrors: true })) return;
        goToStep(currentStep + 1);
      });
    });

    form.querySelectorAll('.js-prev-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        goToStep(currentStep - 1);
      });
    });

    const submitBtn = form.querySelector('.js-submit-form');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        if (!validateStep(steps[currentStep - 1], { showErrors: true })) return;
        window.location.href = new URL('thanks_send_01/', window.location.href).href;
      });
    }

    function goToStep(stepNumber) {
      if (stepNumber < 1 || stepNumber > steps.length) return;
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
      currentStep = stepNumber;
      steps.forEach((step) => {
        step.classList.toggle('is-current', Number(step.dataset.step) === currentStep);
      });
      updateIndicator();
      validateStep(steps[currentStep - 1]);
    }

    function updateIndicator() {
      indicatorItems.forEach((item) => {
        const itemStep = Number(item.dataset.stepIndicator);
        item.classList.toggle('is-active', itemStep === currentStep);
        item.classList.toggle('is-done', itemStep < currentStep);
      });
    }

    function getInputError(field) {
      if (field.type === 'checkbox') {
        return field.checked ? '' : '入力してください。';
      }

      const value = field.value.trim();
      if (!value) return '入力してください。';

      if ((field.name === 'name' || field.name === 'university') && [...value].length < 2) {
        return '正しく入力してください。';
      }

      if (field.type === 'email' && !isValidEmail(value)) {
        return '正しく入力してください。';
      }

      if (field.name === 'tel') {
        const digits = toHalfWidthDigits(value).replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 11) {
          return '正しく入力してください。';
        }
      }

      return '';
    }

    function setFieldError(fieldEl, message) {
      const errorEl = fieldEl.querySelector('.form-field__error');
      fieldEl.classList.toggle('is-error', Boolean(message));
      if (errorEl && message) errorEl.textContent = message;
    }

    function validateStep(stepEl, options = {}) {
      const showAllErrors = Boolean(options.showErrors) || stepEl.dataset.attempted === 'true';
      if (options.showErrors) stepEl.dataset.attempted = 'true';

      let isValid = true;

      stepEl.querySelectorAll('.form-field').forEach((fieldEl) => {
        const input = fieldEl.querySelector('.js-required-field');
        const radioGroup = fieldEl.querySelector('.js-radio-option');
        let message = '';

        if (input) {
          message = getInputError(input);
        } else if (radioGroup) {
          const group = radioGroup.dataset.group;
          const selected = stepEl.querySelector(`.js-radio-option.is-selected[data-group="${group}"]`);
          if (!selected) message = '入力してください。';
        }

        if (message) isValid = false;
        const showThis = showAllErrors || fieldEl.dataset.attempted === 'true';
        setFieldError(fieldEl, showThis ? message : '');
      });

      const nextBtn = stepEl.querySelector('.js-next-step, .js-submit-form');
      if (nextBtn) nextBtn.classList.toggle('is-ready', isValid);

      return isValid;
    }

    updateIndicator();
    validateStep(steps[0]);
  });
}

function toHalfWidthDigits(value) {
  return value.replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/* --------------------------------------------------------------------------
   大学名サジェスト
   2文字以上で候補を出し、リストにない名前も手入力のまま次へ進める。
   -------------------------------------------------------------------------- */
function initUniversitySuggest() {
  const roots = document.querySelectorAll('.js-university-suggest');
  if (roots.length === 0) return;

  let universities = Array.isArray(window.FIDIA_UNIVERSITIES) ? window.FIDIA_UNIVERSITIES : [];
  const dataPromise = universities.length > 0
    ? Promise.resolve(universities)
    : loadUniversitiesJson().then((data) => {
      universities = data;
      return data;
    });

  roots.forEach((root) => bindUniversitySuggest(root, () => universities, dataPromise));
}

function loadUniversitiesJson() {
  const script = document.querySelector('script[src*="js/script.js"]');
  const candidates = [];
  if (script && script.src) {
    candidates.push(new URL('../data/universities.json', script.src).href);
  }
  candidates.push(new URL('data/universities.json', document.baseURI).href);

  return candidates.reduce((promise, url) => (
    promise.catch(() => fetch(url).then((res) => {
      if (!res.ok) throw new Error(res.status);
      return res.json();
    }))
  ), Promise.reject()).then((data) => (
    Array.isArray(data) ? data : []
  )).catch(() => []);
}

function bindUniversitySuggest(root, getUniversities, dataPromise) {
  const input = root.querySelector('input[name="university"]');
  const clearBtn = root.querySelector('.university-suggest__clear');
  const panel = root.querySelector('.university-suggest__panel');
  const list = root.querySelector('.university-suggest__list');
  const empty = root.querySelector('.university-suggest__empty');
  const useBtn = root.querySelector('.university-suggest__use');
  const hintDefault = root.querySelector('[data-hint="default"]');
  const hintFilled = root.querySelector('[data-hint="filled"]');
  const listId = list.id;
  let debounceTimer = null;
  let activeIndex = -1;
  let currentResults = [];
  let isOpen = false;

  input.addEventListener('input', () => {
    root.classList.remove('is-filled');
    updateChrome();
    scheduleSearch();
  });

  input.addEventListener('focus', () => {
    root.classList.add('is-focused');
    if ([...input.value.trim()].length >= 2) scheduleSearch(0);
  });

  input.addEventListener('blur', () => {
    window.setTimeout(() => {
      if (root.contains(document.activeElement)) return;
      root.classList.remove('is-focused');
    }, 0);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePanel();
      return;
    }
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter') {
      if (currentResults.length > 0 && activeIndex >= 0) {
        event.preventDefault();
        confirmValue(currentResults[activeIndex].name);
      } else if (currentResults.length === 0 && [...input.value.trim()].length >= 2) {
        event.preventDefault();
        confirmValue(input.value.trim());
      }
    }
  });

  clearBtn.addEventListener('mousedown', (event) => event.preventDefault());
  clearBtn.addEventListener('click', () => {
    input.value = '';
    root.classList.remove('is-filled');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();
    closePanel();
    updateChrome();
  });

  useBtn.addEventListener('mousedown', (event) => event.preventDefault());
  useBtn.addEventListener('click', () => {
    confirmValue(input.value.trim());
  });

  document.addEventListener('pointerdown', (event) => {
    if (!root.contains(event.target)) closePanel();
  });

  function scheduleSearch(delay = 200) {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if ([...query].length < 2) {
      closePanel();
      return;
    }
    debounceTimer = setTimeout(() => {
      dataPromise.then(() => renderResults(query));
    }, delay);
  }

  function renderResults(query) {
    if (document.activeElement !== input && !root.contains(document.activeElement)) return;
    const catalog = getUniversities();
    currentResults = searchUniversities(catalog, query);
    activeIndex = currentResults.length > 0 ? 0 : -1;
    list.innerHTML = '';
    empty.hidden = true;

    if (catalog.length === 0) {
      closePanel();
      return;
    }

    if (currentResults.length === 0) {
      list.hidden = true;
      empty.hidden = false;
      useBtn.textContent = `＋『${query}』で入力する`;
    } else {
      empty.hidden = true;
      list.hidden = false;
      currentResults.forEach((item, index) => {
        const option = document.createElement('li');
        option.className = 'university-suggest__option';
        option.id = `${listId}-opt-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
        option.innerHTML = highlightMatch(item.name, query);
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => confirmValue(item.name));
        option.addEventListener('mouseenter', () => setActive(index));
        list.appendChild(option);
      });
    }

    openPanel();
    syncActive();
  }

  function searchUniversities(items, query) {
    const q = query.toLowerCase();
    const ranked = [];
    items.forEach((item) => {
      const name = item.name || '';
      const kana = item.kana || '';
      const nameLower = name.toLowerCase();
      let rank = 0;
      if (nameLower.startsWith(q)) rank = 3;
      else if (kana && kana.startsWith(query)) rank = 2;
      else if (nameLower.includes(q)) rank = 1;
      if (rank) ranked.push({ item, rank });
    });
    ranked.sort((a, b) => b.rank - a.rank);
    return ranked.slice(0, 5).map((entry) => entry.item);
  }

  function highlightMatch(name, query) {
    const escapedName = escapeHtml(name);
    const escapedQuery = escapeHtml(query);
    const index = escapedName.toLowerCase().indexOf(escapedQuery.toLowerCase());
    if (index < 0) return escapedName;
    const before = escapedName.slice(0, index);
    const match = escapedName.slice(index, index + escapedQuery.length);
    const after = escapedName.slice(index + escapedQuery.length);
    return `${before}<mark>${match}</mark>${after}`;
  }

  function confirmValue(value) {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    root.classList.toggle('is-filled', [...value].length >= 2);
    closePanel();
    updateChrome();
    input.focus();
  }

  function moveActive(delta) {
    if (currentResults.length === 0) return;
    const next = (activeIndex + delta + currentResults.length) % currentResults.length;
    setActive(next);
  }

  function setActive(index) {
    activeIndex = index;
    syncActive();
  }

  function syncActive() {
    const options = list.querySelectorAll('.university-suggest__option');
    options.forEach((option, index) => {
      const selected = index === activeIndex;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', activeIndex >= 0 && options[activeIndex] ? options[activeIndex].id : '');
  }

  function openPanel() {
    isOpen = true;
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    updateHints();
  }

  function closePanel() {
    clearTimeout(debounceTimer);
    isOpen = false;
    currentResults = [];
    activeIndex = -1;
    panel.hidden = true;
    list.innerHTML = '';
    empty.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-activedescendant', '');
    updateHints();
  }

  function updateChrome() {
    const hasValue = input.value.length > 0;
    clearBtn.hidden = !hasValue;
    updateHints();
  }

  function updateHints() {
    const filled = root.classList.contains('is-filled');
    hintDefault.hidden = isOpen || filled;
    hintFilled.hidden = isOpen || !filled;
  }

  updateChrome();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
