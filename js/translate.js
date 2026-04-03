// ── Language picker + Google Translate integration ────────────────────────────
//
// Renders a flag dropdown in the navbar. Selecting a language calls the
// Google Translate Element API to translate the whole page in-place.
// The GT widget itself stays hidden — we drive it programmatically.
//
// Each language has joke font sub-options that expand when that language
// is the active selection.

const LANGUAGES = [
  { code: 'en',    flag: 'us', label: 'English'    },
  { code: 'es',    flag: 'es', label: 'Español'    },
  { code: 'fr',    flag: 'fr', label: 'Français'   },
  { code: 'de',    flag: 'de', label: 'Deutsch'    },
  { code: 'pt',    flag: 'br', label: 'Português'  },
  { code: 'ja',    flag: 'jp', label: '日本語'      },
  { code: 'ko',    flag: 'kr', label: '한국어'      },
  { code: 'zh-CN', flag: 'cn', label: '中文'        },
  { code: 'ar',    flag: 'sa', label: 'العربية'    },
  { code: 'ru',    flag: 'ru', label: 'Русский'    },
  { code: 'hi',    flag: 'in', label: 'हिन्दी'     },
  { code: 'it',    flag: 'it', label: 'Italiano'   },
  { code: 'nl',    flag: 'nl', label: 'Nederlands' },
  { code: 'pl',    flag: 'pl', label: 'Polski'     },
  { code: 'sv',    flag: 'se', label: 'Svenska'    },
  { code: 'tr',    flag: 'tr', label: 'Türkçe'     },
  { code: 'iw',    flag: 'il', label: 'עברית'      },
];

// Joke languages — font-swap only, no translation
const JOKE_LANGUAGES = [
  { code: 'joke-barcode',   font: 'Libre Barcode 128', label: 'asdfghjkl' },
  { code: 'joke-braille',   font: 'Braille-Regular',   label: 'asdfghjkl' },
  { code: 'joke-wingdings', font: 'Wingdings',         label: 'asdfghjkl' },
];

// ── State ─────────────────────────────────────────────────────────────────────

let currentLang     = 'en'; // active real language code
let currentJoke     = null; // active joke code, or null
let jokeFontStyle   = null; // <style> tag injected for joke font

// ── Google Translate init callback (called by the GT script) ──────────────────

function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    { pageLanguage: 'en', autoDisplay: false },
    'google_translate_element'
  );
}

// ── Apply a language via the GT cookie mechanism ──────────────────────────────

function setLanguage(langCode) {
  currentLang = langCode;

  if (langCode === 'en') {
    document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'googtrans=; path=/; domain=' + location.hostname + '; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    location.reload();
    return;
  }

  const value = `/en/${langCode}`;
  document.cookie = `googtrans=${value}; path=/`;
  document.cookie = `googtrans=${value}; path=/; domain=${location.hostname}`;

  const frame = document.querySelector('.goog-te-menu-frame') ||
                document.querySelector('iframe.skiptranslate');
  if (frame) {
    triggerGTSelect(langCode);
  } else {
    location.reload();
  }
}

// ── Joke font swap ────────────────────────────────────────────────────────────

function applyJokeFont(fontFamily) {
  clearJokeFont();
  jokeFontStyle = document.createElement('style');
  jokeFontStyle.id = 'joke-font-style';
  jokeFontStyle.textContent = `body, body *:not(.fa):not(.fas):not(.far):not(.fab):not(.fal):not(.fad):not([class*="fa-"]):not(.lang-option--sub .lang-option-label) { font-family: '${fontFamily}', sans-serif !important; }`;
  document.head.appendChild(jokeFontStyle);
}

function clearJokeFont() {
  if (jokeFontStyle) { jokeFontStyle.remove(); jokeFontStyle = null; }
  currentJoke = null;
}

function triggerGTSelect(langCode) {
  const select = document.querySelector('.goog-te-combo');
  if (!select) { location.reload(); return; }
  select.value = langCode;
  select.dispatchEvent(new Event('change'));
}

// ── Build the dropdown UI ─────────────────────────────────────────────────────

