# Name That Component

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Chrome extension that lets you point at any UI element on a page and see
what it is. It combines three layers of evidence:

- **The app's own component name** — read live from React (fiber), Vue
  (instance), Angular (`ng.getComponent`), or Astro islands
  (`<astro-island>`), so you get the developer's actual name (e.g.
  `SavePanel`, or `Counter` for an island) — even before it hydrates.
- **A semantic label** — derived from `data-testid`/`data-cy`, `aria-label`,
  `id`, or a nearby heading, and merged with the structural type to produce
  names like **"Save Panel"** or **"Product Card"**.
- **Structural type** — via ARIA role, native HTML semantics, or the design
  system it belongs to (Material UI, Ant Design, Bootstrap, Chakra UI,
  Vuetify, PrimeNG/PrimeReact, Blueprint, Fluent UI, Mantine, Radix Themes,
  Shopify Polaris, Semantic UI, shadcn/ui, Radix, Headless UI, Ionic, and
  other Web Component libraries).

Everything runs locally in the content script. No network requests, no
external API calls, no data collection.

## Install from the Chrome Web Store

The public store link will be added here after Chrome Web Store review. Until
then, use the unpacked installation instructions below.

## Install (unpacked, for development/personal use)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension directly from these files).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the `name-that-component` folder.
5. Pin the extension (puzzle-piece icon in the toolbar → pin) for quick access.

## Use

- Click the toolbar icon (or press `Alt+Shift+C`) on any webpage.
- Hover over elements — a quick-guess label follows your cursor.
- Click an element to lock it in (it gets a green outline). A panel shows:
  - the best-guess name and confidence (High / Medium / Low)
  - framework component name, optional **source file:line** (dev builds),
    structural type, semantic label
  - **visible text**, accessible name, and a best-effort **locator**
  - children summary and render tree when available
  - tag, role, id, test id, classes
  - **Copy details** — a full plain-text snapshot (name, component, text,
    locator, source, tree, page URL…) you can paste to an agent
- **Navigate without re-hovering:** with an element locked, use the arrow
  keys — `↑` parent, `↓` first child, `←`/`→` previous/next sibling.
- The panel automatically moves to a corner that doesn't cover the element.
- Keep clicking (or arrowing) to inspect more elements — the panel updates.
- Press `Esc` or hit "Exit" to stop.

## How detection works

Each locked element is scored on three independent layers, then composed
into one name:

**A. The app's own component name (best-effort)**
Reads React fiber / Vue instance / Angular internals on the element to
recover the developer's own name. Exact on dev builds; on minified
production builds the names are mangled, so the tool detects that and
reports the framework instead of showing garbage.

> **Implementation note:** Chrome content scripts run in an *isolated world*
> and cannot see page JS expandos (`__reactFiber$…`, `__vueParentComponent`,
> `window.ng`). A small `bridge.js` is injected into the page's **MAIN** world
> and talks to the content script via a synchronous DOM event + shared
> attributes — that is what makes framework component names work.

**B. Semantic label**
Pulls a purpose from (in order) `data-testid`/`data-cy`/`data-qa`,
`data-component`, `aria-label`/`aria-labelledby`, `title`, `name`, a
meaningful `id`, the element's own text (for buttons/links), or a nearby
heading. Auto-generated ids (`:r0:`, `css-1a2b3c`, hashes) are ignored.

**C. Structural type (self first, then ancestors)**
1. Design-system class / attribute signatures — `MuiButton-root`,
   `ant-modal`, `data-slot="dialog-content"` (shadcn/ui), Radix/Headless
   state attributes, etc.
2. Web Components — custom element tags like `<ion-button>`, `<sl-dialog>`.
3. Explicit ARIA role — `role="dialog"`, `role="tooltip"`, etc.
4. Native HTML semantics — `<select>`, `<dialog>`, `<details>`, etc.
5. Generic class-name heuristics — a class containing "modal", "card",
   "panel", etc. with no identifiable framework (lowest confidence).

The clicked element's **own** identity always wins over a container's, so a
plain `<button>` inside a card reads as **Button**, not Card. Ancestors are
only consulted when the element itself is anonymous, and such matches are
flagged "from a parent".

This is a heuristic tool, not a certainty machine — always sanity-check the
"Low confidence" results against DevTools if it matters.

## Limitations (be aware of these)

- **Framework component names are dev-build-friendly.** React/Vue/Angular
  minify component names in production, so on a minified build the tool
  shows the framework name (e.g. "React · component names minified") rather
  than a fabricated one. Run it against a dev/staging build to get real
  names like `SavePanel`.
- Minified/obfuscated **class** names won't match a design-system signature
  either — you'll fall back to an ARIA/tag/semantic result instead.
- **Astro:** interactive islands are named from `<astro-island>` (works for
  React, Preact, Vue, Svelte, Solid… island frameworks alike). But static
  `.astro` components compile to plain HTML with no runtime identity — their
  names are gone from the DOM and no tool can recover them, so static markup
  falls back to structural/semantic detection (and is tagged "Astro" when it
  carries a scoped-style marker).
- It cannot detect frameworks not in its signature list. Coverage is broad
  but not exhaustive — this is a static list, not a live lookup.
- It only runs in the top frame, so it can't inspect elements inside
  cross-origin iframes, and it can't see into closed shadow roots.

## Privacy and permissions

The extension requests only `activeTab` and `scripting`. Access is temporary
and begins only when you invoke the extension; it has no persistent access to
websites. See the full [privacy policy](PRIVACY.md).

## Development and release

There are no runtime dependencies or build step. Load the repository root as
an unpacked extension during development.

Validate the manifest and JavaScript:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release.ps1 -ValidateOnly
```

Create the allowlisted Chrome Web Store ZIP in `release/`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/release.ps1
```

See [the store listing sheet](docs/chrome-web-store-listing.md) for listing
copy, permission justifications, privacy answers, and required assets.

## Contributing, security, and license

Contributions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md) first.
Please report vulnerabilities using the process in [SECURITY.md](SECURITY.md).

Name That Component is open-source software licensed under the
[MIT License](LICENSE).
