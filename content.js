(() => {
  // Versioned so an extension update can re-inject over an older content script
  // without requiring a full page reload.
  const NTC_VERSION = "1.0.0";
  if (window.__ntcInjected === NTC_VERSION) return;
  if (window.__ntcCleanup) {
    try { window.__ntcCleanup(); } catch (_) {}
  }
  window.__ntcInjected = NTC_VERSION;

  /* ============================================================
   *  Everything runs against the DOM already in the page.
   *  No network requests, no external lookups.
   * ============================================================ */

  /* ---------- string helpers ---------- */

  const ABBR = {
    btn: "Button", sel: "Select", chk: "Checkbox", dlg: "Dialog",
    tbl: "Table", nav: "Navigation", txt: "Text Field", desc: "Description",
    hdr: "Header", ftr: "Footer", img: "Image", avatar: "Avatar",
    icon: "Icon", msg: "Message", ctn: "Container", col: "Column"
  };

  function titleCase(s) {
    if (!s) return s;
    if (ABBR[s.toLowerCase()]) return ABBR[s.toLowerCase()];
    return s
      .replace(/[-_./]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((w) => ABBR[w.toLowerCase()] || (w[0].toUpperCase() + w.slice(1)))
      .join(" ");
  }

  function cleanText(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  function capText(s, n) { s = cleanText(s); return s.length > n ? s.slice(0, n - 1).trim() + "…" : s; }
  function attr(el, name) { return el && el.getAttribute ? el.getAttribute(name) : null; }
  function getClassTokens(el) {
    if (!el || !el.className) return [];
    const raw = typeof el.className === "string" ? el.className : (el.className.baseVal || "");
    return raw.split(/\s+/).filter(Boolean);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /* ============================================================
   *  1. STRUCTURAL DETECTION (what kind of thing is this)
   * ============================================================ */

  // MUI layout wrappers — real, but rarely the answer you want.
  const LAYOUT_PRIMITIVES = new Set(["Box", "Container", "Grid", "Grid2", "Stack"]);

  // Prefix-based design systems. Loose prefixes (Vuetify v-, Prime p-) are
  // constrained to real component lists so they don't fire on utility classes.
  const PREFIX_SYSTEMS = [
    { system: "Material UI (MUI)", re: /^Mui([A-Z][a-zA-Z0-9]*)-/, fmt: (m) => titleCase(m[1]) },
    { system: "Mantine", re: /^mantine-([A-Z][a-zA-Z0-9]*)-/, fmt: (m) => titleCase(m[1]) },
    { system: "Radix Themes", re: /^rt-([A-Z][a-zA-Z0-9]*)/, fmt: (m) => titleCase(m[1]) },
    { system: "Chakra UI", re: /^chakra-([a-z0-9]+)/, fmt: (m) => titleCase(m[1]) },
    { system: "Fluent UI", re: /^fui-([A-Z][a-zA-Z0-9]*)/, fmt: (m) => titleCase(m[1]) },
    { system: "Shopify Polaris", re: /^Polaris-([A-Z][a-zA-Z0-9]*)/, fmt: (m) => titleCase(m[1]) },
    { system: "Blueprint", re: /^bp[3-5]-([a-z0-9]+)/, fmt: (m) => titleCase(m[1]) },
    { system: "Ant Design", re: /^ant-([a-z0-9]+)/, fmt: (m) => titleCase(m[1] === "btn" ? "button" : m[1]) },
    {
      system: "Vuetify",
      re: /^v-(btn|card|dialog|list-item|list|menu|tabs|tab|chip|badge|alert|snackbar|tooltip|navigation-drawer|app-bar|toolbar|banner|bottom-sheet|expansion-panels?|data-table|table|select|text-field|textarea|checkbox|radio|switch|slider|progress-linear|progress-circular|avatar|breadcrumbs|pagination|stepper|timeline|carousel|sheet|overlay|combobox|autocomplete|rating|fab|speed-dial|window|form|input)(?:$|__|--)/,
      fmt: (m) => titleCase(m[1])
    },
    {
      system: "PrimeNG / PrimeReact",
      re: /^p-(button|dialog|dropdown|datatable|inputtext|inputnumber|inputmask|calendar|checkbox|radiobutton|toast|menubar|menu|panel|accordion|tabview|card|chip|badge|tag|paginator|treetable|tree|multiselect|autocomplete|slider|rating|selectbutton|togglebutton|listbox|overlaypanel|sidebar|steps|breadcrumb|carousel|galleria|fileupload|editor|password|chips|colorpicker|splitbutton|speeddial|tooltip|progressbar|progressspinner|scrollpanel|divider|avatar|timeline|orderlist|picklist|dataview)(?:$|-)/,
      fmt: (m) => titleCase(m[1])
    }
  ];

  // shadcn/ui (and other Radix-based systems) tag roots with data-slot.
  function detectDataSlot(el) {
    const slot = attr(el, "data-slot");
    if (!slot) return null;
    const parts = slot.split("-");
    const base = titleCase(parts[0]);
    const rest = parts.length > 1 ? titleCase(parts.slice(1).join(" ")) : null;
    return {
      system: "shadcn/ui (Radix)",
      component: rest ? `${base} (${rest})` : base,
      matchedOn: `data-slot="${slot}"`,
      isLayout: false
    };
  }

  // Bootstrap: only distinctive compound tokens (single words like "card"
  // collide with too many other frameworks, so they fall through to keywords).
  const BOOTSTRAP_TOKENS = {
    "modal-dialog": "Modal", "modal-content": "Modal", "dropdown-menu": "Dropdown Menu",
    "dropdown-toggle": "Dropdown", "list-group": "List Group", "nav-tabs": "Tabs",
    "nav-pills": "Tabs", "form-select": "Select", "form-check": "Checkbox / Radio",
    "form-floating": "Floating Label", "input-group": "Input Group",
    "spinner-border": "Spinner", "spinner-grow": "Spinner", "btn-group": "Button Group",
    "btn-toolbar": "Button Toolbar", "progress-bar": "Progress Bar", "offcanvas": "Offcanvas",
    "carousel-item": "Carousel", "accordion-item": "Accordion", "toast-container": "Toast",
    "page-item": "Pagination", "navbar-brand": "Navbar", "navbar-nav": "Navbar"
  };

  const SEMANTIC_UI_WORDS = ["button", "modal", "dropdown", "accordion", "card",
    "label", "popup", "progress", "checkbox", "tab", "menu", "message", "form", "input", "segment"];

  const CUSTOM_ELEMENT_LIBS = {
    ion: "Ionic", mwc: "Material Web Components", md: "Material Web",
    sl: "Shoelace", calcite: "Esri Calcite", fluent: "Fluent UI Web Components",
    wa: "Web Awesome", wired: "Wired Elements", vaadin: "Vaadin", sp: "Spectrum Web Components",
    astro: "Astro"
  };

  const ARIA_ROLE_NAMES = {
    dialog: "Dialog", alertdialog: "Alert Dialog", tooltip: "Tooltip", menu: "Menu",
    menuitem: "Menu Item", menubar: "Menu Bar", menuitemcheckbox: "Menu Item (Checkbox)",
    menuitemradio: "Menu Item (Radio)", listbox: "Listbox", combobox: "Combobox", tab: "Tab",
    tablist: "Tab List", tabpanel: "Tab Panel", tree: "Tree", treeitem: "Tree Item",
    treegrid: "Tree Grid", progressbar: "Progress Bar", slider: "Slider", spinbutton: "Spin Button",
    switch: "Switch", checkbox: "Checkbox", radio: "Radio Button", radiogroup: "Radio Group",
    button: "Button", link: "Link", alert: "Alert", status: "Status", log: "Log", timer: "Timer",
    banner: "Banner", navigation: "Navigation", search: "Search", searchbox: "Search Box",
    form: "Form", table: "Table", grid: "Grid", gridcell: "Grid Cell", row: "Table Row",
    rowgroup: "Row Group", rowheader: "Row Header", columnheader: "Column Header", cell: "Table Cell",
    option: "Option", group: "Group", region: "Region", article: "Article", complementary: "Sidebar",
    contentinfo: "Footer", main: "Main Content", list: "List", listitem: "List Item",
    toolbar: "Toolbar", img: "Image", figure: "Figure", separator: "Separator",
    presentation: "Presentation", none: "Presentation", heading: "Heading", note: "Note",
    feed: "Feed", meter: "Meter", scrollbar: "Scrollbar", tooltip_: "Tooltip"
  };

  const NATIVE_TAG_NAMES = {
    dialog: "Dialog", details: "Disclosure", summary: "Disclosure Toggle", select: "Select",
    button: "Button", textarea: "Textarea", progress: "Progress Bar", meter: "Meter",
    nav: "Navigation", header: "Header", footer: "Footer", aside: "Sidebar", main: "Main Content",
    article: "Article", section: "Section", table: "Table", thead: "Table Head", tbody: "Table Body",
    tr: "Table Row", td: "Table Cell", th: "Table Header Cell", form: "Form", fieldset: "Fieldset",
    legend: "Legend", label: "Label", a: "Link", img: "Image", picture: "Image", figure: "Figure",
    video: "Video Player", audio: "Audio Player", ul: "List", ol: "Ordered List", li: "List Item",
    dl: "Description List", blockquote: "Blockquote", canvas: "Canvas", iframe: "Embedded Frame"
  };

  const INPUT_TYPE_NAMES = {
    checkbox: "Checkbox", radio: "Radio Button", range: "Slider", submit: "Submit Button",
    button: "Button", search: "Search Field", file: "File Input", color: "Color Picker",
    date: "Date Picker", "datetime-local": "Date-Time Picker", time: "Time Picker",
    email: "Email Field", password: "Password Field", tel: "Phone Field", number: "Number Field",
    url: "URL Field", month: "Month Picker", week: "Week Picker"
  };

  const GENERIC_KEYWORDS = [
    { name: "Modal", words: ["modal", "dialog-overlay", "lightbox"] },
    { name: "Tooltip", words: ["tooltip"] },
    { name: "Popover", words: ["popover"] },
    { name: "Dropdown", words: ["dropdown"] },
    { name: "Accordion", words: ["accordion", "collapse", "collapsible"] },
    { name: "Tabs", words: ["tabs", "tablist"] },
    { name: "Carousel", words: ["carousel", "slider-wrapper", "swiper"] },
    { name: "Badge", words: ["badge"] },
    { name: "Chip / Tag", words: ["chip", "tag", "pill"] },
    { name: "Avatar", words: ["avatar"] },
    { name: "Alert / Toast", words: ["alert", "toast", "snackbar", "notification"] },
    { name: "Breadcrumb", words: ["breadcrumb", "breadcrumbs"] },
    { name: "Pagination", words: ["pagination", "pager"] },
    { name: "Progress Bar", words: ["progressbar", "progress-bar"] },
    { name: "Spinner / Loader", words: ["spinner", "loader", "loading", "skeleton"] },
    { name: "Drawer / Sidebar", words: ["drawer", "sidebar", "offcanvas"] },
    { name: "Card", words: ["card"] },
    { name: "Panel", words: ["panel"] },
    { name: "Navbar", words: ["navbar", "nav-bar"] },
    { name: "Menu", words: ["menu"] },
    { name: "Stepper", words: ["stepper", "wizard", "steps"] },
    { name: "Timeline", words: ["timeline"] },
    { name: "Rating", words: ["rating", "stars"] },
    { name: "Banner / Hero", words: ["banner", "hero"] },
    { name: "Table", words: ["table", "datagrid", "data-grid"] },
    { name: "Form Field", words: ["form-group", "form-field", "input-wrapper"] }
  ];

  function detectDesignSystem(el) {
    const dataSlot = detectDataSlot(el);
    if (dataSlot) return dataSlot;

    const tokens = getClassTokens(el);
    for (const token of tokens) {
      for (const sys of PREFIX_SYSTEMS) {
        const m = token.match(sys.re);
        if (m) {
          const component = sys.fmt(m);
          return {
            system: sys.system,
            component,
            matchedOn: `class="${token}"`,
            isLayout: sys.system.startsWith("Material UI") && LAYOUT_PRIMITIVES.has(component)
          };
        }
      }
      if (BOOTSTRAP_TOKENS[token]) {
        return { system: "Bootstrap", component: BOOTSTRAP_TOKENS[token], matchedOn: `class="${token}"`, isLayout: false };
      }
    }

    if (tokens.includes("ui")) {
      const hit = tokens.find((t) => SEMANTIC_UI_WORDS.includes(t));
      if (hit) return { system: "Semantic UI / Fomantic UI", component: titleCase(hit), matchedOn: `class="ui ${hit}"`, isLayout: false };
    }
    return null;
  }

  function detectCustomElement(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    const dash = tag.indexOf("-");
    if (dash <= 0) return null;
    const prefix = tag.slice(0, dash);
    const rest = tag.slice(dash + 1);
    const lib = CUSTOM_ELEMENT_LIBS[prefix];
    if (lib) return { system: lib, component: titleCase(rest), matchedOn: `<${tag}>` };
    return { system: `Custom element (unknown lib, prefix "${prefix}")`, component: titleCase(rest), matchedOn: `<${tag}>` };
  }

  // Radix / Headless UI expose state attributes even without a design-system class.
  function detectStateSignals(el) {
    if (el.hasAttribute && el.hasAttribute("data-headlessui-state")) {
      const role = attr(el, "role");
      const comp = role && ARIA_ROLE_NAMES[role] ? ARIA_ROLE_NAMES[role] : "Interactive element";
      return { system: "Headless UI", component: comp, matchedOn: "data-headlessui-state" };
    }
    if (el.attributes) {
      for (const a of el.attributes) {
        if (a.name.indexOf("data-radix-") === 0) {
          return { system: "Radix UI", component: titleCase(a.name.slice(11)) || "Primitive", matchedOn: a.name };
        }
      }
    }
    return null;
  }

  function detectKeyword(el) {
    const tokens = getClassTokens(el).map((t) => t.toLowerCase());
    if (!tokens.length) return null;
    for (const g of GENERIC_KEYWORDS) {
      const word = g.words.find((w) => tokens.includes(w));
      if (word) return { name: g.name, word };
    }
    return null;
  }

  // Self-first structural cascade. The element's own identity beats an
  // ancestor's, so a plain <button> inside a card is a "Button", not a "Card".
  function getStructuralType(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";

    const dsSelf = detectDesignSystem(el);
    if (dsSelf && !dsSelf.isLayout)
      return { type: dsSelf.component, confidence: "High", source: `${dsSelf.system} · ${dsSelf.matchedOn}`, system: dsSelf.system, viaAncestor: false, generic: false };

    const ce = detectCustomElement(el);
    if (ce)
      return { type: ce.component, confidence: "High", source: `${ce.system} · ${ce.matchedOn}`, system: ce.system, viaAncestor: false, generic: false };

    const role = attr(el, "role");
    if (role && ARIA_ROLE_NAMES[role])
      return { type: ARIA_ROLE_NAMES[role], confidence: "High", source: `ARIA role="${role}"`, viaAncestor: false, generic: false };

    if (tag === "input") {
      const ty = (attr(el, "type") || "text").toLowerCase();
      if (INPUT_TYPE_NAMES[ty])
        return { type: INPUT_TYPE_NAMES[ty], confidence: "High", source: `native <input type="${ty}">`, viaAncestor: false, generic: false };
      if (ty !== "hidden")
        return { type: "Text Field", confidence: "Medium", source: `native <input type="${ty}">`, viaAncestor: false, generic: false };
    }
    if (NATIVE_TAG_NAMES[tag])
      return { type: NATIVE_TAG_NAMES[tag], confidence: "Medium", source: `native <${tag}>`, viaAncestor: false, generic: false };

    const ss = detectStateSignals(el);
    if (ss)
      return { type: ss.component, confidence: "Medium", source: `${ss.system} · ${ss.matchedOn}`, system: ss.system, viaAncestor: false, generic: false };

    if (dsSelf && dsSelf.isLayout)
      return { type: dsSelf.component, confidence: "Medium", source: `${dsSelf.system} layout · ${dsSelf.matchedOn}`, system: dsSelf.system, viaAncestor: false, generic: false, isLayout: true };

    const kwSelf = detectKeyword(el);
    if (kwSelf)
      return { type: kwSelf.name, confidence: "Low", source: `class contains "${kwSelf.word}"`, viaAncestor: false, generic: false };

    // Climb for a design-system ancestor, preferring a non-layout match.
    let node = el.parentElement, depth = 0, layoutFallback = null;
    while (node && depth < 4) {
      const ds = detectDesignSystem(node);
      if (ds) {
        if (!ds.isLayout)
          return { type: ds.component, confidence: "Medium", source: `${ds.system} (parent) · ${ds.matchedOn}`, system: ds.system, viaAncestor: true, generic: false };
        if (!layoutFallback)
          layoutFallback = { type: ds.component, confidence: "Low", source: `${ds.system} layout (parent) · ${ds.matchedOn}`, system: ds.system, viaAncestor: true, generic: false, isLayout: true };
      }
      node = node.parentElement; depth++;
    }

    node = el.parentElement; depth = 0;
    while (node && depth < 2) {
      const kw = detectKeyword(node);
      if (kw) return { type: kw.name, confidence: "Low", source: `parent class contains "${kw.word}"`, viaAncestor: true, generic: false };
      node = node.parentElement; depth++;
    }

    if (layoutFallback) return layoutFallback;
    return { type: `<${tag}>`, confidence: "Low", source: "No structural pattern matched", viaAncestor: false, generic: true };
  }

  /* ============================================================
   *  2. FRAMEWORK COMPONENT NAME (the developer's own name)
   *     Read via the MAIN-world bridge (bridge.js). Content scripts
   *     cannot see React fiber / Vue / Angular expandos — they live
   *     in the page's isolated JS world. The bridge listens for a
   *     sync DOM event and writes JSON into a shared attribute.
   * ============================================================ */

  let probeSeq = 0;
  let fwCache = new WeakMap(); // element -> framework info | null

  // Attribute-based Astro island names are visible without the bridge
  // (they're real DOM attrs). Keep a lightweight local path as a fallback
  // when the bridge isn't injected yet.
  function getAstroInfoLocal(el) {
    try {
      let node = el, guard = 0;
      while (node && guard++ < 40) {
        if (node.tagName && node.tagName.toLowerCase() === "astro-island") {
          const exp = attr(node, "component-export");
          let name = null;
          if (exp && exp !== "default" && /^[A-Za-z_$]/.test(exp)) name = exp;
          else {
            const url = attr(node, "component-url") || "";
            let base = url.split(/[?#]/)[0].split("/").pop() || "";
            base = base.replace(/\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro)$/i, "");
            base = base.replace(/\.([A-Za-z0-9_-]{6,})$/, (m, h) =>
              /[0-9]/.test(h) || (/[a-z]/.test(h) && /[A-Z]/.test(h)) ? "" : m);
            if (base && /[A-Za-z]/.test(base) && !/^(index|client|entry|chunk|app|main|hoisted)$/i.test(base))
              name = base;
          }
          const client = attr(node, "client");
          const detail = client ? `client:${client}` : "island";
          if (name)
            return { framework: "Astro island", componentName: name, humanized: titleCase(name), chain: [name], minified: false, detail, matchedOn: "<astro-island>" };
          return { framework: "Astro island", componentName: null, chain: [], presenceOnly: true, detail, matchedOn: "<astro-island>" };
        }
        node = node.parentElement;
      }
      node = el; guard = 0;
      while (node && guard++ < 4) {
        if (node.attributes) {
          for (const a of node.attributes) {
            if (a.name.indexOf("data-astro-cid") === 0)
              return { framework: "Astro", componentName: null, chain: [], presenceOnly: true, detail: "scoped .astro component", matchedOn: a.name };
          }
        }
        node = node.parentElement;
      }
      return null;
    } catch (e) { return null; }
  }

  function probeBridge(el) {
    if (!el || el.nodeType !== 1) return null;
    const id = `ntc${++probeSeq}`;
    const root = document.documentElement;
    try {
      el.setAttribute("data-ntc-el", id);
      root.setAttribute("data-ntc-probe-id", id);
      root.setAttribute("data-ntc-fw", "");
      // Bridge handler runs synchronously during dispatchEvent.
      root.dispatchEvent(new CustomEvent("ntc-fw-request", { bubbles: false }));
      const raw = root.getAttribute("data-ntc-fw");
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    } finally {
      try { el.removeAttribute("data-ntc-el"); } catch (_) {}
      try {
        root.removeAttribute("data-ntc-probe-id");
        root.removeAttribute("data-ntc-fw");
      } catch (_) {}
    }
  }

  function getFramework(el) {
    if (!el || el.nodeType !== 1) return null;
    if (fwCache.has(el)) return fwCache.get(el);

    let info = probeBridge(el);
    // If the bridge didn't answer (not injected yet), fall back to Astro
    // attrs which are visible in the content-script world.
    if (!info) info = getAstroInfoLocal(el);

    fwCache.set(el, info);
    return info;
  }

  function clearFrameworkCache() {
    fwCache = new WeakMap();
  }

  /* ============================================================
   *  3. SEMANTIC PURPOSE (what this element is *for*)
   * ============================================================ */

  const TESTID_ATTRS = ["data-testid", "data-test-id", "data-test", "data-cy", "data-qa",
    "data-e2e", "data-automation-id", "data-tid"];

  function looksAutoGenerated(s) {
    if (!s) return true;
    s = String(s);
    if (s.length > 40) return true;
    if (/^[0-9]/.test(s)) return true;
    if (/^(radix-|headlessui-|mui-|rc[-_]|react-aria|downshift-|ember|ext-|css-[a-z0-9]{5,}|sc-)/i.test(s)) return true;
    if (/[:]/.test(s)) return true;                 // React useId ":r0:"
    if (/[a-f0-9]{8,}/i.test(s)) return true;       // hex / uuid chunk
    if (/\d{4,}/.test(s)) return true;              // long digit run
    if (/^[a-z0-9]{16,}$/i.test(s)) return true;    // random blob
    return false;
  }

  function firstTestId(el) {
    for (const a of TESTID_ATTRS) { const v = attr(el, a); if (v) return v; }
    return null;
  }

  function idsText(list) {
    const parts = String(list).split(/\s+/).map((id) => {
      const t = document.getElementById(id);
      return t ? cleanText(t.textContent) : "";
    }).filter(Boolean);
    return parts.join(" ");
  }

  function getPurpose(el) {
    const tid = firstTestId(el);
    if (tid && !looksAutoGenerated(tid)) return { text: capText(titleCase(tid), 40), from: "data-testid" };

    const dc = attr(el, "data-component") || attr(el, "data-comp");
    if (dc) return { text: capText(titleCase(dc), 40), from: "data-component" };

    const al = attr(el, "aria-label");
    if (al && cleanText(al)) return { text: capText(al, 40), from: "aria-label" };

    const lb = attr(el, "aria-labelledby");
    if (lb) { const t = idsText(lb); if (t) return { text: capText(t, 40), from: "aria-labelledby" }; }

    const title = attr(el, "title");
    if (title && cleanText(title)) return { text: capText(title, 40), from: "title" };

    const nm = attr(el, "name");
    if (nm && !looksAutoGenerated(nm)) return { text: capText(titleCase(nm), 40), from: "name" };

    if (el.id && !looksAutoGenerated(el.id)) return { text: capText(titleCase(el.id), 40), from: "id" };

    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    const role = attr(el, "role");
    const textual = ["button", "a", "summary"].includes(tag) ||
      ["button", "link", "tab", "menuitem", "option"].includes(role);
    if (textual) {
      const t = cleanText(el.textContent);
      if (t && t.length <= 40) return { text: t, from: "text content" };
    }

    if (el.querySelector) {
      const h = el.querySelector("h1,h2,h3,h4,h5,h6,[role=heading]");
      if (h) { const t = cleanText(h.textContent); if (t) return { text: capText(t, 40), from: "heading" }; }
    }
    return null;
  }

  /* ============================================================
   *  4. COMPOSE the display name
   * ============================================================ */

  const GENERIC_NAMES = new Set(["button", "card", "panel", "item", "row", "cell", "box",
    "container", "icon", "link", "modal", "dialog", "list", "input", "text", "label", "menu",
    "tab", "badge", "chip", "avatar", "image", "header", "footer", "section", "wrapper",
    "content", "view", "page", "layout", "grid", "stack", "group", "field", "form", "table",
    "column", "overlay", "popover", "tooltip", "dropdown", "select", "option", "toggle",
    "switch", "checkbox", "radio", "slider", "spinner", "loader", "divider", "separator",
    "tag", "pill", "banner", "alert", "toast", "snackbar", "drawer", "sidebar", "nav", "navbar",
    "breadcrumb", "pagination", "accordion", "collapse", "carousel", "step", "node", "element", "component"]);

  function isGenericName(humanized) {
    const words = humanized.toLowerCase().split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every((w) => GENERIC_NAMES.has(w));
  }

  function shortPurpose(text) {
    let t = cleanText(text).split(/\s+/).slice(0, 4).join(" ");
    if (t.length > 24) t = t.slice(0, 24).trim();
    return t.replace(/[\s:;,.-]+$/, "");
  }

  function combineName(purpose, type) {
    const p = cleanText(purpose), t = cleanText(type);
    if (!t) return p;
    if (!p) return t;
    const pl = p.toLowerCase(), tl = t.toLowerCase();
    if (pl.includes(tl)) return p;
    if (tl.includes(pl)) return t;
    return `${p} ${t}`;
  }

  function identify(el) {
    if (!el || el.nodeType !== 1) return null;

    const fw = getFramework(el);
    const st = getStructuralType(el);
    const purpose = getPurpose(el);

    const hasType = st && !st.generic;
    const comp = fw && fw.componentName ? (fw.humanized || titleCase(fw.componentName)) : null;
    const compGeneric = comp ? isGenericName(comp) : false;

    let name, confidence, source, viaAncestor = false;

    if (comp && !compGeneric) {
      name = comp; confidence = "High"; source = `${fw.framework} component name`;
    } else if (comp && compGeneric && purpose) {
      name = combineName(shortPurpose(purpose.text), comp); confidence = "High"; source = `${fw.framework} component + label`;
    } else if (comp) {
      name = comp; confidence = "High"; source = `${fw.framework} component name`;
    } else if (hasType && purpose) {
      name = combineName(shortPurpose(purpose.text), st.type); confidence = st.confidence; source = `${st.source} + label`; viaAncestor = st.viaAncestor;
    } else if (hasType) {
      name = st.type; confidence = st.confidence; source = st.source; viaAncestor = st.viaAncestor;
    } else if (purpose) {
      name = purpose.text; confidence = "Low"; source = `Label from ${purpose.from}`;
    } else {
      name = `Unidentified <${el.tagName.toLowerCase()}>`; confidence = "Low"; source = "No pattern matched";
    }

    return {
      name, confidence, source, viaAncestor,
      framework: fw ? fw.framework : null,
      component: fw && fw.componentName ? fw.componentName : null,
      componentMinified: fw ? !!fw.minified : false,
      presenceOnly: fw ? !!fw.presenceOnly : false,
      frameworkDetail: fw && fw.detail ? fw.detail : null,
      fileSource: fw && fw.source ? fw.source : null,
      type: hasType ? st.type : null,
      typeSource: hasType ? st.source : null,
      system: hasType ? (st.system || null) : null,
      purpose: purpose ? purpose.text : null,
      purposeFrom: purpose ? purpose.from : null,
      chain: fw && fw.chain && fw.chain.length ? fw.chain : null
    };
  }

  /* ============================================================
   *  5. RICH ELEMENT FACTS (text, a11y name, locator, …)
   *     Extra detail so a copied snapshot is enough for an agent
   *     to find the same UI in code without re-probing the page.
   * ============================================================ */

  function getOwnText(el, max) {
    if (!el) return "";
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea" || tag === "select") {
      const v = el.value != null ? String(el.value) : "";
      if (cleanText(v)) return capText(v, max);
      const ph = attr(el, "placeholder");
      return ph ? capText(ph, max) : "";
    }
    if (tag === "img" || tag === "area") {
      const alt = attr(el, "alt");
      return alt ? capText(alt, max) : "";
    }
    // Prefer visible text; fall back to textContent
    let t = "";
    try { t = el.innerText; } catch (_) {}
    if (!cleanText(t)) t = el.textContent;
    return capText(t, max);
  }

  function getAccessibleName(el) {
    const al = attr(el, "aria-label");
    if (al && cleanText(al)) return { text: capText(al, 120), from: "aria-label" };

    const lb = attr(el, "aria-labelledby");
    if (lb) {
      const t = idsText(lb);
      if (t) return { text: capText(t, 120), from: "aria-labelledby" };
    }

    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    if (tag === "img" || tag === "area") {
      const alt = attr(el, "alt");
      if (alt && cleanText(alt)) return { text: capText(alt, 120), from: "alt" };
    }
    if (tag === "input" || tag === "textarea") {
      // Associated <label for="id">
      if (el.id) {
        try {
          const lab = document.querySelector(`label[for="${CSS.escape ? CSS.escape(el.id) : el.id}"]`);
          if (lab) {
            const t = cleanText(lab.textContent);
            if (t) return { text: capText(t, 120), from: "label[for]" };
          }
        } catch (_) {}
      }
      const ph = attr(el, "placeholder");
      if (ph && cleanText(ph)) return { text: capText(ph, 120), from: "placeholder" };
    }
    if (tag === "button" || tag === "a" || attr(el, "role") === "button") {
      const t = getOwnText(el, 80);
      if (t) return { text: t, from: "text content" };
    }
    const title = attr(el, "title");
    if (title && cleanText(title)) return { text: capText(title, 120), from: "title" };
    return null;
  }

  function bestLocator(el) {
    const tid = firstTestId(el);
    if (tid) {
      // Prefer the actual attribute name that matched
      for (const a of TESTID_ATTRS) {
        if (attr(el, a) === tid) return { kind: a, value: tid, selector: `[${a}="${tid}"]` };
      }
    }
    if (el.id && !looksAutoGenerated(el.id))
      return { kind: "id", value: el.id, selector: `#${el.id}` };

    const al = attr(el, "aria-label");
    if (al && cleanText(al))
      return { kind: "aria-label", value: cleanText(al), selector: `[aria-label="${cleanText(al)}"]` };

    const role = attr(el, "role");
    const name = getAccessibleName(el);
    if (role && name)
      return { kind: "role+name", value: `${role} "${name.text}"`, selector: `[role="${role}"]` };

    const nameAttr = attr(el, "name");
    if (nameAttr && !looksAutoGenerated(nameAttr))
      return { kind: "name", value: nameAttr, selector: `[name="${nameAttr}"]` };

    return { kind: "css", value: cssPath(el), selector: cssPath(el) };
  }

  function cssPath(el) {
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 5 && node !== document.body && node !== document.documentElement) {
      const tid = firstTestId(node);
      if (tid) {
        let attrName = "data-testid";
        for (const a of TESTID_ATTRS) { if (attr(node, a) === tid) { attrName = a; break; } }
        parts.unshift(`[${attrName}="${tid}"]`);
        break;
      }
      if (node.id && !looksAutoGenerated(node.id)) {
        parts.unshift(`#${node.id}`);
        break;
      }
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const same = Array.prototype.filter.call(parent.children, (c) => c.tagName === node.tagName);
        if (same.length > 1) {
          const idx = Array.prototype.indexOf.call(same, node) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }
      parts.unshift(part);
      node = parent;
      depth++;
    }
    return parts.join(" > ") || (el.tagName ? el.tagName.toLowerCase() : "");
  }

  function childSummary(el, maxKids) {
    if (!el || !el.children) return null;
    const n = el.children.length;
    if (!n) return null;
    const samples = [];
    const limit = Math.min(n, maxKids || 4);
    for (let i = 0; i < limit; i++) {
      const c = el.children[i];
      const tag = c.tagName ? c.tagName.toLowerCase() : "?";
      const t = getOwnText(c, 40);
      samples.push(t ? `<${tag}> "${t}"` : `<${tag}>`);
    }
    const more = n > limit ? ` (+${n - limit} more)` : "";
    return `${n} child${n === 1 ? "" : "ren"}: ${samples.join("; ")}${more}`;
  }

  function ancestorTags(el, depth) {
    const tags = [];
    let node = el.parentElement;
    let d = 0;
    while (node && d < (depth || 4) && node !== document.body) {
      tags.push(node.tagName.toLowerCase());
      node = node.parentElement;
      d++;
    }
    return tags.length ? tags.join(" < ") : null;
  }

  function collectFacts(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : "";
    const role = attr(el, "role");
    const testid = firstTestId(el);
    const a11y = getAccessibleName(el);
    const text = getOwnText(el, 240);
    const locator = bestLocator(el);
    const href = tag === "a" ? attr(el, "href") : null;
    const inputType = tag === "input" ? (attr(el, "type") || "text") : null;
    const nameAttr = attr(el, "name");
    const placeholder = attr(el, "placeholder");
    const value = (tag === "input" || tag === "textarea") && el.value != null
      ? capText(String(el.value), 120) : null;
    const classes = getClassTokens(el);

    return {
      tag,
      role: role || null,
      id: el.id || null,
      testid: testid || null,
      classes: classes.length ? classes.join(" ") : null,
      text: text || null,
      accessibleName: a11y ? a11y.text : null,
      accessibleNameFrom: a11y ? a11y.from : null,
      locator: locator.selector,
      locatorKind: locator.kind,
      href: href || null,
      inputType,
      nameAttr: nameAttr || null,
      placeholder: placeholder || null,
      value,
      children: childSummary(el, 4),
      ancestors: ancestorTags(el, 4),
      pageUrl: (typeof location !== "undefined" && location.href) ? location.href : null
    };
  }

  /* ============================================================
   *  UI — shadow DOM so nothing leaks into / clashes with page CSS
   * ============================================================ */

  const host = document.createElement("div");
  host.id = "__name-that-component-host__";
  host.style.all = "initial";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
      #overlay {
        position: fixed; pointer-events: none; z-index: 2147483644;
        border: 2px solid #6366f1; background: rgba(99,102,241,0.12);
        border-radius: 4px; transition: all 60ms ease-out; display: none;
      }
      #selbox {
        position: fixed; pointer-events: none; z-index: 2147483645;
        border: 2px solid #22c55e; background: rgba(34,197,94,0.10);
        border-radius: 4px; display: none;
      }
      #quicklabel {
        position: fixed; pointer-events: none; z-index: 2147483647;
        background: #111827; color: #fff; font-size: 12px; font-weight: 600;
        padding: 4px 8px; border-radius: 6px; display: none; white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,.25); max-width: 260px; overflow: hidden; text-overflow: ellipsis;
      }
      #panel {
        position: fixed; width: 340px; max-height: 82vh; overflow-y: auto;
        background: #ffffff; color: #111827; border-radius: 12px;
        box-shadow: 0 12px 32px rgba(0,0,0,.28); z-index: 2147483647;
        display: none; border: 1px solid #e5e7eb;
      }
      #panel .head {
        background: #111827; color: #fff; padding: 10px 14px; position: sticky; top: 0;
        display: flex; align-items: center; justify-content: space-between;
      }
      #panel .head span { font-size: 11px; font-weight: 700; letter-spacing: .04em; opacity: .8; }
      #panel .close { cursor: pointer; opacity: .7; font-size: 16px; line-height: 1; background: none; border: none; color: #fff; }
      #panel .close:hover { opacity: 1; }
      #panel .body { padding: 14px; }
      #panel .name { font-size: 18px; font-weight: 700; margin-bottom: 8px; word-break: break-word; line-height: 1.25; }
      .badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 8px;
        border-radius: 999px; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 12px; }
      .badge.High { background: #dcfce7; color: #166534; }
      .badge.Medium { background: #fef9c3; color: #854d0e; }
      .badge.Low { background: #fee2e2; color: #991b1b; }
      .sec { border-top: 1px solid #f3f4f6; padding-top: 10px; margin-top: 4px; }
      .kv { display: flex; gap: 8px; font-size: 12px; line-height: 1.5; margin-bottom: 5px; }
      .kv .k { color: #6b7280; flex: 0 0 78px; }
      .kv .v { color: #111827; word-break: break-word; flex: 1; }
      .kv .v code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
        background: #eef2ff; color: #3730a3; padding: 1px 5px; border-radius: 4px; }
      .muted { color: #9ca3af; }
      .chain { font-size: 11px; color: #6b7280; margin-top: 8px; line-height: 1.6; word-break: break-word; }
      .chain .arw { color: #d1d5db; }
      .facts { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
      .pill { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px;
        background: #f3f4f6; color: #374151; padding: 2px 7px; border-radius: 5px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px;
        background: #f3f4f6; padding: 6px 8px; border-radius: 6px; margin-top: 8px;
        word-break: break-all; max-height: 56px; overflow-y: auto; color: #4b5563; }
      .actions { display: flex; gap: 8px; margin-top: 12px; }
      .actions button {
        flex: 1; font-size: 12px; font-weight: 600; padding: 7px 0; border-radius: 8px;
        border: 1px solid #e5e7eb; background: #f9fafb; cursor: pointer; color: #111827;
      }
      .actions button:hover { background: #f3f4f6; }
      .actions button.primary { background: #111827; color: #fff; border-color: #111827; }
      .actions button.primary:hover { background: #1f2937; }
      .nav { margin-top: 10px; font-size: 10px; color: #9ca3af; text-align: center; letter-spacing: .02em; }
      #hint {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: #111827; color: #fff; font-size: 12px; font-weight: 600;
        padding: 8px 16px; border-radius: 999px; z-index: 2147483647;
        box-shadow: 0 4px 12px rgba(0,0,0,.25);
      }
    </style>
    <div id="overlay"></div>
    <div id="selbox"></div>
    <div id="quicklabel"></div>
    <div id="hint">🖱️ Hover to preview &nbsp;·&nbsp; Click to inspect &nbsp;·&nbsp; Esc to exit</div>
    <div id="panel">
      <div class="head"><span>NAME THAT COMPONENT</span><button class="close" id="ntc-close">✕</button></div>
      <div class="body" id="ntc-body"></div>
    </div>
  `;

  const overlay = shadow.getElementById("overlay");
  const selbox = shadow.getElementById("selbox");
  const quicklabel = shadow.getElementById("quicklabel");
  const panel = shadow.getElementById("panel");
  const panelBody = shadow.getElementById("ntc-body");
  const hint = shadow.getElementById("hint");
  shadow.getElementById("ntc-close").addEventListener("click", () => deactivate());

  let active = false;
  let rafPending = false;
  let lastHovered = null;
  let selected = null;

  function isInsideOurUI(target) {
    return target === host || (target && target.nodeType === 1 && host.contains(target));
  }

  function boxTo(box, el) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) { box.style.display = "none"; return; }
    box.style.display = "block";
    box.style.left = `${r.left - 2}px`;
    box.style.top = `${r.top - 2}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  }

  function placeQuickLabel(el, x, y) {
    const guess = identify(el);
    quicklabel.textContent = guess ? guess.name : "";
    quicklabel.style.display = "block";
    quicklabel.style.left = `${Math.min(x + 14, window.innerWidth - 240)}px`;
    quicklabel.style.top = `${Math.max(y - 30, 6)}px`;
  }

  function rectsIntersect(a, b, m) {
    return !(a.right + m < b.left || a.left - m > b.right || a.bottom + m < b.top || a.top - m > b.bottom);
  }

  // Put the panel in whichever corner doesn't cover the inspected element.
  function positionPanel(el) {
    const gap = 16;
    const pr = panel.getBoundingClientRect();
    const w = pr.width || 340, h = pr.height || 200;
    const er = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const corners = [
      { left: vw - w - gap, top: vh - h - gap }, // bottom-right
      { left: vw - w - gap, top: gap },          // top-right
      { left: gap, top: vh - h - gap },          // bottom-left
      { left: gap, top: gap }                    // top-left
    ];
    let pick = corners[0];
    for (const c of corners) {
      const cand = { left: c.left, top: c.top, right: c.left + w, bottom: c.top + h };
      if (!rectsIntersect(cand, er, 8)) { pick = c; break; }
    }
    panel.style.left = `${Math.max(gap, pick.left)}px`;
    panel.style.top = `${Math.max(gap, pick.top)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function kv(k, v) { return `<div class="kv"><span class="k">${k}</span><span class="v">${v}</span></div>`; }

  function copyText(r, facts) {
    const lines = [];
    lines.push(`Name: ${r.name}`);
    lines.push(`Confidence: ${r.confidence}`);
    lines.push(`Matched via: ${r.source}`);

    if (r.component) {
      lines.push(`Framework component: ${r.component} (${r.framework})`);
    } else if (r.framework) {
      const note = r.componentMinified ? "names minified"
        : (r.frameworkDetail || (r.presenceOnly ? "detected on page" : ""));
      lines.push(`Framework: ${r.framework}${note ? ` (${note})` : ""}`);
    }
    if (r.fileSource) lines.push(`Source file: ${r.fileSource}`);
    if (r.chain && r.chain.length) lines.push(`Render tree: ${r.chain.join(" ▸ ")}`);

    if (r.type) {
      lines.push(`Structural type: ${r.type}${r.system ? ` · ${r.system}` : ""}`);
      if (r.typeSource) lines.push(`Type matched: ${r.typeSource}${r.viaAncestor ? " (from parent)" : ""}`);
    }
    if (r.purpose) lines.push(`Semantic label: ${r.purpose} (from ${r.purposeFrom})`);

    if (facts.text) lines.push(`Text: ${facts.text}`);
    if (facts.accessibleName)
      lines.push(`Accessible name: ${facts.accessibleName}${facts.accessibleNameFrom ? ` (from ${facts.accessibleNameFrom})` : ""}`);
    if (facts.value && facts.value !== facts.text) lines.push(`Value: ${facts.value}`);
    if (facts.placeholder) lines.push(`Placeholder: ${facts.placeholder}`);

    lines.push(`Tag: <${facts.tag}>`);
    if (facts.role) lines.push(`Role: ${facts.role}`);
    if (facts.inputType) lines.push(`Input type: ${facts.inputType}`);
    if (facts.id) lines.push(`ID: ${facts.id}`);
    if (facts.testid) lines.push(`Test id: ${facts.testid}`);
    if (facts.nameAttr) lines.push(`Name attr: ${facts.nameAttr}`);
    if (facts.href) lines.push(`Href: ${facts.href}`);
    if (facts.locator) lines.push(`Locator: ${facts.locator}${facts.locatorKind ? ` (${facts.locatorKind})` : ""}`);
    if (facts.classes) lines.push(`Classes: ${facts.classes}`);
    if (facts.children) lines.push(`Children: ${facts.children}`);
    if (facts.ancestors) lines.push(`Ancestors: ${facts.ancestors}`);
    if (facts.pageUrl) lines.push(`Page: ${facts.pageUrl}`);

    return lines.join("\n");
  }

  // SECURITY: every page-derived value below is passed through escapeHtml()
  // before it reaches innerHTML. `framework` and `confidence` are the only
  // unescaped interpolations and both come from fixed internal vocabularies
  // (never page text). Keep that invariant if you edit this function.
  function renderPanel(el) {
    const r = identify(el);
    const facts = collectFacts(el);

    const detailHtml = r.frameworkDetail ? ` <span class="muted">· ${escapeHtml(r.frameworkDetail)}</span>` : "";
    const rows = [];
    if (r.component) {
      rows.push(kv(`${escapeHtml(r.framework)} name`, `<code>${escapeHtml(r.component)}</code>` + detailHtml));
    } else if (r.framework) {
      const note = r.componentMinified ? " <span class=\"muted\">· component names minified in this build</span>"
        : (detailHtml || (r.presenceOnly ? " <span class=\"muted\">· detected on page</span>" : ""));
      rows.push(kv("Framework", escapeHtml(r.framework) + note));
    }
    if (r.fileSource) {
      rows.push(kv("Source", `<code>${escapeHtml(r.fileSource)}</code>`));
    }
    if (r.type) {
      rows.push(kv("Type", escapeHtml(r.type) +
        (r.system ? ` <span class="muted">· ${escapeHtml(r.system)}</span>` : "") +
        (r.viaAncestor ? " <span class=\"muted\">· from a parent</span>" : "")));
      rows.push(kv("Matched", `<span class="muted">${escapeHtml(r.typeSource)}</span>`));
    }
    if (r.purpose) {
      rows.push(kv("Label", escapeHtml(r.purpose) + ` <span class="muted">· ${escapeHtml(r.purposeFrom)}</span>`));
    }
    if (facts.text) {
      rows.push(kv("Text", escapeHtml(facts.text)));
    }
    if (facts.accessibleName && facts.accessibleName !== facts.text) {
      rows.push(kv("A11y name", escapeHtml(facts.accessibleName) +
        (facts.accessibleNameFrom ? ` <span class="muted">· ${escapeHtml(facts.accessibleNameFrom)}</span>` : "")));
    }
    if (facts.locator) {
      rows.push(kv("Locator", `<code>${escapeHtml(facts.locator)}</code>` +
        (facts.locatorKind ? ` <span class="muted">· ${escapeHtml(facts.locatorKind)}</span>` : "")));
    }
    if (facts.children) {
      rows.push(kv("Children", `<span class="muted">${escapeHtml(facts.children)}</span>`));
    }

    const chainHtml = (r.chain && r.chain.length > 1)
      ? `<div class="chain">${r.chain.map(escapeHtml).join(' <span class="arw">▸</span> ')}</div>` : "";

    panelBody.innerHTML = `
      <div class="name">${escapeHtml(r.name)}</div>
      <span class="badge ${r.confidence}">${r.confidence} confidence</span>
      <div class="sec">${rows.join("")}</div>
      ${chainHtml}
      <div class="facts">
        <span class="pill">&lt;${escapeHtml(facts.tag)}&gt;</span>
        ${facts.role ? `<span class="pill">role=${escapeHtml(facts.role)}</span>` : ""}
        ${facts.testid ? `<span class="pill">testid=${escapeHtml(facts.testid)}</span>` : ""}
        ${facts.id ? `<span class="pill">#${escapeHtml(facts.id)}</span>` : ""}
        ${facts.inputType ? `<span class="pill">type=${escapeHtml(facts.inputType)}</span>` : ""}
      </div>
      ${facts.classes ? `<div class="mono">${escapeHtml(facts.classes)}</div>` : ""}
      <div class="actions">
        <button id="ntc-copy">Copy details</button>
        <button id="ntc-exit" class="primary">Exit</button>
      </div>
      <div class="nav">↑ parent · ↓ child · ← → siblings</div>
    `;
    panel.style.display = "block";

    shadow.getElementById("ntc-copy").addEventListener("click", () => {
      navigator.clipboard.writeText(copyText(r, facts)).then(() => {
        const btn = shadow.getElementById("ntc-copy");
        btn.textContent = "Copied ✓";
        setTimeout(() => (btn.textContent = "Copy details"), 1200);
      }).catch(() => {});
    });
    shadow.getElementById("ntc-exit").addEventListener("click", deactivate);
  }

  function selectElement(el) {
    if (!el || el.nodeType !== 1 || isInsideOurUI(el)) return;
    selected = el;
    renderPanel(el);
    positionPanel(el);
    boxTo(selbox, el);
  }

  /* ---------- events ---------- */

  function onMouseMove(e) {
    if (!active) return;
    if (isInsideOurUI(e.target)) { overlay.style.display = "none"; quicklabel.style.display = "none"; return; }
    lastHovered = e.target;
    const x = e.clientX, y = e.clientY;
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (!lastHovered) return;
      boxTo(overlay, lastHovered);
      placeQuickLabel(lastHovered, x, y);
    });
  }

  function onClick(e) {
    if (!active) return;
    if (isInsideOurUI(e.target)) return; // let panel buttons work normally
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    selectElement(e.target);
  }

  function onScroll() {
    overlay.style.display = "none";
    quicklabel.style.display = "none";
    if (selected) boxTo(selbox, selected);
  }

  function onKeydown(e) {
    if (!active) return;
    if (e.key === "Escape") { deactivate(); return; }
    if (!selected) return;
    let next = null;
    if (e.key === "ArrowUp") next = selected.parentElement;
    else if (e.key === "ArrowDown") next = selected.firstElementChild;
    else if (e.key === "ArrowLeft") next = selected.previousElementSibling;
    else if (e.key === "ArrowRight") next = selected.nextElementSibling;
    else return;
    if (next && !isInsideOurUI(next)) {
      e.preventDefault();
      e.stopPropagation();
      if (next.scrollIntoView) next.scrollIntoView({ block: "nearest", inline: "nearest" });
      selectElement(next);
    }
  }

  function activate() {
    if (active) return;
    active = true;
    document.documentElement.appendChild(host);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeydown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll, true);
    if (hint) { hint.style.display = "block"; setTimeout(() => { if (hint) hint.style.display = "none"; }, 3500); }
  }

  function deactivate() {
    active = false;
    selected = null;
    lastHovered = null;
    clearFrameworkCache();
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeydown, true);
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onScroll, true);
    if (host.parentNode) host.parentNode.removeChild(host);
    panel.style.display = "none";
    overlay.style.display = "none";
    selbox.style.display = "none";
    quicklabel.style.display = "none";
  }

  window.__ntcToggle = () => (active ? deactivate() : activate());

  function onRuntimeMessage(message) {
    if (message && message.type === "NTC_TOGGLE_PICKER") window.__ntcToggle();
  }
  chrome.runtime.onMessage.addListener(onRuntimeMessage);

  // Allows a newer content.js to tear down this instance before replacing it.
  window.__ntcCleanup = () => {
    try { deactivate(); } catch (_) {}
    try { chrome.runtime.onMessage.removeListener(onRuntimeMessage); } catch (_) {}
    delete window.__ntcToggle;
    delete window.__ntcInjected;
    delete window.__ntcCleanup;
  };
})();
