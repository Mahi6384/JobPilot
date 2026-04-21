function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForElement(selector, timeoutMs = 10000, root = document) {
  return new Promise((resolve) => {
    const existing = root.querySelector(selector);
    if (existing) return resolve(existing);

    const deadline = Date.now() + timeoutMs;
    const interval = setInterval(() => {
      const el = root.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      } else if (Date.now() > deadline) {
        clearInterval(interval);
        resolve(null);
      }
    }, 300);
  });
}

function waitForAnyElement(selectors, timeoutMs = 10000) {
  return new Promise((resolve) => {
    for (const sel of selectors) {
      const existing = document.querySelector(sel);
      if (existing) return resolve(existing);
    }

    const deadline = Date.now() + timeoutMs;
    const interval = setInterval(() => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          clearInterval(interval);
          return resolve(el);
        }
      }
      if (Date.now() > deadline) {
        clearInterval(interval);
        resolve(null);
      }
    }, 300);
  });
}

function findButtonByText(text, root = document) {
  const candidates = root.querySelectorAll("button, a, [role='button']");
  const lower = text.toLowerCase();
  for (const btn of candidates) {
    const btnText = btn.textContent.trim().toLowerCase();
    if (btnText === lower || btnText.startsWith(lower + " ")) return btn;
  }
  return null;
}

function findButtonByAriaLabel(label, root = document) {
  return root.querySelector(`button[aria-label="${label}"]`);
}

function findClickableByText(text, root = document) {
  const lower = text.toLowerCase();
  const all = root.querySelectorAll(
    "button, a, [role='button'], input[type='submit'], input[type='button']",
  );

  for (const el of all) {
    const elText = (
      el.textContent ||
      el.getAttribute("value") ||
      el.getAttribute("aria-label") ||
      ""
    )
      .trim()
      .toLowerCase();
    if (elText === lower) return el;
  }

  for (const el of all) {
    const elText = (
      el.textContent ||
      el.getAttribute("value") ||
      el.getAttribute("aria-label") ||
      ""
    )
      .trim()
      .toLowerCase();
    if (elText.includes(lower)) return el;
  }
  return null;
}

function safeClick(el) {
  if (!el) return false;
  try {
    el.scrollIntoView({ block: "center", behavior: "instant" });
    if (el.tagName === "A") {
      el.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    } else {
      el.click();
    }
    return true;
  } catch {
    return false;
  }
}

function setNativeValue(el, value) {
  if (!el) return;

  // ── Step 1: write value via native prototype setter ─────────────────────────
  // This bypasses React's own setter wrapper so the internal "lastValue" tracker
  // sees the element as changed (otherwise React bails out of the onChange path).
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  const setter =
    el.tagName === "TEXTAREA"
      ? nativeTextAreaSetter
      : nativeInputSetter || nativeTextAreaSetter;

  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  // ── Step 2: fire events in real-user order ───────────────────────────────────
  // focus must come first — some React controlled inputs ignore events while blurred.
  try {
    el.focus();
  } catch {
    /* ignore */
  }
  el.dispatchEvent(new Event("focus", { bubbles: true }));

  // InputEvent (not generic Event) — React's InputEventPlugin hooks this specifically.
  // `data` carries the new string so React's nativeEvent.data path is satisfied.
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
    // Fallback for environments where InputEvent constructor is restricted
    el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));

  // ── Step 3: React fiber direct onChange call (hard fallback) ─────────────────
  // Walks the fiber tree attached to the DOM node and invokes onChange if found.
  // Handles cases where the delegated event still doesn't reach React's handler.
  try {
    const fiberKey = Object.keys(el).find(
      (k) =>
        k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"),
    );
    if (fiberKey) {
      let fiber = el[fiberKey];
      let iterations = 0;
      while (fiber && iterations++ < 30) {
        const onChange = fiber.memoizedProps?.onChange;
        if (typeof onChange === "function") {
          onChange({
            target: el,
            currentTarget: el,
            type: "change",
            bubbles: true,
            nativeEvent: { data: String(value) },
          });
          break;
        }
        fiber = fiber.return;
      }
    }
  } catch {
    /* fiber walk must never throw */
  }

  // ── Step 4: blur to trigger validation ──────────────────────────────────────
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function nudgeFormAfterFill(panel, pak) {
  const sel = "input:not([type='hidden']):not([type='file']), select, textarea";
  const els =
    pak && typeof pak.deepQuerySelectorAll === "function"
      ? pak.deepQuerySelectorAll(panel, sel)
      : Array.from((panel || document).querySelectorAll(sel));

  for (const el of els) {
    // Skip detached nodes — React may have unmounted them during re-render
    if (!el.isConnected) continue;
    // Skip elements that are not rendered (offsetParent is null for hidden elements)
    if (
      el.offsetParent === null &&
      el.type !== "radio" &&
      el.type !== "checkbox"
    )
      continue;

    try {
      el.dispatchEvent(
        new InputEvent("input", { bubbles: true, cancelable: true }),
      );
      el.dispatchEvent(new Event("change", { bubbles: true }));
      // Only blur if not currently focused — blurring the active element can
      // accidentally dismiss autocomplete dropdowns or clear selection state.
      if (document.activeElement !== el) {
        el.dispatchEvent(new Event("blur", { bubbles: true }));
      }
    } catch {
      /* ignore */
    }
  }
}

/* getFieldLabel is provided by utils/resolveLabel.js (injected before formFiller). */
