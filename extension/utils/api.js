const API_URLS = {
  prod: "https://jobpilot-production-3ba1.up.railway.app/api",
  dev: "http://localhost:5000/api",
};

async function apiCall(endpoint, options = {}) {
  const [cfgResult, tokenResult] = await Promise.all([
    chrome.storage.local.get("jpConfig"),
    chrome.storage.local.get("authToken"),
  ]);

  const mode = cfgResult.jpConfig?.apiMode || "prod";
  const base = API_URLS[mode] || API_URLS.prod;
  const token = tokenResult.authToken;

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `API ${response.status}`);
  return data;
}

async function getQueuedApplications() {
  return apiCall("/applications?status=queued&limit=50");
}

async function updateApplicationStatus(id, status, errorMessage, reason) {
  return apiCall(`/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      errorMessage: errorMessage || null,
      reason: reason || null,
      source: "extension",
    }),
  });
}

async function getResumeDataFromApi() {
  return apiCall("/onboarding/resume-data");
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Fetches the stored PDF (Bearer auth). Returns null if none. Used by background for Naukri upload. */
async function getResumeFileAsBase64() {
  const [cfgResult, tokenResult] = await Promise.all([
    chrome.storage.local.get("jpConfig"),
    chrome.storage.local.get("authToken"),
  ]);
  const mode = cfgResult.jpConfig?.apiMode || "prod";
  const base = API_URLS[mode] || API_URLS.prod;
  const token = tokenResult.authToken;
  if (!token) return null;

  const response = await fetch(`${base}/onboarding/resume-file`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Resume file ${response.status}`);
  }

  const buf = await response.arrayBuffer();
  if (buf.byteLength > 4.5 * 1024 * 1024) {
    throw new Error("Resume file too large for extension message");
  }
  return {
    fileName: "resume.pdf",
    base64: arrayBufferToBase64(buf),
  };
}

async function getCurrentApiBase() {
  const result = await chrome.storage.local.get("jpConfig");
  const mode = result.jpConfig?.apiMode || "prod";
  return API_URLS[mode] || API_URLS.prod;
}
