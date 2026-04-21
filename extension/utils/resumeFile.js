(function () {
  function setFileInputFromBase64(input, base64, fileName) {
    if (!input || input.type !== "file" || !base64) return false;
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const file = new File([blob], fileName || "resume.pdf", {
        type: "application/pdf",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (e) {
      console.warn("[JobPilot][resumeFile] setFileInputFromBase64 failed", e);
      return false;
    }
  }

  function queryFileInputsDeep(panel) {
    if (
      typeof PanelKernel !== "undefined" &&
      PanelKernel.deepQuerySelectorAll
    ) {
      return PanelKernel.deepQuerySelectorAll(panel, "input[type='file']");
    }
    return Array.from(panel.querySelectorAll("input[type='file']"));
  }

  /**
   * Pick the best resume/CV file input in the panel.
   */
  function findResumeFileInput(panel, getFieldLabelFn) {
    const inputs = queryFileInputsDeep(panel);
    if (inputs.length === 0) return null;
    if (inputs.length === 1) return inputs[0];

    const getLabel =
      typeof getFieldLabelFn === "function"
        ? getFieldLabelFn
        : (el) =>
            el.getAttribute("aria-label") ||
            el.getAttribute("name") ||
            el.id ||
            "";

    let best = null;
    let bestScore = -1;
    for (const input of inputs) {
      const label = (getLabel(input) || "").toLowerCase();
      const accept = (input.getAttribute("accept") || "").toLowerCase();
      let score = 0;
      if (/resume|cv|curriculum|attachment|upload/.test(label)) score += 10;
      if (accept.includes("pdf")) score += 5;
      if (accept.includes("doc")) score += 2;
      if (score > bestScore) {
        bestScore = score;
        best = input;
      }
    }
    return best || inputs[0];
  }

  globalThis.JobPilotResumeFile = {
    setFileInputFromBase64,
    findResumeFileInput,
    queryFileInputsDeep,
  };
})();
