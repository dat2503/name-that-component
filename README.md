# Name That Component

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
  - the best-guess name
  - a confidence level (High / Medium / Low)
  - the framework component name (when readable), structural type, and the
    semantic label — plus what each one matched on
  - the render tree (e.g. `SaveButton ▸ SavePanel ▸ App`) when available
  - the element's tag, role, id, test id, and classes
  - a "Copy details" button
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
