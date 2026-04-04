// LinkedIn Easy Apply Content Script
// Injected into LinkedIn job pages by the background worker
// Finds the Easy Apply button, clicks it, handles the modal, and reports back

// Listen for messages from background worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "applyToJob") {
    applyToJob()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }));

    // Return true = we'll respond asynchronously
    return true;
  }
});

// Main function: find Easy Apply button, click it, handle modal
async function applyToJob() {
  // Step 1: Check if already applied
  if (checkIfAlreadyApplied()) {
    return { success: true, message: "Already applied" };
  }

  // Step 2: Find the Easy Apply button
  const easyApplyBtn = findEasyApplyButton();
  if (!easyApplyBtn) {
    return {
      success: false,
      error: "No Easy Apply button found (might be external application)",
    };
  }

  // Step 3: Click Easy Apply
  // LinkedIn renders Easy Apply as an <a> tag — use dispatchEvent to trigger
  // LinkedIn's JS handler without letting the browser navigate away from the page.
  const isAnchor = easyApplyBtn.tagName === "A";
  if (isAnchor) {
    easyApplyBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  } else {
    easyApplyBtn.click();
  }

  // Step 4: Wait for modal to appear (give LinkedIn extra time to render)
  await delay(3000);

  // Step 5: Check if modal appeared
  const modal = findEasyApplyModal();
  if (!modal) {
    // Sometimes clicking Easy Apply applies instantly (1-click apply)
    if (checkIfAlreadyApplied()) {
      return { success: true, message: "Applied instantly" };
    }
    return { success: false, error: "Easy Apply modal did not appear" };
  }

  // Step 6: Handle the multi-step modal
  const result = await handleEasyApplyModal(modal);
  return result;
}

// Handle LinkedIn Easy Apply multi-step modal
async function handleEasyApplyModal() {
  const maxSteps = 8; // LinkedIn Easy Apply typically has 1-4 steps

  for (let step = 0; step < maxSteps; step++) {
    await delay(1500);

    // Check if we're done (success message appeared)
    if (checkIfApplicationSubmitted()) {
      return { success: true, message: "Applied via Easy Apply modal" };
    }

    // Check if the modal closed (might mean success)
    if (!findEasyApplyModal()) {
      if (checkIfAlreadyApplied()) {
        return { success: true, message: "Applied (modal closed)" };
      }
      return {
        success: false,
        error: "Modal closed unexpectedly",
      };
    }

    // Look for Submit button first (final step)
    const submitBtn = findButtonByAriaLabel("Submit application");
    if (submitBtn) {
      submitBtn.click();
      await delay(3000);

      if (checkIfApplicationSubmitted() || checkIfAlreadyApplied()) {
        // Close any post-submit dialog
        dismissPostSubmitDialog();
        return { success: true, message: "Application submitted" };
      }
      return {
        success: true,
        message: "Clicked submit, assuming applied",
      };
    }

    // Look for Review button (second-to-last step)
    const reviewBtn = findButtonByAriaLabel("Review your application");
    if (reviewBtn) {
      reviewBtn.click();
      await delay(1500);
      continue;
    }

    // Look for Next button (intermediate steps)
    const nextBtn = findButtonByAriaLabel("Continue to next step");
    if (nextBtn) {
      // Check for required unfilled fields before clicking Next
      const hasRequiredUnfilled = checkForRequiredFields();
      if (hasRequiredUnfilled) {
        return {
          success: false,
          error: "Review needed: has required questions",
        };
      }

      nextBtn.click();
      await delay(1500);
      continue;
    }

    // No actionable button found — try fallback controls

    // Try to find any button that might advance the form
    const fallbackBtn =
      findButtonByText("Next") ||
      findButtonByText("Review") ||
      findButtonByText("Submit application") ||
      findButtonByText("Submit");

    if (fallbackBtn) {
      fallbackBtn.click();
      await delay(1500);
      continue;
    }

  }

  return { success: false, error: "Could not complete Easy Apply modal" };
}

// --- Helper Functions ---

