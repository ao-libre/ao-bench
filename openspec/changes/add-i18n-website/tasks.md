# Tasks: Add English / Spanish i18n to ao-website

## 1 — Create locale files

- [ ] Create `ao-website/locales/es.json` with all keys from `specs/spec.md` locale table, Spanish values
- [ ] Create `ao-website/locales/en.json` with all keys from `specs/spec.md` locale table, English values
- [ ] Verify both files have identical key sets (no missing or extra keys)

## 2 — Add i18n.js

- [ ] Create `ao-website/app/js/i18n.js` with the following logic:
  - `loadLocale(lang)` — fetches `/locales/<lang>.json`, caches in memory
  - `applyLocale(lang)` — sets `document.documentElement.lang`, updates `document.title`, replaces text of all `[data-i18n]` elements, replaces innerHTML of all `[data-i18n-html]` elements
  - `switchLang(lang)` — calls `loadLocale` + `applyLocale`, writes to `localStorage('ao-lang')`, updates switcher button label
  - On `DOMContentLoaded`: reads `localStorage('ao-lang')` (default `'es'`), calls `switchLang`

## 3 — Annotate index.html

- [ ] Add `data-i18n` or `data-i18n-html` attributes to every translatable element in `index.html` using the key names from `specs/spec.md`
- [ ] Replace all hardcoded visible text with a neutral placeholder (e.g. `&nbsp;` or the Spanish text as fallback before JS runs, to avoid flash of untranslated content)

## 4 — Add language switcher to header

- [ ] Add a `<button id="lang-switcher">EN</button>` (or equivalent) inside `.header__right`, before the social icons
- [ ] Style it minimally to match the header (no framework classes needed — a simple text button)
- [ ] Wire its `onclick` to `switchLang` in `i18n.js`

## 5 — Load i18n.js in index.html

- [ ] Add `<script src="app/js/i18n.js" defer></script>` to `<head>` of `index.html`

## 6 — Verify

- [ ] Open `index.html` in a browser (local server, e.g. `npx serve ao-website`), confirm page loads in Spanish by default
- [ ] Click the language switcher — all visible text swaps to English without page reload
- [ ] Reload the page — language preference is retained
- [ ] Click switcher again — swaps back to Spanish
- [ ] Check browser console for errors — none expected
- [ ] Validate `en.json` and `es.json` with `node -e "JSON.parse(require('fs').readFileSync('ao-website/locales/en.json','utf8'))"` — no parse errors

## 7 — Commit and push

- [ ] `git add ao-website/locales/ ao-website/app/js/i18n.js ao-website/index.html`
- [ ] `git commit -m "Add EN/ES i18n to homepage"`
- [ ] `git push origin master`
