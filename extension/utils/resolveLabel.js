(function () {
  function _rectVisible(el) {
    try {
      const r = el.getBoundingClientRect();
      return r.width > 1 && r.height > 1;
    } catch {
      return false;
    }
  }

  /**
   * Latest bot bubble in the apply/chat surface (Naukri / campus variants).
   */
  function pickLastBotMsgText(field) {
    try {
      const root =
        field.closest("[class*='chatbot']") ||
        field.closest("[class*='ChatBot']") ||
        field.closest("[class*='apply-sidebar']") ||
        field.closest("[class*='applyModule']") ||
        field.closest("[class*='quickApply']") ||
        field.closest("[role='dialog']");
      if (!root) return "";
      const msgs = Array.from(
        root.querySelectorAll(
          ".botMsg, [class*='botMsg'], [class*='BotMsg'], [class*='bot-msg']"
        )
      );
      let last = "";
      for (const el of msgs) {
        if (!_rectVisible(el)) continue;
        const t = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (t.length >= 8) last = t;
      }
      return last ? last.slice(0, 900) : "";
    } catch {
      return "";
    }
  }

  /**
   * Naukri chatbot / drawer: the visible question sits in siblings above the
   * input row (e.g. div#…InputBox); placeholder is often "Type message here…".
   */
  function pickNearbyChatbotQuestion(field) {
    try {
      const inChat =
        field.closest("[class*='chatbot']") ||
        field.closest("[class*='ChatBot']") ||
        field.closest("[class*='apply-sidebar']") ||
        field.closest("[class*='applyModule']");
      if (!inChat) return "";

      const anchor =
        field.closest("[id*='InputBox']") ||
        field.closest("[id*='inputBox']") ||
        field.closest("[class*='InputBox']") ||
        field.closest("[class*='inputBox']") ||
        field.closest("[id*='sendMsgbtn']") ||
        field.closest("[class*='sendMsgbtn_container']") ||
        field.closest("[class*='sendMsgbtn']");
      const scanFrom = anchor || field.closest("[class*='send']") || field.parentElement;
      if (!scanFrom) return "";

      const lines = [];
      let el = scanFrom.previousElementSibling;
      for (let i = 0; el && i < 30; i++, el = el.previousElementSibling) {
        const tx = (el.textContent || "").replace(/\s+/g, " ").trim();
        if (tx.length > 12) lines.push(tx);
      }
      let blob = lines.join(" ").trim();
      if (blob.length > 15) return blob.slice(0, 900);

      let p = scanFrom.parentElement;
      for (let u = 0; u < 10 && p; u++, p = p.parentElement) {
        const prev = p.previousElementSibling;
        if (!prev) continue;
        const tx = (prev.textContent || "").replace(/\s+/g, " ").trim();
        if (
          tx.length > 20 &&
          /[?]|experience|salary|ctc|lpa|relocate|notice|year|travel|willing/i.test(
            tx
          )
        ) {
          return tx.slice(0, 900);
        }
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  function getFieldLabel(field) {
    if (!field) return "";

    const inChat =
      field.closest("[class*='chatbot']") ||
      field.closest("[class*='ChatBot']") ||
      field.closest("[class*='apply-sidebar']") ||
      field.closest("[class*='applyModule']") ||
      field.closest("[class*='quickApply']") ||
      field.closest("[role='dialog']");

    /** Chat inputs: do not let a generic aria-label hide the real screening question. */
    if (
      inChat &&
      (field.tagName === "INPUT" || field.tagName === "TEXTAREA")
    ) {
      const bot = pickLastBotMsgText(field);
      const near = pickNearbyChatbotQuestion(field);
      const merged = [bot, near].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (merged.length > 12) return merged.slice(0, 900);
    }

    const ariaLabel = field.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const root = field.getRootNode();

    const id = field.id;
    if (id && root.querySelector) {
      const esc =
        typeof CSS !== "undefined" && CSS.escape
          ? CSS.escape(id)
          : id.replace(/"/g, '\\"');
      const lbl = root.querySelector(`label[for="${esc}"]`);
      if (lbl) return lbl.textContent.trim();
    }

    const parent = field.closest("label");
    if (parent) return parent.textContent.trim();

    const wrapper =
      field.closest(".fb-dash-form-element") ||
      field.closest("[class*='form-component']") ||
      field.closest("[class*='form-element']") ||
      field.closest("[data-test-form-element]") ||
      field.closest("fieldset") ||
      field.closest("[class*='chatbot']") ||
      field.closest("[class*='applyModule']") ||
      field.closest("[class*='apply-sidebar']") ||
      field.closest("[class*='question']") ||
      field.closest(".form-group") ||
      field.closest("[class*='field']") ||
      field.closest(".artdeco-text-input") ||
      field.closest(".jobs-easy-apply-form-element");

    if (wrapper) {
      const lbl =
        wrapper.querySelector("label") ||
        wrapper.querySelector("legend") ||
        wrapper.querySelector("[class*='label']") ||
        wrapper.querySelector("[data-test-form-element-label]") ||
        wrapper.querySelector("h2, h3, h4");
      if (lbl) return lbl.textContent.trim();
    }

    const chatBlob = pickNearbyChatbotQuestion(field);
    if (chatBlob) return chatBlob;

    return (
      field.getAttribute("placeholder") ||
      field.getAttribute("name") ||
      ""
    ).trim();
  }

  globalThis.getFieldLabel = getFieldLabel;
})();
