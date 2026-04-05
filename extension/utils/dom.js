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
    "button, a, [role='button'], input[type='submit'], input[type='button']"
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
        new MouseEvent("click", { bubbles: true, cancelable: true })
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
  const proto = Object.getPrototypeOf(el);
  const setter =
    Object.getOwnPropertyDescriptor(proto, "value")?.set ||
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set ||
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")
      ?.set;

  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function getFieldLabel(field) {
  const ariaLabel = field.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  const id = field.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent.trim();
  }

  const parent = field.closest("label");
  if (parent) return parent.textContent.trim();

  const wrapper =
    field.closest(".form-group") ||
    field.closest("[class*='field']") ||
    field.closest("[class*='question']") ||
    field.closest("[class*='form-component']") ||
    field.closest(".artdeco-text-input") ||
    field.closest(".fb-dash-form-element") ||
    field.closest(".jobs-easy-apply-form-element") ||
    field.closest("[data-test-form-element]");
  if (wrapper) {
    const lbl =
      wrapper.querySelector("label") ||
      wrapper.querySelector("[class*='label']") ||
      wrapper.querySelector("legend") ||
      wrapper.querySelector("span") ||
      wrapper.querySelector("[data-test-form-element-label]");
    if (lbl) return lbl.textContent.trim();
  }

  return (
    field.getAttribute("placeholder") ||
    field.getAttribute("name") ||
    ""
  );
}
