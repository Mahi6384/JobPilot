/**
 * Panel Automation Kernel — shared logic for apply drawers/modals (Naukri, future sites).
 * Depends: delay() from dom.js
 */
(function () {
  console.log("[JobPilot][Kernel] panelKernel.js evaluating…");
  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      const win = el.ownerDocument?.defaultView || window;
      const style = win.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (Number(style.opacity) === 0) return false;
    } catch {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /** Top-level comma split for selector lists (respects (), []). */
  function splitSelectorList(selector) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (let i = 0; i < selector.length; i++) {
      const c = selector[i];
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") depth = Math.max(0, depth - 1);
      else if (c === "," && depth === 0) {
        if (cur.trim()) out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.length ? out : [selector];
  }

  function deepQuerySelectorAllSingle(root, singleSelector) {
    const results = [];
    const MAX_NODES = 20000;
    let visited = 0;

    function walk(node) {
      if (!node || visited++ > MAX_NODES) return;
      if (node.nodeType === 1) {
        try {
          if (node.matches(singleSelector)) results.push(node);
        } catch {
          /* invalid selector */
        }
        for (const c of node.children) walk(c);
        if (node.shadowRoot) walk(node.shadowRoot);
      }
    }

    walk(root);
    return results;
  }

  /**
   * Walks light DOM + open shadow roots; supports comma-separated selector lists.
   */
  function deepQuerySelectorAll(root, selector) {
    const seen = new Set();
    for (const part of splitSelectorList(selector)) {
      for (const el of deepQuerySelectorAllSingle(root, part)) {
        seen.add(el);
      }
    }
    return Array.from(seen);
  }

  function querySelectorDeepFirst(root, selector) {
    const all = deepQuerySelectorAll(root, selector);
    return all[0] || null;
  }

  function getShadowRootForHost(hostSelector) {
    try {
      const host = document.querySelector(hostSelector);
      return host?.shadowRoot || null;
    } catch {
      return null;
    }
  }

  /**
   * Query selector inside hint shadow hosts first, then document.
   */
  function queryWithShadowHints(selector, shadowHostSelectors) {
    for (const hostSel of shadowHostSelectors || []) {
      const sr = getShadowRootForHost(hostSel);
      if (sr) {
        try {
          const hit = sr.querySelector(selector);
          if (hit) return hit;
        } catch {
          /* ignore */
        }
      }
    }
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function scorePanelCandidate(el, hints) {
    if (!el || !isVisible(el)) return -Infinity;
    let s = 0;
    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 5000) s += 5;
    if (area < 800) s -= 15;

    const inputs = deepQuerySelectorAll(
      el,
      "input:not([type='hidden']):not([type='file']), select, textarea"
    ).filter(isVisible);
    s += Math.min(inputs.length * 4, 28);

    const role = el.getAttribute && el.getAttribute("role");
    if (role === "dialog" || role === "complementary") s += 12;
    if (el.getAttribute("aria-modal") === "true") s += 8;

    const t = (el.textContent || "").toLowerCase();
    for (const a of hints.textAnchors || []) {
      if (a && t.includes(String(a).toLowerCase())) s += 10;
    }

    const z = window.getComputedStyle(el).zIndex;
    if (z && z !== "auto" && Number(z) > 100) s += 5;

    return s;
  }

  function collectCandidates(hints) {
    const seen = new Set();
    const list = [];

    const push = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      list.push(el);
    };

    for (const hostSel of hints.shadowHosts || []) {
      const sr = getShadowRootForHost(hostSel);
      if (!sr) continue;
      for (const sel of hints.rootSelectors || []) {
        try {
          sr.querySelectorAll(sel).forEach(push);
        } catch {
          /* ignore */
        }
      }
    }

    for (const sel of hints.rootSelectors || []) {
      try {
        document.querySelectorAll(sel).forEach(push);
      } catch {
        /* ignore */
      }
    }

    for (const role of hints.dialogRoles || ["dialog"]) {
      try {
        document.querySelectorAll(`[role="${role}"]`).forEach(push);
      } catch {
        /* ignore */
      }
    }

    return list;
  }

  /**
   * Best-scoring visible apply panel root.
   */
  function findApplySurfaceRoot(hints) {
    if (!hints) return null;
    const candidates = collectCandidates(hints);
    let best = null;
    let bestScore = -Infinity;
    for (const el of candidates) {
      const sc = scorePanelCandidate(el, hints);
      if (sc > bestScore) {
        bestScore = sc;
        best = el;
      }
    }
    if (best && bestScore >= (hints.minScore ?? 8)) return best;

    for (const el of candidates) {
      const sc = scorePanelCandidate(el, hints);
      if (sc > bestScore) {
        bestScore = sc;
        best = el;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function waitForMutationStability(root, quietMs, maxWaitMs) {
    return new Promise((resolve) => {
      if (!root) {
        resolve();
        return;
      }
      let timer = null;
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        obs.disconnect();
        clearTimeout(maxTimer);
        if (timer) clearTimeout(timer);
        resolve();
      };

      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(finish, quietMs);
      };

      const obs = new MutationObserver(() => schedule());
      try {
        obs.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: true,
        });
      } catch {
        finish();
        return;
      }

      schedule();

      const maxTimer = setTimeout(finish, maxWaitMs);
    });
  }

  /**
   * waitForPanelContent — waits until the apply panel has at least one
   * interactive or question element visible inside it.
   *
   * Naukri mounts the drawer skeleton immediately (so rootSelectors match)
   * but streams question content asynchronously via React state updates.
   * Without this gate, waitForApplySurface resolves on an empty shell and
   * the fill step finds zero fields.
   *
   * @param {Element} panel — the resolved apply surface root
   * @param {number}  maxMs — maximum wait in milliseconds (default 5000)
   */
  function waitForPanelContent(panel, maxMs) {
    const timeout = maxMs != null ? maxMs : 5000;
    const CONTENT_SEL = [
      "input:not([type='hidden']):not([type='file'])",
      "select",
      "textarea",
      ".botMsg",
      "[class*='botMsg']",
      "[role='radio']",
      "div.sendMsg",
      "[class*='sendMsg']",
    ].join(", ");

    return new Promise((resolve) => {
      const check = () => {
        if (!panel || !panel.isConnected) return false;
        const hits = deepQuerySelectorAll(panel, CONTENT_SEL).filter(isVisible);
        return hits.length > 0;
      };

      // Already has content — resolve immediately
      if (check()) { resolve(); return; }

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        obs.disconnect();
        clearTimeout(maxTimer);
        resolve();
      };

      const obs = new MutationObserver(() => {
        if (check()) finish();
      });

      try {
        obs.observe(panel, { childList: true, subtree: true, attributes: true });
      } catch {
        finish();
        return;
      }

      const maxTimer = setTimeout(finish, timeout);
    });
  }

  /**
   * Wait until findRoot() returns non-null, then optional stability on that root.
   */
  function waitForApplySurface(hints, options) {
    const timeoutMs = options?.timeoutMs ?? 15000;
    const stabilityQuietMs = options?.stabilityQuietMs ?? 280;
    const stabilityMaxMs = options?.stabilityMaxMs ?? 6000;
    const skipStability = options?.skipStability === true;

    return new Promise((resolve) => {
      const tryOnce = async () => {
        const el = findApplySurfaceRoot(hints);
        if (!el) return null;
        if (!skipStability) {
          await waitForMutationStability(
            el,
            stabilityQuietMs,
            stabilityMaxMs
          );
          // Wait for panel to have actual interactive content, not just the shell.
          // Naukri streams question content asynchronously after mounting the drawer.
          await waitForPanelContent(el, 5000);
        }
        return findApplySurfaceRoot(hints) || el;
      };

      tryOnce().then((first) => {
        if (first) {
          resolve(first);
          return;
        }

        let settled = false;
        const finish = (el) => {
          if (settled) return;
          settled = true;
          obs.disconnect();
          clearInterval(poller);
          clearTimeout(timer);
          resolve(el);
        };

        const check = async () => {
          const el = await tryOnce();
          if (el) finish(el);
        };

        const obs = new MutationObserver(() => {
          check();
        });
        obs.observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "style", "role", "aria-hidden", "hidden"],
        });

        for (const hostSel of hints.shadowHosts || []) {
          const sr = getShadowRootForHost(hostSel);
          if (sr) {
            obs.observe(sr, {
              childList: true,
              subtree: true,
              attributes: true,
            });
          }
        }

        const poller = setInterval(check, 400);
        const timer = setTimeout(() => finish(null), timeoutMs);
        check();
      });
    });
  }

  globalThis.PanelKernel = {
    deepQuerySelectorAll,
    querySelectorDeepFirst,
    findApplySurfaceRoot,
    waitForApplySurface,
    waitForMutationStability,
    waitForPanelContent,
    isVisible,
    getShadowRootForHost,
  };
  try {
    if (typeof window !== "undefined") {
      window.PanelKernel = globalThis.PanelKernel;
    }
  } catch {
    /* ignore */
  }
  console.log(
    "[JobPilot][Kernel] Loaded — typeof globalThis.PanelKernel:",
    typeof globalThis.PanelKernel
  );
})();
