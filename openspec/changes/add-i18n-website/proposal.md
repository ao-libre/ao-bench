# Proposal: Add English / Spanish i18n to ao-website

## Problem

The `ao-website` (`argentumonline.org`) homepage (`index.html`) is a static HTML
file with all user-visible text hardcoded in a mix of English and Spanish — a
leftover of its history as two separate pages. There is no language switcher.
Visitors who prefer one language see inconsistent content; search engines index
a mixed-language page.

## Goal

Make every piece of user-visible text on `index.html` available in both
**English (en)** and **Spanish (es)**, with a visible language switcher in the
header that persists the choice across page loads (localStorage). No framework,
no build step — plain vanilla JS to keep the file self-contained and deployable
as a GitHub Pages static site.

## Approach

1. Extract all translatable strings from `index.html` into a `locales/` folder:
   - `ao-website/locales/en.json`
   - `ao-website/locales/es.json`

2. Add a `data-i18n` attribute to every element whose text content needs
   translation. Elements whose text contains inline HTML (links, `<br>`) use
   `data-i18n-html` instead and the JS sets `innerHTML`.

3. Add a thin `i18n.js` script (~80 lines) that:
   - Loads the correct locale JSON via `fetch` on page load.
   - Replaces text/html of all `[data-i18n]` / `[data-i18n-html]` elements.
   - Sets `<html lang="…">`.
   - Reads/writes the chosen language to `localStorage` key `ao-lang`.
   - Defaults to Spanish (`es`) if no preference is stored.

4. Add a language switcher button in the header (`EN | ES`) that calls the
   i18n module to swap languages without a page reload.

## Out of scope

- Translating `nfts.html`, `aolb-token-crowdsale.html`, or any other page.
- More than two languages.
- Server-side rendering or URL-based locale routing (`/en/`, `/es/`).
- SEO `hreflang` tags (nice to have, deferred).
