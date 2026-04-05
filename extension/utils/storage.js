async function setAuthToken(token) {
  await chrome.storage.local.set({ authToken: token });
}

async function getAuthToken() {
  const result = await chrome.storage.local.get("authToken");
  return result.authToken || null;
}

async function setUserProfile(profile) {
  await chrome.storage.local.set({ userProfile: profile });
}

async function getUserProfile() {
  const result = await chrome.storage.local.get("userProfile");
  return result.userProfile || null;
}

async function setStoredResumeData(data) {
  await chrome.storage.local.set({ resumeData: data });
}

async function getStoredResumeData() {
  const result = await chrome.storage.local.get("resumeData");
  return result.resumeData || null;
}

async function setConfig(key, value) {
  const result = await chrome.storage.local.get("jpConfig");
  const config = result.jpConfig || {};
  config[key] = value;
  await chrome.storage.local.set({ jpConfig: config });
}

async function getConfig(key) {
  const result = await chrome.storage.local.get("jpConfig");
  return result.jpConfig?.[key] ?? null;
}

async function clearStorage() {
  await chrome.storage.local.clear();
}
