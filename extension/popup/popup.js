const loginView = document.getElementById("loginView");
const dashView = document.getElementById("dashView");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const loginBtn = document.getElementById("loginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const errorMsg = document.getElementById("errorMsg");
const userName = document.getElementById("userName");
const queueLabel = document.getElementById("queueLabel");
const currentJobCard = document.getElementById("currentJobCard");
const currentJobTitle = document.getElementById("currentJobTitle");
const statApplied = document.getElementById("statApplied");
const statFailed = document.getElementById("statFailed");
const statSkipped = document.getElementById("statSkipped");
const autoBadge = document.getElementById("autoBadge");
const devToggle = document.getElementById("devToggle");
const autofillDebugToggle = document.getElementById("autofillDebugToggle");
const logoutBtn = document.getElementById("logoutBtn");
const extId = document.getElementById("extId");
const autofillBtn = document.getElementById("autofillBtn");
const completeProfileBtn = document.getElementById("completeProfileBtn");

let pollTimer = null;

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  extId.textContent = `ID: ${chrome.runtime.id}`;

  const mode = await getConfig("apiMode");
  if (mode === "dev") devToggle.classList.add("active");

  const autofillDbg = await getConfig("autofillDebug");
  if (autofillDbg) autofillDebugToggle?.classList.add("active");

  const token = await getAuthToken();
  if (token) {
    showDashboard();
  }
});

// ── Login ────────────────────────────────────────────────────────────────────

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showError("Enter email and password");
    return;
  }

  try {
    loginBtn.textContent = "Logging in...";
    loginBtn.disabled = true;

    const data = await apiCall("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    await setAuthToken(data.token);
    await setUserProfile(data.user);

    showDashboard();
  } catch (err) {
    showError(err.message);
  } finally {
    loginBtn.textContent = "Login";
    loginBtn.disabled = false;
  }
});

// ── Google Login ──────────────────────────────────────────────────────────────

googleLoginBtn.addEventListener("click", async () => {
  try {
    googleLoginBtn.textContent = "Opening Google...";
    googleLoginBtn.disabled = true;
    errorMsg.classList.add("hidden");

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "googleLogin" }, resolve);
    });

    if (!result) throw new Error("Google login failed");
    if (result.error) throw new Error(result.error);

    await setAuthToken(result.token);
    await setUserProfile(result.user);

    showDashboard();
  } catch (err) {
    showError(err.message);
  } finally {
    googleLoginBtn.textContent = "Continue with Google";
    googleLoginBtn.disabled = false;
  }
});

// ── Logout ───────────────────────────────────────────────────────────────────

logoutBtn.addEventListener("click", async () => {
  stopPolling();
  chrome.runtime.sendMessage({ action: "googleLogout" }, () => {});
  await clearStorage();
  dashView.classList.add("hidden");
  loginView.classList.remove("hidden");
  emailInput.value = "";
  passwordInput.value = "";
});

// ── Manual Autofill ───────────────────────────────────────────────────────────

autofillBtn?.addEventListener("click", async () => {
  try {
    autofillBtn.disabled = true;
    const prev = autofillBtn.textContent;
    autofillBtn.textContent = "Autofilling...";

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "autofillCurrentTab" }, resolve);
    });

    if (!result) throw new Error("No response from background worker");
    if (result.error) throw new Error(result.error);

    autofillBtn.textContent =
      typeof result.filled === "number"
        ? `Autofill complete (${result.filled})`
        : "Autofill complete";

    setTimeout(() => {
      autofillBtn.textContent = prev;
      autofillBtn.disabled = false;
    }, 1800);
  } catch (err) {
    showError(err.message || String(err));
    autofillBtn.textContent = "Autofill this page";
    autofillBtn.disabled = false;
  }
});

completeProfileBtn?.addEventListener("click", async () => {
  try {
    const url = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getProfileUrl" }, resolve);
    });
    const target = url?.url;
    if (!target) throw new Error("Could not build profile URL");
    chrome.tabs.create({ url: target });
  } catch (err) {
    showError(err.message || String(err));
  }
});

// ── Dev Mode Toggle ──────────────────────────────────────────────────────────

devToggle.addEventListener("click", async () => {
  const currentMode = await getConfig("apiMode");
  const newMode = currentMode === "dev" ? "prod" : "dev";
  await setConfig("apiMode", newMode);
  devToggle.classList.toggle("active", newMode === "dev");
});

autofillDebugToggle?.addEventListener("click", async () => {
  const on = await getConfig("autofillDebug");
  const next = !on;
  await setConfig("autofillDebug", next);
  autofillDebugToggle.classList.toggle("active", next);
});

// ── Dashboard ────────────────────────────────────────────────────────────────

async function showDashboard() {
  const profile = await getUserProfile();
  userName.textContent = profile?.fullName || profile?.email || "User";
  loginView.classList.add("hidden");
  dashView.classList.remove("hidden");

  refreshStatus();
  startPolling();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(refreshStatus, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshStatus() {
  try {
    const status = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "getStatus" }, resolve);
    });

    if (!status) return;

    if (status.processing) {
      autoBadge.textContent = "RUNNING";
      autoBadge.className = "badge-auto";

      queueLabel.textContent = `Processing ${status.queueSize} job(s)...`;

      if (status.currentJob) {
        currentJobCard.classList.remove("hidden");
        currentJobTitle.textContent = status.currentJob.title;
      } else {
        currentJobCard.classList.add("hidden");
      }
    } else {
      autoBadge.textContent = "AUTO";
      autoBadge.className = "badge-auto";
      currentJobCard.classList.add("hidden");

      if (status.queueSize > 0) {
        queueLabel.textContent = `${status.queueSize} jobs in queue`;
      } else {
        queueLabel.textContent = "No jobs in queue — watching for new jobs";
      }
    }

    statApplied.textContent = status.processed || 0;
    statFailed.textContent = status.failed || 0;
    statSkipped.textContent = status.skipped || 0;

    if (status.lastError) {
      queueLabel.textContent += ` (last error: ${status.lastError})`;
    }
  } catch {
    queueLabel.textContent = "Could not reach background worker";
  }
}

// ── Background progress messages ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "progress") {
    if (message.current > 0 && message.total > 0) {
      queueLabel.textContent = `${message.current}/${message.total} — ${message.message}`;
    } else {
      queueLabel.textContent = message.message;
    }
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
  setTimeout(() => errorMsg.classList.add("hidden"), 4000);
}