(function buildUI() {
  const btn      = document.getElementById('lang-btn');
  const btnFlag  = document.getElementById('lang-btn-flag');
  const dropdown = document.getElementById('lang-dropdown');
  const wrap     = document.getElementById('lang-wrap');

  // Detect active lang from cookie
  const match = document.cookie.match(/googtrans=\/en\/([^;]+)/);
  if (match) currentLang = decodeURIComponent(match[1]);

  // Track which lang group is expanded
  let expandedCode = currentLang;

  // Build all language group rows
  LANGUAGES.forEach(lang => {
    const group = document.createElement('div');
    group.className      = 'lang-group';
    group.dataset.lang   = lang.code;

    // ── Main language row
    const row = document.createElement('button');
    row.className    = 'lang-option';
    row.role         = 'option';
    row.dataset.code = lang.code;
    row.setAttribute('aria-selected', lang.code === currentLang ? 'true' : 'false');

    const flag = document.createElement('span');
    flag.className = `fi fi-${lang.flag}`;

    const name = document.createElement('span');
    name.className   = 'lang-option-label';
    name.textContent = lang.label;

    row.appendChild(flag);
    row.appendChild(name);
    group.appendChild(row);

    // ── Sub-options (joke fonts)
    const sub = document.createElement('div');
    sub.className = 'lang-sublist';

    // "Normal" sub-option (default font, first and selected by default)
    const normalOpt = document.createElement('button');
    normalOpt.className    = 'lang-option lang-option--sub';
    normalOpt.role         = 'option';
    normalOpt.dataset.code = `${lang.code}--normal`;
    normalOpt.setAttribute('aria-selected', lang.code === currentLang && !currentJoke ? 'true' : 'false');
    const normalArrow = document.createElement('i');
    normalArrow.className = 'fa-solid fa-chevron-right lang-sub-arrow';
    const normalLabel = document.createElement('span');
    normalLabel.className   = 'lang-option-label';
    normalLabel.textContent = 'asdfghjkl';
    normalOpt.appendChild(normalArrow);
    normalOpt.appendChild(normalLabel);
    normalOpt.addEventListener('click', (e) => {
      e.stopPropagation();
      clearJokeFont();
      updateSelected(lang, null);
      updateButtonFlag(lang);
    });
    sub.appendChild(normalOpt);

    // Joke font sub-options
    JOKE_LANGUAGES.forEach(joke => {
      const jOpt = document.createElement('button');
      jOpt.className    = 'lang-option lang-option--sub';
      jOpt.role         = 'option';
      jOpt.dataset.code = `${lang.code}--${joke.code}`;
      jOpt.setAttribute('aria-selected', 'false');

      const jArrow = document.createElement('i');
      jArrow.className = 'fa-solid fa-chevron-right lang-sub-arrow';

      const jLabel = document.createElement('span');
      jLabel.className        = 'lang-option-label';
      jLabel.textContent      = joke.label;
      jLabel.style.fontFamily = `'${joke.font}', sans-serif`;

      jOpt.appendChild(jArrow);
      jOpt.appendChild(jLabel);
      jOpt.addEventListener('click', (e) => {
        e.stopPropagation();
        currentJoke = joke.code;
        applyJokeFont(joke.font);
        updateSelected(lang, joke);
        updateButtonJoke(joke);
      });
      sub.appendChild(jOpt);
    });

    group.appendChild(sub);
    dropdown.appendChild(group);

    // Expand/collapse on language row click — do NOT close the dropdown
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const alreadyExpanded = expandedCode === lang.code;

      dropdown.querySelectorAll('.lang-group').forEach(g => g.classList.remove('lang-group--expanded'));

      if (!alreadyExpanded) {
        group.classList.add('lang-group--expanded');
        expandedCode = lang.code;
        clearJokeFont();
        currentJoke = null;
        updateSelected(lang, null);
        updateButtonFlag(lang);
        setLanguage(lang.code);
      } else {
        expandedCode = null;
      }
    });

    // Start expanded if this is the active language
    if (lang.code === currentLang) {
      group.classList.add('lang-group--expanded');
    }
  });

  // Set initial button state
  const activeLang = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];
  updateButtonFlag(activeLang);

  // Toggle dropdown open/close
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !wrap.classList.contains('lang-open');
    closeOtherPanels('lang-wrap');
    wrap.classList.toggle('lang-open', opening);
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
  });

  document.addEventListener('click', () => closeDropdown());
  dropdown.addEventListener('click', e => e.stopPropagation());

  function closeDropdown() {
    wrap.classList.remove('lang-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  function updateSelected(lang, joke) {
    // Clear all aria-selected
    dropdown.querySelectorAll('.lang-option').forEach(opt => {
      opt.setAttribute('aria-selected', 'false');
    });
    // Mark the language row
    const langRow = dropdown.querySelector(`.lang-option[data-code="${lang.code}"]`);
    if (langRow) langRow.setAttribute('aria-selected', 'true');
    // Mark the sub-option
    const subCode = joke ? `${lang.code}--${joke.code}` : `${lang.code}--normal`;
    const subRow = dropdown.querySelector(`.lang-option[data-code="${subCode}"]`);
    if (subRow) subRow.setAttribute('aria-selected', 'true');
  }

  function updateButtonFlag(lang) {
    btnFlag.className        = `fi fi-${lang.flag} lang-btn-flag`;
    btnFlag.style.fontFamily = '';
    btnFlag.textContent      = '';
  }

  function updateButtonJoke(joke) {
    btnFlag.className        = 'lang-btn-flag lang-btn-flag--joke';
    btnFlag.style.fontFamily = `'${joke.font}', sans-serif`;
    btnFlag.textContent      = 'Aa';
  }
})();
