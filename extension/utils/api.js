// API wrapper for calling JobPilot backend

const API_BASE = "http://localhost:5000/api";

// Main fetch wrapper - adds auth header automatically
async function apiCall(endpoint, options = {}) {
  const result = await chrome.storage.local.get("authToken");
  const token = result.authToken;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API call failed");
  }

  return data;
}

// Get queued applications
async function getQueuedApplications() {
  return apiCall("/applications?status=queued");
}

// Update application status
async function updateApplicationStatus(id, status, errorMessage = null) {
  return apiCall(`/applications/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, errorMessage }),
  });
}
