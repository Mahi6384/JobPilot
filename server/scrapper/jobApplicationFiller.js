const { chromium } = require("playwright");

const fillJobApplication = async (page, userData) => {
  // Page is already passed in with cookies and navigated to job URL
  // No need to create browser or navigate

  try {
    // Wait for the page to load
    await page.waitForTimeout(2000);

    // Check if user is logged in (should be if cookies are valid)
    const loginRequired = await page.$(
      'input[type="email"], input[name="email"], #username'
    );

    if (loginRequired) {
      console.log("Login required. Session may have expired.");
      return {
        success: false,
        message: "Naukri session expired. Please reconnect.",
      };
    }

    // Look for "Apply" button and click it
    // Try multiple selectors for Apply button
    let applyButton = null;
    let applyClicked = false;

    try {
      applyButton = await page.locator('button:has-text("Apply")').first();
      if ((await applyButton.count()) > 0) {
        await applyButton.click();
        await page.waitForTimeout(2000);
        applyClicked = true;
      }
    } catch (e) {
      try {
        applyButton = await page.locator('a:has-text("Apply")').first();
        if ((await applyButton.count()) > 0) {
          await applyButton.click();
          await page.waitForTimeout(2000);
          applyClicked = true;
        }
      } catch (e2) {
        try {
          applyButton = await page.$(
            '.applyBtn, [data-testid="apply-button"], .apply-button'
          );
          if (applyButton) {
            await applyButton.click();
            await page.waitForTimeout(2000);
            applyClicked = true;
          }
        } catch (e3) {
          console.log("Apply button not found, continuing...");
        }
      }
    }

    if (!applyClicked) {
      // Try to find Easy Apply button
      try {
        const easyApplyButton = await page
          .locator('button:has-text("Easy Apply"), a:has-text("Easy Apply")')
          .first();
        if ((await easyApplyButton.count()) > 0) {
          await easyApplyButton.click();
          await page.waitForTimeout(2000);
          applyClicked = true;
        }
      } catch (e) {
        console.log("Easy Apply button not found");
      }
    }

    // Wait for form to be visible
    await page.waitForTimeout(2000);

    // Fill name - try multiple selectors
    if (userData.name) {
      try {
        const nameField = await page.$(
          'input[name="name"], input[id="name"], #name, input[placeholder*="Name" i]'
        );
        if (nameField) {
          await nameField.fill(userData.name);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("Name field not found or already filled");
      }
    }

    // Fill email - try multiple selectors
    if (userData.email) {
      try {
        const emailField = await page.$(
          'input[name="email"], input[type="email"]:not([name="username"]), #email, input[placeholder*="Email" i]'
        );
        if (emailField) {
          await emailField.fill(userData.email);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("Email field not found or already filled");
      }
    }

    // Fill phone - try multiple selectors
    if (userData.phone) {
      try {
        const phoneField = await page.$(
          'input[name="mobile"], input[name="phone"], input[type="tel"], #mobile, input[placeholder*="Phone" i], input[placeholder*="Mobile" i]'
        );
        if (phoneField) {
          await phoneField.fill(userData.phone);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("Phone field not found or already filled");
      }
    }

    // Fill experience if provided
    if (userData.experience) {
      try {
        const expField = await page.$(
          'input[name="experience"], input[name="exp"], select[name="experience"], select[name="exp"], input[placeholder*="Experience" i]'
        );
        if (expField) {
          await expField.fill(userData.experience);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("Experience field not found or already filled");
      }
    }

    // Fill expected CTC if provided
    if (userData.expectedCTC) {
      try {
        const ctcField = await page.$(
          'input[name="ctc"], input[name="expectedCTC"], input[name="salary"], input[placeholder*="CTC" i], input[placeholder*="Salary" i]'
        );
        if (ctcField) {
          await ctcField.fill(userData.expectedCTC);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("CTC field not found or already filled");
      }
    }

    // Upload resume if path is provided
    if (userData.resumePath) {
      try {
        const resumeInput = await page.$(
          'input[type="file"], input[name="resume"], input[accept*="pdf"], input[accept*="doc"]'
        );
        if (resumeInput) {
          await resumeInput.setInputFiles(userData.resumePath);
          await page.waitForTimeout(3000); // Wait longer for file upload
        }
      } catch (e) {
        console.log(
          "Resume upload field not found or file path invalid:",
          e.message
        );
      }
    }

    // Fill cover letter if provided
    if (userData.coverLetter) {
      try {
        const coverLetterField = await page.$(
          'textarea[name="coverLetter"], textarea[id="coverLetter"], textarea[placeholder*="cover" i], textarea[placeholder*="Cover" i], textarea[placeholder*="message" i]'
        );
        if (coverLetterField) {
          await coverLetterField.fill(userData.coverLetter);
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log("Cover letter field not found");
      }
    }

    // Wait a bit before submitting
    await page.waitForTimeout(2000);

    // Try to find and click submit button
    let submitted = false;
    try {
      const submitButton = await page.$(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Apply"), .submitBtn, [data-testid="submit-button"]'
      );
      if (submitButton) {
        const isVisible = await submitButton.isVisible();
        const isEnabled = await submitButton.isEnabled();

        if (isVisible && isEnabled) {
          await submitButton.click();
          await page.waitForTimeout(3000);
          submitted = true;
          console.log("Application submitted!");
        }
      }
    } catch (e) {
      console.log("Submit button not found or not clickable:", e.message);
    }

    // If auto-submit is not enabled, keep browser open for review
    if (!submitted) {
      console.log("Form filled. Review and submit manually.");
      // Keep browser open for review (60 seconds)
      await page.waitForTimeout(60000);
    } else {
      // Wait a bit to see if submission was successful
      await page.waitForTimeout(5000);

      // Check for success message
      try {
        const successMessage = await page.$(
          '.success, .success-message, [class*="success"], [class*="applied"]'
        );
        if (successMessage) {
          console.log("Application submitted successfully!");
        }
      } catch (e) {
        console.log("Could not verify submission status");
      }
    }

    // Note: Browser is closed by the caller (jobController)
    return {
      success: true,
      message: submitted
        ? "Application submitted successfully"
        : "Form filled successfully. Please review and submit manually.",
      submitted,
    };
  } catch (error) {
    console.error("Error filling application:", error);
    // Note: Browser is closed by the caller (jobController)
    return { success: false, message: error.message };
  }
};

module.exports = fillJobApplication;
