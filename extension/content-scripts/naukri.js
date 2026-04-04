// Naukri.com Content Script
// This script is injected into Naukri job pages by the background worker
// It finds the Apply button, clicks it, handles questionnaires, and reports back

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

// Main function: find Apply button, click it, handle questionnaire
async function applyToJob() {
  // Step 1: Check if already applied
  const alreadyApplied = document.querySelector(
    ".styles_already-applied__MMRPM, .already-applied",
  );
  if (alreadyApplied) {
    return { success: true, message: "Already applied" };
  }

  // Step 2: Find the Apply button
  const applyBtn =
    document.getElementById("apply-button") ||
    document.querySelector(".apply-button") ||
    findButtonByText("Apply");

  if (!applyBtn) {
    return {
      success: false,
      error: "No Apply button found (likely external application)",
    };
  }

  // Step 3: Click Apply
  applyBtn.click();

  // Step 4: Wait a moment for the response
  await delay(2000);

  // Step 5: Check if applied immediately (no questionnaire)
  if (checkIfApplied()) {
    return { success: true, message: "Applied instantly" };
  }

  // Step 6: Questionnaire appeared - handle it
  const questionResult = await handleQuestionnaire();
  return questionResult;
}

// Handle the chatbot-style questionnaire
async function handleQuestionnaire() {
  const maxAttempts = 10; // Max questions to handle

  for (let i = 0; i < maxAttempts; i++) {
    await delay(1000);

    // Check if we're done (applied successfully)
    if (checkIfApplied()) {
      return { success: true, message: "Applied after answering questions" };
    }

    // Look for "Skip this question" button/link
    const skipBtn =
      findButtonByText("Skip this question") ||
      findButtonByText("Skip") ||
      document.querySelector("[class*='skip']");

    if (skipBtn) {
      skipBtn.click();
      await delay(1000);
      continue;
    }

    // Look for Save button to submit
    const saveBtn =
      document.querySelector("[class*='save-job-button']") ||
      findButtonByText("Save") ||
      findButtonByText("Submit");

    if (saveBtn) {
      saveBtn.click();
      await delay(2000);

      if (checkIfApplied()) {
        return { success: true, message: "Applied after saving" };
      }
      return { success: true, message: "Clicked save, assuming applied" };
    }

    // If neither skip nor save found, check for input fields
    const inputField = document.querySelector(
      "[class*='chatbot'] input, [class*='question'] input",
    );
    if (inputField) {
      // For number questions (CTC, experience), fill with "0"
      inputField.value = "0";
      inputField.dispatchEvent(new Event("input", { bubbles: true }));
      inputField.dispatchEvent(new Event("change", { bubbles: true }));

      // Look for a next/submit button after filling
      await delay(500);
      const nextBtn =
        findButtonByText("Save") ||
        findButtonByText("Next") ||
        findButtonByText("Submit");
      if (nextBtn) {
        nextBtn.click();
      }
      await delay(1000);
      continue;
    }

  }

  return { success: false, error: "Could not complete questionnaire" };
}

// Check various signals that application was submitted
function checkIfApplied() {
  // Look for success indicators
  const successTexts = [
    "applied",
    "application sent",
    "successfully applied",
    "already applied",
  ];

  const bodyText = document.body.innerText.toLowerCase();
  for (const text of successTexts) {
    // Check if the text appears in a recent/visible element (not in some hidden footer)
    const elements = document.querySelectorAll(
      "[class*='applied'], [class*='success'], [class*='chatbot'] *",
    );
    for (const el of elements) {
      if (el.innerText?.toLowerCase().includes(text)) {
        return true;
      }
    }
  }

  // Check if Apply button changed to "Applied"
  const applyBtn = document.getElementById("apply-button");
  if (applyBtn && applyBtn.textContent.toLowerCase().includes("applied")) {
    return true;
  }

  return false;
}

// Helper: find a button or link by its visible text
function findButtonByText(text) {
  const allButtons = document.querySelectorAll("button, a, [role='button']");
  for (const btn of allButtons) {
    if (btn.textContent.trim().toLowerCase() === text.toLowerCase()) {
      return btn;
    }
  }
  return null;
}

// Promise-based delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
