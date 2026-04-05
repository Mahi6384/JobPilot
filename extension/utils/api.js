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

async function getCurrentApiBase() {
  const result = await chrome.storage.local.get("jpConfig");
  const mode = result.jpConfig?.apiMode || "prod";
  return API_URLS[mode] || API_URLS.prod;
}
