# Chrome Web Store listing

Use this sheet when creating or updating the Chrome Web Store item.

## Product details

- **Name:** Name That Component
- **Category:** Developer Tools
- **Language:** English
- **Homepage:** https://github.com/dat2503/name-that-component
- **Support:** https://github.com/dat2503/name-that-component/issues
- **Summary:** Identify UI elements by framework component, design system,
  ARIA role, and semantic label—entirely offline.

## Detailed description

Name That Component helps developers, designers, QA engineers, and technical
writers identify the UI element under their cursor.

Activate the picker from the toolbar or with Alt+Shift+C, hover over a page,
and click an element to inspect it. The extension combines the app's own
React, Vue, Angular, or Astro component metadata (when available) with design
system signatures, ARIA roles, native HTML semantics, and nearby labels.

The result includes a best-guess name and confidence, visible and accessible
text, a best-effort locator, source file and render tree when exposed by a
development build, and a plain-text summary that can be copied into an issue,
test, or coding-agent prompt.

Highlights:

- Recognizes common design systems including MUI, Ant Design, Bootstrap,
  Chakra UI, shadcn/ui, Radix, Vuetify, Mantine, and more.
- Navigates to parent, child, and sibling elements with the arrow keys.
- Runs only after you invoke it on the active tab.
- Fully offline: no analytics, tracking, accounts, uploads, or remote code.

Framework component names are best on development and staging builds.
Production builds often remove or minify that metadata, so the extension falls
back to structural and semantic evidence.

## Single purpose

Inspect the user-selected UI element on the active webpage and identify its
framework component, design-system component, semantic label, and structural
role.

## Permission justifications

- **activeTab:** Grants temporary access to the current page only after the
  user invokes the extension, so it can inspect the selected element.
- **scripting:** Injects the packaged, local bridge and picker scripts into
  the user-invoked tab. The extension does not execute remote code.

## Privacy questionnaire

- Collects or uses user data: **No**
- Sells user data: **No**
- Uses data for purposes unrelated to the single purpose: **No**
- Uses data for creditworthiness or lending: **No**
- Remote code: **No**
- Privacy policy: https://github.com/dat2503/name-that-component/blob/main/PRIVACY.md

## Distribution

- **Visibility:** Public
- **Regions:** All regions unless a legal or support constraint requires less
- **Pricing:** Free

## Required assets

- Upload package: `release/name-that-component-1.3.0.zip`
- Store icon: `icons/icon128.png` (128 x 128)
- Screenshot: `docs/store-assets/screenshot-1280x800.png` (1280 x 800)
- Small promo tile: `docs/store-assets/small-promo-440x280.png` (440 x 280)

Screenshots and promotional art must show the actual extension accurately and
must not imply features the extension does not provide.