function findEasyApplyButton() {
  // Method 1: aria-label (most reliable — LinkedIn uses this on both <button> and <a> tags)
  const byAriaLabel = document.querySelector(
    '[aria-label*="Easy Apply" i], [aria-label*="EasyApply" i]'
  );
  if (byAriaLabel) return byAriaLabel;

  // Method 2: Search both buttons AND anchor tags (LinkedIn renders Easy Apply as <a> tag)
  const allClickables = document.querySelectorAll("button, a, [role='button']");
  for (const el of allClickables) {
    // Skip nav/header elements
    if (el.closest("header, nav, #global-nav")) continue;
    const text = el.textContent.trim().toLowerCase();
    if (text === "easy apply" || text.startsWith("easy apply ")) {
      return el;
    }
  }

  return null;
}

function findEasyApplyModal() {
  return (
    document.querySelector(".jobs-easy-apply-modal") ||
    document.querySelector(
      '.artdeco-modal[role="dialog"][aria-labelledby*="easy-apply"]',
    ) ||
    document.querySelector('.artdeco-modal[role="dialog"]')
  );
}

function findButtonByAriaLabel(label) {
  return document.querySelector(`button[aria-label="${label}"]`);
}

function findButtonByText(text) {
  const allButtons = document.querySelectorAll("button");
  for (const btn of allButtons) {
    if (btn.textContent.trim().toLowerCase() === text.toLowerCase()) {
      return btn;
    }
  }
  return null;
}

function checkIfAlreadyApplied() {
  // Check all visible elements for "Applied" state indicators
  const allElements = document.querySelectorAll(
    ".artdeco-inline-feedback, [class*='applied'], [class*='success'], [class*='confirmation']",
  );
  for (const el of allElements) {
    const text = el.textContent.toLowerCase();
    if (
      text.includes("application submitted") ||
      text.includes("already applied") ||
      text.includes("your application was sent")
    ) {
      return true;
    }
  }

  // Check if the apply button / link text changed to "Applied"
  const applyEl = findEasyApplyButton();
  if (applyEl && applyEl.textContent.trim().toLowerCase() === "applied") {
    return true;
  }

  // Check page text for confirmation
  const pageText = document.body?.innerText?.toLowerCase() || "";
  if (
    pageText.includes("application submitted") ||
    pageText.includes("your application was sent")
  ) {
    return true;
  }

  return false;
}

function checkIfApplicationSubmitted() {
  // LinkedIn shows a success screen after submission
  const successElements = document.querySelectorAll(
    ".artdeco-inline-feedback--success, .jpac-modal-confirm, [class*='post-apply'], [data-test-modal-close-btn]",
  );

  for (const el of successElements) {
    if (el.closest(".artdeco-modal") || el.closest("[role='dialog']")) {
      return true;
    }
  }

  // Check for success text
  const modals = document.querySelectorAll(
    ".artdeco-modal, [role='dialog']",
  );
  for (const modal of modals) {
    const text = modal.textContent.toLowerCase();
    if (
      text.includes("application submitted") ||
      text.includes("application was sent") ||
      text.includes("your application has been submitted")
    ) {
      return true;
    }
  }

  return false;
}

function checkForRequiredFields() {
  // Look for required fields that are empty in the current modal
  const modal = findEasyApplyModal();
  if (!modal) return false;

  const requiredInputs = modal.querySelectorAll(
    "input[required], select[required], textarea[required]",
  );
  for (const input of requiredInputs) {
    if (!input.value || input.value.trim() === "") {
      // Check if it's a field we can't auto-fill (not name/email/phone)
      const label =
        input.getAttribute("aria-label") ||
        input.closest("label")?.textContent ||
        "";
      const autoFillable = ["name", "email", "phone", "mobile"].some((f) =>
        label.toLowerCase().includes(f),
      );
      if (!autoFillable) {
        return true; // Required field we can't handle
      }
    }
  }

  return false;
}

function dismissPostSubmitDialog() {
  // After successful submit, LinkedIn might show a "Follow company?" dialog
  setTimeout(() => {
    const dismissBtn = document.querySelector(
      'button[aria-label="Dismiss"], [data-test-modal-close-btn]',
    );
    if (dismissBtn) {
      dismissBtn.click();
    }
  }, 1000);
}

// Promise-based delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
