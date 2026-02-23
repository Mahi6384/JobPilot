// DOM elements
const loginView = document.getElementById("loginView");
const connectedView = document.getElementById("connectedView");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const errorMsg = document.getElementById("errorMsg");
const userName = document.getElementById("userName");
const queueCount = document.getElementById("queueCount");
const startBtn = document.getElementById("startBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Listen for progress updates from background worker
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "progress") {
    queueCount.textContent =
      message.current > 0
        ? `⏳ ${message.current}/${message.total} - ${message.message}`
        : message.message;
  }
});

// Start Applying button click
startBtn.addEventListener("click", async () => {
  startBtn.textContent = "Applying...";
  startBtn.disabled = true;

  // Send message to background worker to start processing
  chrome.runtime.sendMessage({ action: "startApplying" }, (response) => {
    logger.info("Background responded:", response);
  });
});

// On popup open - check if already logged in
document.addEventListener("DOMContentLoaded", async () => {
  const token = await getAuthToken();
  if (token) {
    await showConnectedView();
  }
});

// Login button click
loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError("Please enter email and password");
    return;
  }

  try {
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;

    // Call your existing login endpoint
    // We use fetch directly here because we don't have a token yet
    const response = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    // Save token and user profile
    await setAuthToken(data.token);
    await setUserProfile(data.user);

    logger.info("Logged in as:", data.user.email);
    await showConnectedView();
  } catch (error) {
    showError(error.message);
    logger.error("Login failed:", error.message);
  } finally {
    loginBtn.textContent = "Login";
    loginBtn.disabled = false;
  }
});

// Logout button click
logoutBtn.addEventListener("click", async () => {
  await clearStorage();
  connectedView.classList.add("hidden");
  loginView.classList.remove("hidden");
  emailInput.value = "";
  passwordInput.value = "";
  logger.info("Logged out");
});

// Show connected view with user info
async function showConnectedView() {
  const profile = await getUserProfile();
  userName.textContent = profile?.email || "User";

  loginView.classList.add("hidden");
  connectedView.classList.remove("hidden");

  await loadQueueCount();
}

// Fetch and show queue count
async function loadQueueCount() {
  try {
    const data = await getQueuedApplications();
    const count = data.data ? data.data.length : 0;
    queueCount.textContent =
      count > 0 ? `📋 ${count} jobs in queue` : "No jobs in queue";
  } catch (error) {
    queueCount.textContent = "Could not load queue";
    logger.error("Failed to load queue:", error.message);
  }
}

// Show error message
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 3000);
}
