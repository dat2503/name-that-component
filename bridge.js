// MAIN-world bridge: reads React fiber / Vue / Angular / Astro from the page's
// own JS environment. Content scripts cannot see those expandos (isolated world),
// so detection must run here. Communicates via shared DOM attributes + a sync event.
(() => {
  const NTC_VERSION = "1.3.0";
  if (window.__ntcBridge === NTC_VERSION) return;
  if (typeof window.__ntcBridgeHandler === "function") {
    try {
      document.documentElement.removeEventListener(
        "ntc-fw-request",
        window.__ntcBridgeHandler,
        true
      );
    } catch (_) {}
  }
  window.__ntcBridge = NTC_VERSION;

  const FW_SKIP = new Set([
    "Fragment", "Suspense", "SuspenseList", "Provider", "Consumer",
    "Context", "StrictMode", "Profiler", "Portal", "ForwardRef", "Memo",
    "Anonymous", "Unknown"
  ]);

  function fileBase(p) {
    return String(p).split(/[\\/]/).pop().replace(/\.[a-z]+$/i, "");
  }

  function attr(el, name) {
    return el && el.getAttribute ? el.getAttribute(name) : null;
  }

  function titleCase(s) {
    if (!s) return s;
    return String(s)
      .replace(/[-_./]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .trim()
      .split(" ")
      .filter(Boolean)
      .map((w) => (w[0] ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  // A minifier turns component names into 1-2 char / lowercase garbage.
  // Accept only names that look like a real PascalCase component.
  function looksMeaningful(name) {
    if (!name || FW_SKIP.has(name)) return false;
    if (/^Styled/.test(name)) return false;
    if (/^[a-z]/.test(name)) return false;
    if (name.length < 3) return false;
    if (!/[a-z]/.test(name) && name.length <= 4) return false;
    return /^[A-Z]/.test(name);
  }

  // Vue/Angular dev names are reliable (absent, not garbled, when stripped).
  function isRealName(name) {
    return !!name && name.length >= 2 && /[a-zA-Z]/.test(name) && !FW_SKIP.has(name);
  }

  // Peel HOC wrappers from the outside in: Connect(withRouter(Foo)) -> Foo
  function unwrapComponentName(raw) {
    let name = String(raw || "");
    let m;
    let guard = 0;
    while ((m = name.match(/^[\w$.]+\((.+)\)$/)) && guard++ < 6) name = m[1];
    return name.trim();
  }

  function reactTypeName(t) {
    if (!t) return null;
    if (typeof t === "string") return null; // host component ("div", "span")
    if (typeof t === "function") return t.displayName || t.name || null;
    if (typeof t === "object") {
      return t.displayName ||
        (t.render && (t.render.displayName || t.render.name)) ||
        (t.type && (typeof t.type !== "string" ? (t.type.displayName || t.type.name) : null)) ||
        null;
    }
    return null;
  }

  function formatSource(src) {
    if (!src || !src.fileName) return null;
    let file = String(src.fileName);
    // Prefer path relative to project when webpack/vite prefixes are present
    const markers = ["/src/", "/app/", "/pages/", "/components/", "/lib/", "/features/"];
    for (const m of markers) {
      const i = file.replace(/\\/g, "/").lastIndexOf(m);
      if (i >= 0) {
        file = file.replace(/\\/g, "/").slice(i + 1);
        break;
      }
    }
    // Strip webpack/vite query suffixes: file.tsx?v=...
    file = file.split("?")[0];
    const line = src.lineNumber || src.line || null;
    return line ? `${file}:${line}` : file;
  }

  function fiberDebugSource(f) {
    if (!f) return null;
    if (f._debugSource) return formatSource(f._debugSource);
    // React 19+ sometimes only keeps source on the owner
    if (f._debugOwner && f._debugOwner._debugSource)
      return formatSource(f._debugOwner._debugSource);
    return null;
  }

  function getReactInfo(el) {
    try {
      let key = null;
      // Prefer own props (fiber keys); Object.keys can miss non-enumerable keys
      // on some builds, so also scan a few known prefixes via for-in.
      for (const k in el) {
        if (
          k.indexOf("__reactFiber$") === 0 ||
          k.indexOf("__reactInternalInstance$") === 0
        ) {
          key = k;
          break;
        }
      }
      if (!key) {
        for (const k of Object.keys(el)) {
          if (
            k.indexOf("__reactFiber$") === 0 ||
            k.indexOf("__reactInternalInstance$") === 0
          ) {
            key = k;
            break;
          }
        }
      }
      if (!key) return null;

      let f = el[key];
      let guard = 0;
      let primary = null;
      let source = null;
      const chain = [];
      while (f && guard++ < 100) {
        const clean = unwrapComponentName(reactTypeName(f.type || f.elementType));
        if (clean && looksMeaningful(clean)) {
          if (chain.length < 5) chain.push(clean);
          if (!primary) {
            primary = clean;
            source = fiberDebugSource(f);
          }
        } else if (!source) {
          source = fiberDebugSource(f);
        }
        f = f.return;
      }
      if (primary) {
        return {
          framework: "React",
          componentName: primary,
          humanized: titleCase(primary),
          chain,
          source,
          minified: false,
          matchedOn: "React fiber"
        };
      }
      return {
        framework: "React",
        componentName: null,
        chain: [],
        source,
        minified: true,
        matchedOn: "React fiber (names minified in this build)"
      };
    } catch (e) {
      return null;
    }
  }

  function getVueInfo(el) {
    try {
      let node = el;
      let guard = 0;
      while (node && guard++ < 40) {
        const inst = node.__vueParentComponent; // Vue 3
        if (inst) {
          let cur = inst;
          let g2 = 0;
          let primary = null;
          let source = null;
          const chain = [];
          while (cur && g2++ < 40) {
            const t = cur.type || {};
            const name = t.name || t.__name || (t.__file && fileBase(t.__file));
            if (isRealName(name)) {
              if (chain.length < 5) chain.push(name);
              if (!primary) {
                primary = name;
                if (t.__file) source = t.__file.split("?")[0];
              }
            } else if (!source && t.__file) {
              source = t.__file.split("?")[0];
            }
            cur = cur.parent;
          }
          if (primary) {
            return {
              framework: "Vue 3",
              componentName: primary,
              humanized: titleCase(primary),
              chain,
              source,
              minified: false,
              matchedOn: "Vue instance"
            };
          }
          return {
            framework: "Vue 3",
            componentName: null,
            chain: [],
            source,
            minified: true,
            matchedOn: "Vue instance (anonymous components)"
          };
        }
        const vm = node.__vue__; // Vue 2
        if (vm) {
          let cur = vm;
          let g2 = 0;
          let primary = null;
          let source = null;
          const chain = [];
          while (cur && g2++ < 40) {
            const o = cur.$options || {};
            const name = o.name || o._componentTag || (o.__file && fileBase(o.__file));
            if (isRealName(name)) {
              if (chain.length < 5) chain.push(name);
              if (!primary) {
                primary = name;
                if (o.__file) source = o.__file.split("?")[0];
              }
            } else if (!source && o.__file) {
              source = o.__file.split("?")[0];
            }
            cur = cur.$parent;
          }
          if (primary) {
            return {
              framework: "Vue 2",
              componentName: primary,
              humanized: titleCase(primary),
              chain,
              source,
              minified: false,
              matchedOn: "Vue instance"
            };
          }
          return {
            framework: "Vue 2",
            componentName: null,
            chain: [],
            source,
            minified: true,
            matchedOn: "Vue instance (anonymous)"
          };
        }
        node = node.parentElement;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function getAngularInfo(el) {
    try {
      if (!window.ng || typeof window.ng.getComponent !== "function") return null;
      let node = el;
      let guard = 0;
      while (node && guard++ < 40) {
        let comp = null;
        try {
          comp = window.ng.getComponent(node);
        } catch (_) {}
        if (comp && comp.constructor) {
          const name = comp.constructor.name;
          if (looksMeaningful(name)) {
            return {
              framework: "Angular",
              componentName: name,
              humanized: titleCase(name),
              chain: [name],
              minified: false,
              matchedOn: "ng.getComponent()"
            };
          }
          return {
            framework: "Angular",
            componentName: null,
            chain: [],
            minified: true,
            matchedOn: "Angular (component names minified)"
          };
        }
        node = node.parentElement;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function astroIslandName(island) {
    const exp = attr(island, "component-export");
    if (exp && exp !== "default" && /^[A-Za-z_$]/.test(exp)) return exp;
    const url = attr(island, "component-url") || "";
    let base = url.split(/[?#]/)[0].split("/").pop() || "";
    base = base.replace(/\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro)$/i, "");
    base = base.replace(/\.([A-Za-z0-9_-]{6,})$/, (m, h) =>
      /[0-9]/.test(h) || (/[a-z]/.test(h) && /[A-Z]/.test(h)) ? "" : m
    );
    if (
      base &&
      /[A-Za-z]/.test(base) &&
      !/^(index|client|entry|chunk|app|main|hoisted)$/i.test(base)
    ) {
      return base;
    }
    return null;
  }

  function getAstroInfo(el) {
    try {
      let node = el;
      let guard = 0;
      while (node && guard++ < 40) {
        if (node.tagName && node.tagName.toLowerCase() === "astro-island") {
          const name = astroIslandName(node);
          const client = attr(node, "client");
          const detail = client ? `client:${client}` : "island";
          if (name) {
            return {
              framework: "Astro island",
              componentName: name,
              humanized: titleCase(name),
              chain: [name],
              minified: false,
              detail,
              matchedOn: "<astro-island>"
            };
          }
          return {
            framework: "Astro island",
            componentName: null,
            chain: [],
            presenceOnly: true,
            detail,
            matchedOn: "<astro-island>"
          };
        }
        node = node.parentElement;
      }
      node = el;
      guard = 0;
      while (node && guard++ < 4) {
        if (node.attributes) {
          for (const a of node.attributes) {
            if (a.name.indexOf("data-astro-cid") === 0) {
              return {
                framework: "Astro",
                componentName: null,
                chain: [],
                presenceOnly: true,
                detail: "scoped .astro component",
                matchedOn: a.name
              };
            }
          }
        }
        node = node.parentElement;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  let _presence;
  function frameworkPresence() {
    if (_presence !== undefined) return _presence;
    let p = null;
    try {
      if (window.__NUXT__ || window.__VUE__ || document.querySelector("[data-v-app]")) p = "Vue";
      else if (window.ng || document.querySelector("[ng-version]")) p = "Angular";
      else if (document.querySelector("astro-island")) p = "Astro";
      else if (
        document.querySelector("#__next, [data-reactroot], [data-react-helmet]") ||
        window.React ||
        window.__NEXT_DATA__
      ) {
        p = "React";
      } else if (document.querySelector('[class*="svelte-"]')) p = "Svelte";
      else if (window.preact) p = "Preact";
    } catch (e) {}
    _presence = p;
    return p;
  }

  function getFramework(el) {
    if (!el || el.nodeType !== 1) return null;
    const r = getReactInfo(el);
    if (r) return r;
    const v = getVueInfo(el);
    if (v) return v;
    const a = getAngularInfo(el);
    if (a) return a;
    const isl = getAstroInfo(el);
    if (isl) return isl;
    const p = frameworkPresence();
    if (p) return { framework: p, componentName: null, presenceOnly: true, chain: [] };
    return null;
  }

  // Content script marks the target with data-ntc-el, then dispatches this
  // event. We run synchronously, write JSON into data-ntc-fw (shared across
  // isolated worlds via the DOM), then the content script reads it.
  function onFwRequest() {
    try {
      const probeId = document.documentElement.getAttribute("data-ntc-probe-id");
      if (!probeId) {
        document.documentElement.setAttribute("data-ntc-fw", "");
        return;
      }
      // probeId is always "ntc" + digits from the content script
      const el = document.querySelector(`[data-ntc-el="${probeId}"]`);
      if (!el) {
        document.documentElement.setAttribute("data-ntc-fw", "");
        return;
      }
      const info = getFramework(el);
      document.documentElement.setAttribute(
        "data-ntc-fw",
        info ? JSON.stringify(info) : ""
      );
    } catch (e) {
      try {
        document.documentElement.setAttribute("data-ntc-fw", "");
      } catch (_) {}
    }
  }

  window.__ntcBridgeHandler = onFwRequest;
  document.documentElement.addEventListener("ntc-fw-request", onFwRequest, true);
})();
