let _extensionId = null;
let _connected = false;
const _listeners = new Set();
const _pending = new Map();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (
    event.data?.type === "JOBPILOT_EXTENSION_READY" ||
    event.data?.type === "JOBPILOT_EXTENSION_HEARTBEAT"
  ) {
    const wasConnected = _connected;
    _extensionId = event.data.extensionId;
    _connected = true;
    localStorage.setItem("jobpilot_extension_id", _extensionId);
    if (!wasConnected) _notify();
  }

  if (event.data?.type === "JOBPILOT_RESPONSE") {
    const req = _pending.get(event.data.requestId);
    if (req) {
      _pending.delete(event.data.requestId);
      clearTimeout(req.timer);
      if (event.data.error) {
        req.reject(new Error(event.data.error));
      } else {
        req.resolve(event.data.data);
      }
    }
  }
});

function _notify() {
  _listeners.forEach((fn) => {
    try {
      fn(_connected);
    } catch {}
  });
}

export function isExtensionConnected() {
  return _connected;
}

export function getExtensionId() {
  return _extensionId;
}

export function onConnectionChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function sendToExtension(payload) {
  return new Promise((resolve, reject) => {
    if (!_connected) {
      reject(new Error("Extension not connected"));
      return;
    }
    const requestId = crypto.randomUUID();
    const timer = setTimeout(() => {
      _pending.delete(requestId);
      reject(new Error("Extension response timeout"));
    }, 5000);
    _pending.set(requestId, { resolve, reject, timer });
    window.postMessage(
      { type: "JOBPILOT_REQUEST", requestId, payload },
      window.location.origin
    );
  });
}

export async function pingExtension() {
  try {
    return await sendToExtension({ action: "ping" });
  } catch {
    return null;
  }
}

export async function triggerApply() {
  try {
    return await sendToExtension({ action: "startApplying" });
  } catch {
    return null;
  }
}

export async function getExtensionStatus() {
  try {
    return await sendToExtension({ action: "getStatus" });
  } catch {
    return null;
  }
}
