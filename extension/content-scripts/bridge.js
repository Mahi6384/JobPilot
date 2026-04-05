(() => {
  const EXT_ID = chrome.runtime.id;

  window.postMessage(
    { type: "JOBPILOT_EXTENSION_READY", extensionId: EXT_ID },
    window.location.origin
  );

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== "JOBPILOT_REQUEST") return;

    const { requestId, payload } = event.data;

    chrome.runtime.sendMessage(payload, (response) => {
      window.postMessage(
        {
          type: "JOBPILOT_RESPONSE",
          requestId,
          data: response || null,
          error: chrome.runtime.lastError?.message || null,
        },
        window.location.origin
      );
    });
  });

  setInterval(() => {
    window.postMessage(
      { type: "JOBPILOT_EXTENSION_HEARTBEAT", extensionId: EXT_ID },
      window.location.origin
    );
  }, 10000);
})();
