(function () {
  const PAK = () => globalThis.PanelKernel;

  function deepAll(root, sel) {
    const p = PAK();
    if (p && typeof p.deepQuerySelectorAll === "function") {
      return p.deepQuerySelectorAll(root, sel);
    }
    return Array.from(root.querySelectorAll(sel));
  }

  function isVisible(el) {
    const p = PAK();
    if (p && typeof p.isVisible === "function") return p.isVisible(el);
    if (!el || el.nodeType !== 1) return false;
    try {
      const st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return false;
      if (Number(st.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch {
      return false;
    }
  }

  function normQuestion(s) {
    return String(s || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .slice(0, 240);
  }

  function fingerprintFor(botMsgEl) {
    const t = normQuestion(botMsgEl && (botMsgEl.textContent || ""));
    if (!t) return "";
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return `${t.length}:${h}`;
  }

  /** Document order sort for elements in the same root. */
  function sortDocOrder(a, b) {
    const p = a.compareDocumentPosition(b);
    if (p & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (p & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  }

  function visibleBotMsgs(panel) {
    const hits = deepAll(panel, ".botMsg");
    const out = [];
    for (const el of hits) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length < 3) continue;
      out.push(el);
    }
    out.sort(sortDocOrder);
    return out;
  }

  /** True if `el` is strictly after `anchor` in document order (not inside anchor). */
  function isAfterInTree(anchor, el) {
    if (!anchor || !el) return false;
    if (anchor === el) return false;
    if (anchor.contains(el)) return false;
    const pos = anchor.compareDocumentPosition(el);
    return Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function collectCandidatesAfter(panel, anchor) {
    const sel =
      "input:not([type='hidden']):not([type='file']):not([type='checkbox']), textarea, input[type='radio'], [role='radio'], [contenteditable='true']";
    const all = deepAll(panel, sel);
    const out = [];
    for (const el of all) {
      if (!isVisible(el)) continue;
      if (el.type === "hidden") continue;
      if (anchor && !isAfterInTree(anchor, el)) continue;
      try {
        if (el.closest(".botMsg")) continue;
      } catch {
        /* ignore */
      }
      out.push(el);
    }
    /** Naukri sometimes renders the composer *above* the latest bubble in DOM order; use layout. */
    if (anchor && out.length === 0) {
      let anchorBottom = 0;
      try {
        anchorBottom = anchor.getBoundingClientRect().bottom;
      } catch {
        anchorBottom = 0;
      }
      for (const el of all) {
        if (!isVisible(el)) continue;
        if (el.type === "hidden") continue;
        try {
          if (el.closest(".botMsg")) continue;
        } catch {
          /* ignore */
        }
        try {
          const top = el.getBoundingClientRect().top;
          if (anchorBottom > 0 && top + 2 < anchorBottom) continue;
        } catch {
          continue;
        }
        out.push(el);
      }
    }
    return out;
  }

  function groupRadiosNative(candidates) {
    const byName = new Map();
    for (const el of candidates) {
      if (el.tagName !== "INPUT" || el.type !== "radio") continue;
      const name = el.getAttribute("name") || "__noname__";
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(el);
    }
    const groups = [];
    for (const [, arr] of byName) {
      if (!arr.length) continue;
      if (arr.every((r) => r.checked)) continue;
      groups.push({ kind: "radio-native", elements: arr });
    }
    return groups;
  }

  function findRoleRadios(candidates) {
    const roles = [];
    for (const el of candidates) {
      if (el.getAttribute && el.getAttribute("role") === "radio")
        roles.push(el);
    }
    if (!roles.length) return null;
    /** Group by closest radiogroup or name or shared parent row */
    const buckets = new Map();
    for (const r of roles) {
      const rg = r.closest("[role='radiogroup']") || r.parentElement || r;
      const key = rg;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }
    let best = null;
    for (const arr of buckets.values()) {
      if (!best || arr.length > best.length) best = arr;
    }
    return best && best.length
      ? { kind: "radio-custom", elements: best }
      : null;
  }

  function pickTextLike(candidates) {
    const textish = [];
    for (const el of candidates) {
      if (el.tagName === "TEXTAREA") {
        textish.push({ kind: "textarea", el });
        continue;
      }
      if (el.tagName === "INPUT") {
        const t = (el.type || "text").toLowerCase();
        if (t === "radio" || t === "checkbox" || t === "file" || t === "hidden")
          continue;
        textish.push({ kind: "text", el });
        continue;
      }
      // Naukri campus chatbot uses <div contenteditable="true"> as the composer
      if (el.isContentEditable) {
        textish.push({ kind: "contenteditable", el });
      }
    }
    if (!textish.length) return null;
    textish.sort((a, b) => sortDocOrder(a.el, b.el));
    return textish[0];
  }

  function chooseControlSet(candidates) {
    const natives = groupRadiosNative(candidates);
    if (natives.length === 1) return natives[0];
    if (natives.length > 1) {
      natives.sort((a, b) => sortDocOrder(a.elements[0], b.elements[0]));
      return natives[natives.length - 1];
    }
    const custom = findRoleRadios(candidates);
    if (custom) return custom;
    return pickTextLike(candidates);
  }

  function firePointerClick(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    } catch {
      /* ignore */
    }
    try {
      el.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
      el.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          composed: true,
        }),
      );
    } catch {
      /* PointerEvent may be missing in very old engines */
    }
    try {
      el.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      el.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    } catch {
      /* ignore */
    }
    try {
      el.click();
    } catch {
      /* ignore */
    }
  }

  function roleRadioLooksSelected(el) {
    try {
      if (el.getAttribute("aria-checked") === "true") return true;
      if (
        el.classList &&
        /\bselected\b|\bactive\b|\bchecked\b/i.test(el.className)
      )
        return true;
    } catch {
      /* ignore */
    }
    return false;
  }

  function fillCustomRadioGroup(elements, hooks) {
    const arr = Array.from(elements || []);
    if (!arr.length) return false;
    if (arr.some(roleRadioLooksSelected)) return false;
    const first = arr[0];
    if (hooks && typeof hooks.onMatch === "function") {
      try {
        hooks.onMatch({
          kind: "radio-custom",
          field: first,
          label: "role=radio",
          key: "radio_custom",
          value: "(first visible)",
        });
      } catch {
        /* ignore */
      }
    }

    // Use the wrapper-aware click helper from formFiller.js.
    // The actual clickable element is the option container, not the role=radio
    // element itself (which may be the inner circle/dot span).
    if (
      typeof _getRadioClickTarget === "function" &&
      typeof _fireFullClick === "function"
    ) {
      const target = _getRadioClickTarget(first);
      _fireFullClick(target);
    } else {
      // Fallback if formFiller helpers not available
      firePointerClick(first);
    }

    if (hooks && typeof hooks.onFill === "function") {
      try {
        hooks.onFill({
          kind: "radio-custom",
          field: first,
          key: "radio_custom",
          value: true,
        });
      } catch {
        /* ignore */
      }
    }
    return true;
  }

  /**
   * @param {Element} panel
   * @param {object} resumeData
   * @param {object|null} hooks
   * @param {{ fp?: string }} state — mutate .fp last answered fingerprint
   * @returns {number} number of discrete actions (0 or 1)
   */
  function tryFillNaukriChatTurn(panel, resumeData, hooks, state) {
    if (!panel) return 0;
    const msgs = visibleBotMsgs(panel);
    if (!msgs.length) return 0;
    const lastMsg = msgs[msgs.length - 1];
    const fp = fingerprintFor(lastMsg);
    if (!fp) return 0;

    const qText = (lastMsg.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);
    const candidates = collectCandidatesAfter(panel, lastMsg);
    if (!candidates.length) return 0;

    const set = chooseControlSet(candidates);
    if (!set) return 0;

    if (state && state.fp === fp) {
      const anyStillEmpty = () => {
        if (set.kind === "radio-native") {
          return set.elements.some((r) => !r.checked);
        }
        if (set.kind === "radio-custom") {
          return !set.elements.some(roleRadioLooksSelected);
        }
        const el = set.el;
        return !String(el.value || "").trim();
      };
      if (!anyStillEmpty()) return 0;
    }

    const combinedLabel = `${qText}\n${typeof getFieldLabel === "function" ? getFieldLabel(set.elements ? set.elements[0] : set.el) : ""}`;

    if (set.kind === "radio-native") {
      const ok = fillRadioGroup(set.elements, hooks);
      if (ok && state) state.fp = fp;
      return ok ? 1 : 0;
    }
    if (set.kind === "radio-custom") {
      const ok = fillCustomRadioGroup(set.elements, hooks);
      if (ok && state) state.fp = fp;
      return ok ? 1 : 0;
    }
    if (set.kind === "textarea" || set.kind === "text") {
      const ok = fillTextField(set.el, resumeData, hooks, combinedLabel);
      if (ok && state) state.fp = fp;
      return ok ? 1 : 0;
    }
    if (set.kind === "contenteditable") {
      const ok = _fillContentEditable(set.el, resumeData, combinedLabel, hooks);
      if (ok && state) state.fp = fp;
      return ok ? 1 : 0;
    }
    return 0;
  }

  /**
   * Fill a contenteditable div (Naukri campus chatbot composer).
   * Uses execCommand('insertText') — the only method that fires the browser's
   * native beforeinput+input pipeline that React's SyntheticEvent hooks into.
   */
  function _fillContentEditable(el, resumeData, labelHint, hooks) {
    if (!el || !el.isConnected) return false;
    // Skip if already has content
    if ((el.textContent || "").trim()) return false;

    // Resolve value using the question label
    let value = null;
    if (
      typeof matchFieldToKey === "function" &&
      typeof resolveValue === "function"
    ) {
      const mapped = matchFieldToKey(labelHint || "");
      if (mapped) value = resolveValue(mapped.key, resumeData, mapped.fallback);
      if (!value && typeof inferGenericTextAnswer === "function") {
        const inf = inferGenericTextAnswer(labelHint || "", resumeData);
        if (inf && inf.value) value = String(inf.value);
      }
    }
    // Hard fallbacks for common questions
    if (!value) {
      const q = (labelHint || "").toLowerCase();
      if (/ctc|salary|lpa|lacs?|lakhs?|compensation|package/i.test(q)) {
        const raw =
          (resumeData &&
            (resumeData.currentCtc || resumeData.expectedSalary)) ||
          "";
        value = String(raw).replace(/[^\d.]/g, "") || "8";
      } else if (/notice|serving|joining/i.test(q)) {
        value = (resumeData && resumeData.noticePeriod) || "30";
      } else if (/experience|years/i.test(q)) {
        value = String(resumeData?.experience?.years ?? "2");
      } else if (/relocat|travel|willing/i.test(q)) {
        value = "Yes";
      }
    }
    if (!value) return false;

    try {
      el.scrollIntoView({ block: "center", behavior: "instant" });
    } catch {}
    try {
      el.focus();
    } catch {}

    // Clear
    el.textContent = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));

    // execCommand is the only reliable method for contenteditable + React
    let filled = false;
    try {
      el.focus();
      document.execCommand("selectAll", false, null);
      filled = document.execCommand("insertText", false, String(value));
    } catch {}

    if (!filled || !(el.textContent || "").trim()) {
      // Fallback: direct textContent + InputEvent
      el.textContent = String(value);
      try {
        el.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            cancelable: true,
            composed: true,
            data: String(value),
            inputType: "insertText",
          }),
        );
      } catch {
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));

    if (hooks && typeof hooks.onFill === "function") {
      try {
        hooks.onFill({
          kind: "contenteditable",
          field: el,
          key: "ce_fill",
          value: String(value),
        });
      } catch {}
    }
    console.log(
      "[JobPilot][Naukri][Fill] contenteditable filled:",
      String(value).slice(0, 60),
    );
    return true;
  }

  globalThis.tryFillNaukriChatTurn = tryFillNaukriChatTurn;
})();
