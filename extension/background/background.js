// Load utility scripts
importScripts("../utils/storage.js", "../utils/api.js", "../utils/logger.js");

logger.info("Background service worker started");

// Track current state
let isApplying = false;
let currentJobIndex = 0;
let totalJobs = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "startApplying") {
    startApplicationProcess();
    sendResponse({ status: "started" });
  }

  if (message.action === "getStatus") {
    sendResponse({
      isApplying,
      currentJobIndex,
      totalJobs,
    });
  }

  // Return true to indicate we'll respond asynchronously
  return true;
});

// Main application process
async function startApplicationProcess() {
  if (isApplying) {
    logger.warn("Already applying, ignoring duplicate request");
    return;
  }

  isApplying = true;
  currentJobIndex = 0;

  try {
    // 1. Fetch queued applications from backend
    logger.info("Fetching queued applications...");
    const data = await getQueuedApplications();
    const applications = data.data || [];

    if (applications.length === 0) {
      logger.info("No queued applications found");
      sendProgressToPopup("No jobs in queue", 0, 0);
      isApplying = false;
      return;
    }

    totalJobs = applications.length;
    logger.info(`Found ${totalJobs} queued applications`);

    // 2. Process each job one by one
    for (let i = 0; i < applications.length; i++) {
      currentJobIndex = i + 1;
      const app = applications[i];
      const jobTitle = app.jobId?.title || "Unknown Job";
      const jobUrl = app.jobId?.applicationUrl;

      logger.info(`Processing ${currentJobIndex}/${totalJobs}: ${jobTitle}`);
      sendProgressToPopup(
        `Applying to: ${jobTitle}`,
        currentJobIndex,
        totalJobs,
      );

      if (!jobUrl) {
        logger.error(`No URL for job: ${jobTitle}`);
        await updateApplicationStatus(app._id, "failed", "No application URL");
        continue;
      }

      try {
        await processJob(app, jobUrl);
      } catch (error) {
        logger.error(`Failed to process: ${jobTitle}`, error.message);
        await updateApplicationStatus(app._id, "failed", error.message);
      }
    }

    logger.info("All jobs processed!");
    sendProgressToPopup("Done! All jobs processed", totalJobs, totalJobs);
  } catch (error) {
    logger.error("Application process failed:", error.message);
    sendProgressToPopup("Error: " + error.message, 0, 0);
  } finally {
    isApplying = false;
  }
}

// Process a single job - open tab, wait, close
async function processJob(application, jobUrl) {
  // 1. Update status to in_progress
  await updateApplicationStatus(application._id, "in_progress");

  // 2. Open job URL in a new tab
  const tab = await chrome.tabs.create({
    url: jobUrl,
    active: false, // Don't switch to the tab, keep working in background
  });

  logger.info(`Opened tab ${tab.id} for: ${jobUrl}`);

  // 3. Wait for tab to fully load
  await waitForTabLoad(tab.id);
  logger.info(`Tab ${tab.id} loaded`);

  // 4. Wait 3 seconds (placeholder for content script interaction)
  // In Step 6, we'll inject content scripts here instead of just waiting
  await delay(3000);

  // 5. For now, mark as "review_needed" since we're not auto-filling yet
  await updateApplicationStatus(application._id, "review_needed");
  logger.info(`Marked as review_needed: ${application.jobId?.title}`);

  // 6. Close the tab
  await chrome.tabs.remove(tab.id);
  logger.info(`Closed tab ${tab.id}`);

  // 7. Small delay between jobs to not overwhelm the browser
  await delay(1000);
}

// Wait for a tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Tab load timeout"));
    }, 15000); // 15 second timeout

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Send progress update to popup
function sendProgressToPopup(message, current, total) {
  chrome.runtime
    .sendMessage({
      type: "progress",
      message,
      current,
      total,
    })
    .catch(() => {
      // Popup might be closed, that's fine
    });
}

// Promise-based delay
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
