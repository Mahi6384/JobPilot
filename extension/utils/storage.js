async function setAuthToken(token) {
  await chrome.storage.local.set({ authToken: token });
}

// Get auth token
async function getAuthToken() {
  const result = await chrome.storage.local.get("authToken");
  return result.authToken || null;
}

// Save user profile
async function setUserProfile(profile) {
  await chrome.storage.local.set({ userProfile: profile });
}

// Get user profile
async function getUserProfile() {
  const result = await chrome.storage.local.get("userProfile");
  return result.userProfile || null;
}

// Clear everything (logout)
async function clearStorage() {
  await chrome.storage.local.clear();
}
