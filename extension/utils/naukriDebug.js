// /**
//  * Naukri sidebar / apply flow — DEBUG utilities (overlay, structured logs, manual run).
//  * Toggle: localStorage jobpilot_naukri_debug = "1" | "0", or window.jobpilotDebug.enable()
//  * Injected before content-scripts/naukri.js
//  */
// (function () {
//   const LS_DEBUG = "jobpilot_naukri_debug";
//   const LS_MANUAL = "jobpilot_naukri_debug_manual";

//   const P = {
//     detect: "[JobPilot][Naukri][Detect]",
//     fields: "[JobPilot][Naukri][Fields]",
//     fill: "[JobPilot][Naukri][Fill]",
//     action: "[JobPilot][Naukri][Action]",
//     retry: "[JobPilot][Naukri][Retry]",
//     error: "[JobPilot][Naukri][Error]",
//   };

//   let _manualMode = null;
//   let _deferredRunner = null;
//   let _deferredSendResponse = null;
//   let _abortRequested = false;
//   /** Resolves when user calls jobpilotDebug.run() / Start Autofill while paused at sidebar. */
//   let _sidebarGateResolve = null;
//   let _overlayMounted = false;
//   const BANNER_ID = "jobpilot-naukri-debug-banner";
//   let _statusText = "Idle";
//   let _fieldsCount = "—";
//   let _highlightTimers = new WeakMap();

//   function _readLs(key) {
//     try {
//       return localStorage.getItem(key);
//     } catch {
//       return null;
//     }
//   }

//   function _writeLs(key, val) {
//     try {
//       localStorage.setItem(key, val);
//     } catch {
//       /* ignore */
//     }
//   }

//   function isEnabled() {
//     return _readLs(LS_DEBUG) === "1";
//   }

//   function isManualMode() {
//     if (_manualMode !== null) return _manualMode;
//     const m = _readLs(LS_MANUAL);
//     if (m === "0") return false;
//     if (m === "1") return true;
//     return isEnabled();
//   }

//   function log(channel, ...args) {
//     if (!isEnabled()) return;
//     const prefix = P[channel] || "[JobPilot][Naukri][Debug]";
//     console.log(prefix, ...args);
//   }

//   function logError(where, err) {
//     const msg = err && err.message ? err.message : String(err);
//     if (isEnabled()) {
//       console.error(P.error, where, msg, err && err.stack ? err.stack : "");
//     } else {
//       console.error("[JobPilot][Naukri]", where, msg);
//     }
//   }

//   function setManualMode(on) {
//     _manualMode = on === true;
//     _writeLs(LS_MANUAL, _manualMode ? "1" : "0");
//     log("action", "manual mode", _manualMode ? "ON" : "OFF");
//     _refreshOverlay();
//   }

//   function shouldDeferApply() {
//     return isEnabled() && isManualMode();
//   }

//   function deferApply(runner, sendResponse) {
//     _deferredRunner = runner;
//     _deferredSendResponse = sendResponse;
//     _abortRequested = false;
//     log("action", "Apply flow deferred — call jobpilotDebug.run() or click [Start Autofill]");
//     setOverlayStatus("Queued (manual)", "—");
//     _ensureOverlay();
//     _refreshOverlay();
//     showPauseBanner("Apply queued — use Start Autofill or jobpilotDebug.run()");
//   }

//   function clearDeferred() {
//     _deferredRunner = null;
//     _deferredSendResponse = null;
//   }

//   function showPauseBanner(subtitle) {
//     if (!isEnabled()) return;
//     hidePauseBanner();
//     const b = document.createElement("div");
//     b.id = BANNER_ID;
//     b.setAttribute("data-jobpilot-debug-banner", "1");
//     Object.assign(b.style, {
//       position: "fixed",
//       top: "0",
//       left: "0",
//       right: "0",
//       zIndex: "2147483647",
//       background: "#ca8a04",
//       color: "#1c1917",
//       fontFamily: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
//       fontSize: "13px",
//       fontWeight: "600",
//       padding: "10px 16px",
//       textAlign: "center",
//       boxShadow: "0 2px 8px rgba(0,0,0,.2)",
//     });
//     const main = document.createElement("div");
//     main.textContent = "DEBUG MODE ACTIVE — Automation Paused";
//     b.appendChild(main);
//     if (subtitle) {
//       const s = document.createElement("div");
//       s.style.cssText =
//         "font-weight:400;font-size:12px;margin-top:4px;opacity:.95;";
//       s.textContent = subtitle;
//       b.appendChild(s);
//     }
//     (document.body || document.documentElement).appendChild(b);
//   }

//   function hidePauseBanner() {
//     const el = document.getElementById(BANNER_ID);
//     if (el) el.remove();
//   }

//   function resolveSidebarGateIfWaiting() {
//     if (_sidebarGateResolve) {
//       hidePauseBanner();
//       const r = _sidebarGateResolve;
//       _sidebarGateResolve = null;
//       try {
//         r();
//       } catch {
//         /* ignore */
//       }
//       log("action", "Sidebar gate released — continuing");
//       return true;
//     }
//     return false;
//   }

//   /**
//    * When jobpilot_naukri_debug=1: block after sidebar is found until run() / Start Autofill.
//    */
//   function waitForSidebarGate() {
//     if (!isEnabled()) return Promise.resolve();
//     showPauseBanner(
//       "Sidebar detected — Start Autofill or jobpilotDebug.run() to continue"
//     );
//     _ensureOverlay();
//     setOverlayStatus("Paused at sidebar — Start Autofill to continue", "—");
//     console.log("[JobPilot][Debug] Auto-flow paused for manual debugging");
//     return new Promise((resolve) => {
//       _sidebarGateResolve = resolve;
//     });
//   }

//   async function runDeferredOrFresh() {
//     if (resolveSidebarGateIfWaiting()) {
//       setOverlayStatus("Continuing…", _fieldsCount);
//       return { released: "sidebar-gate" };
//     }

//     if (!isEnabled()) {
//       console.warn(
//         P.action,
//         "Debug is off. Enable with: jobpilotDebug.enable() then reload, or localStorage.setItem('jobpilot_naukri_debug','1')"
//       );
//     }

//     hidePauseBanner();

//     const runner = _deferredRunner;
//     const sendResp = _deferredSendResponse;
//     clearDeferred();
//     _abortRequested = false;
//     const exec =
//       runner ||
//       (typeof globalThis.__jobpilotRunNaukriApply__ === "function"
//         ? () => globalThis.__jobpilotRunNaukriApply__()
//         : null);
//     if (!exec) {
//       const err = new Error("No apply runner registered (__jobpilotRunNaukriApply__)");
//       logError("run()", err);
//       throw err;
//     }
//     setOverlayStatus("Running…", "—");
//     try {
//       const result = await exec();
//       if (sendResp) {
//         try {
//           sendResp(result);
//         } catch (e) {
//           logError("sendResponse", e);
//         }
//       }
//       setOverlayStatus("Completed", _fieldsCount);
//       hidePauseBanner();
//       return result;
//     } catch (e) {
//       logError("run()", e);
//       setOverlayStatus("Failed — see console", _fieldsCount);
//       hidePauseBanner();
//       if (sendResp) {
//         try {
//           sendResp({ success: false, error: e.message || String(e) });
//         } catch (e2) {
//           logError("sendResponse(error)", e2);
//         }
//       }
//       throw e;
//     }
//   }

//   function requestAbort() {
//     _abortRequested = true;
//     globalThis.__JOBPILOT_NAUKRI_ABORT__ = true;
//     log("action", "Stop requested");
//     setOverlayStatus("Stopped", _fieldsCount);
//   }

//   function consumeAbortRequested() {
//     return _abortRequested === true;
//   }

//   function resetAbortFlag() {
//     _abortRequested = false;
//     globalThis.__JOBPILOT_NAUKRI_ABORT__ = false;
//   }

//   function highlightField(el, label, ms) {
//     if (!isEnabled() || !el || el.nodeType !== 1) return;
//     const duration = ms ?? 1400;
//     try {
//       const prevOutline = el.style.outline;
//       const prevOutlineOff = el.style.outlineOffset;
//       el.style.outline = "3px solid #2563eb";
//       el.style.outlineOffset = "2px";
//       const prev = _highlightTimers.get(el);
//       if (prev) clearTimeout(prev);
//       const t = setTimeout(() => {
//         el.style.outline = prevOutline;
//         el.style.outlineOffset = prevOutlineOff;
//         _highlightTimers.delete(el);
//       }, duration);
//       _highlightTimers.set(el, t);
//     } catch (e) {
//       logError("highlightField", e);
//     }
//   }

//   function setOverlayStatus(status, fieldsLine) {
//     _statusText = status;
//     if (fieldsLine !== undefined && fieldsLine !== null) _fieldsCount = fieldsLine;
//     _refreshOverlay();
//   }

//   function setFieldsFoundLine(n) {
//     _fieldsCount = String(n);
//     _refreshOverlay();
//   }

//   function _ensureOverlay() {
//     if (!isEnabled() || _overlayMounted) return;
//     const id = "jobpilot-naukri-debug-overlay";
//     if (document.getElementById(id)) {
//       _overlayMounted = true;
//       return;
//     }

//     const wrap = document.createElement("div");
//     wrap.id = id;
//     wrap.setAttribute("data-jobpilot-debug", "1");
//     Object.assign(wrap.style, {
//       position: "fixed",
//       right: "12px",
//       bottom: "12px",
//       zIndex: "2147483646",
//       fontFamily:
//         'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
//       fontSize: "12px",
//       lineHeight: 1.35,
//       color: "#0f172a",
//       background: "#f8fafc",
//       border: "1px solid #94a3b8",
//       borderRadius: "10px",
//       boxShadow: "0 8px 24px rgba(15,23,42,.18)",
//       padding: "10px 12px",
//       maxWidth: "280px",
//       pointerEvents: "auto",
//     });

//     wrap.innerHTML = `
//       <div style="font-weight:700;margin-bottom:6px;color:#1e293b;">JobPilot · Naukri DEBUG</div>
//       <div id="jp-nd-status" style="margin-bottom:4px;white-space:pre-wrap;"></div>
//       <div id="jp-nd-fields" style="margin-bottom:8px;color:#475569;"></div>
//       <div style="display:flex;flex-wrap:wrap;gap:6px;">
//         <button type="button" id="jp-nd-start" style="cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid #64748b;background:#fff;">Start Autofill</button>
//         <button type="button" id="jp-nd-stop" style="cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid #b91c1c;color:#b91c1c;background:#fff;">Stop</button>
//         <button type="button" id="jp-nd-rerun" style="cursor:pointer;padding:4px 8px;border-radius:6px;border:1px solid #64748b;background:#eef2ff;">Re-run Fill</button>
//       </div>
//       <div style="margin-top:8px;font-size:11px;color:#64748b;">Console: <code style="background:#e2e8f0;padding:1px 4px;border-radius:4px;">jobpilotDebug.run()</code></div>
//     `;

//     const mount = () => {
//       document.documentElement.appendChild(wrap);
//       _overlayMounted = true;
//       wrap.querySelector("#jp-nd-start").addEventListener("click", () => {
//         log("action", "Start Autofill clicked");
//         runDeferredOrFresh().catch(() => {});
//       });
//       wrap.querySelector("#jp-nd-stop").addEventListener("click", () => {
//         requestAbort();
//       });
//       wrap.querySelector("#jp-nd-rerun").addEventListener("click", () => {
//         log("action", "Re-run Fill clicked");
//         try {
//           if (typeof globalThis.__jobpilotReRunNaukriFill__ === "function") {
//             globalThis.__jobpilotReRunNaukriFill__();
//           } else {
//             log("action", "__jobpilotReRunNaukriFill__ not registered yet");
//           }
//         } catch (e) {
//           logError("reRunFill", e);
//         }
//       });
//       _refreshOverlay();
//     };

//     if (document.body) mount();
//     else document.addEventListener("DOMContentLoaded", mount, { once: true });
//   }

//   function _refreshOverlay() {
//     if (!isEnabled()) return;
//     _ensureOverlay();
//     const wrap = document.getElementById("jobpilot-naukri-debug-overlay");
//     if (!wrap) return;
//     const st = wrap.querySelector("#jp-nd-status");
//     const fd = wrap.querySelector("#jp-nd-fields");
//     if (st) st.textContent = _statusText;
//     if (fd) fd.textContent = "Fields found: " + _fieldsCount;
//   }

//   function enable() {
//     _writeLs(LS_DEBUG, "1");
//     log("action", "Debug enabled — reload recommended for clean state");
//     _ensureOverlay();
//     _refreshOverlay();
//   }

//   function disable() {
//     _writeLs(LS_DEBUG, "0");
//     _manualMode = null;
//     if (_sidebarGateResolve) {
//       const r = _sidebarGateResolve;
//       _sidebarGateResolve = null;
//       try {
//         r();
//       } catch {
//         /* ignore */
//       }
//     }
//     const el = document.getElementById("jobpilot-naukri-debug-overlay");
//     if (el) el.remove();
//     _overlayMounted = false;
//     hidePauseBanner();
//     console.log(P.action, "Debug disabled — overlay removed");
//   }

//   function getFormFillHooks() {
//     if (!isEnabled()) return null;
//     return {
//       onMatch: (info) => {
//         log("fields", "match", {
//           kind: info.kind,
//           label: info.label,
//           key: info.key,
//         });
//         if (info.field) highlightField(info.field, info.label, 1600);
//       },
//       onFill: (info) => {
//         const v =
//           typeof info.value === "string"
//             ? info.value.length > 120
//               ? info.value.slice(0, 120) + "…"
//               : info.value
//             : info.value;
//         log("fill", "value", { key: info.key, value: v });
//       },
//     };
//   }

//   function countDetectableFields(panel) {
//     if (!panel || !globalThis.PanelKernel?.deepQuerySelectorAll) return 0;
//     try {
//       const inputs = globalThis.PanelKernel.deepQuerySelectorAll(
//         panel,
//         "input:not([type='hidden']):not([type='file']):not([type='radio']):not([type='checkbox']), select, textarea"
//       );
//       return inputs.filter((el) => globalThis.PanelKernel.isVisible?.(el) !== false).length;
//     } catch {
//       return 0;
//     }
//   }

//   globalThis.JobPilotNaukriDebug = {
//     P,
//     isEnabled,
//     isManualMode,
//     setManualMode,
//     shouldDeferApply,
//     deferApply,
//     clearDeferred,
//     runDeferredOrFresh,
//     waitForSidebarGate,
//     resolveSidebarGateIfWaiting,
//     showPauseBanner,
//     hidePauseBanner,
//     requestAbort,
//     consumeAbortRequested,
//     resetAbortFlag,
//     log,
//     logError,
//     highlightField,
//     setOverlayStatus,
//     setFieldsFoundLine,
//     getFormFillHooks,
//     countDetectableFields,
//     enable,
//     disable,
//     _ensureOverlay,
//   };

//   globalThis.jobpilotDebug = {
//     enable,
//     disable,
//     isEnabled,
//     /** Start deferred apply, or run standalone if hooks registered */
//     run: () => runDeferredOrFresh(),
//     stop: () => requestAbort(),
//     setManual: (on) => setManualMode(!!on),
//     /** Keep debug logging/overlay but let the background `applyToJob` message start immediately */
//     allowBackgroundAuto: () => {
//       _writeLs(LS_MANUAL, "0");
//       _manualMode = false;
//       log("action", "Background auto-apply enabled (debug still on)");
//     },
//     /** Require manual `run()` / [Start Autofill] when debug is on */
//     requireManualStart: () => {
//       _writeLs(LS_MANUAL, "1");
//       _manualMode = true;
//       log("action", "Manual start required again");
//     },
//     help: () => {
//       console.log(`[JobPilot][Naukri] DEBUG help
// • Enable:  jobpilotDebug.enable() then reload the tab (or localStorage.setItem("jobpilot_naukri_debug","1"))
// • Disable: jobpilotDebug.disable()
// • Run:     jobpilotDebug.run()  (after a job was queued, or anytime if resume data was already injected)
// • Stop:    jobpilotDebug.stop()
// • Logs:    [JobPilot][Naukri][Detect|Fields|Fill|Action] + [Retry] + [Error]
// • Manual defer (default when debug ON): jobpilotDebug.requireManualStart()
// • Auto from dashboard while debug ON:   jobpilotDebug.allowBackgroundAuto()
// • With jobpilot_naukri_debug=1: sidebar pause uses Start/run; background keeps the tab open and skips the rest of the queue batch

// ── panel_kernel_missing / typeof PanelKernel === "undefined" ──
// • In Chrome DevTools **Console**, open the execution-context dropdown (often says “top”) and choose **your extension** (“JobPilot” / the extension id). The **Page** context is the website’s window — extension globals (PanelKernel) are NOT there, so typeof PanelKernel is always "undefined" on “top”.
// • Means globalThis.PanelKernel was undefined **inside** the extension world when apply ran — check SERVICE WORKER logs too (chrome://extensions → JobPilot → Service worker → Inspect).
// • Reload the job tab after changing the extension; background waits for manifest content_scripts before falling back to programmatic inject.

// ── Testing this flow ──
// 1) localStorage.setItem("jobpilot_naukri_debug","1") then reload the Naukri job tab (or jobpilotDebug.enable() + reload).
// 2) Queue one job from the dashboard so the background opens this tab and injects scripts.
// 3) Watch for the amber banner + bottom-right debug panel; after the sidebar appears, use Start Autofill or jobpilotDebug.run() to continue.
// 4) Service worker + this tab DevTools: two consoles — use both when something fails.
// `);
//     },
//     /** Re-fill last panel only */
//     reRunFill: () => {
//       if (typeof globalThis.__jobpilotReRunNaukriFill__ === "function") {
//         return globalThis.__jobpilotReRunNaukriFill__();
//       }
//       console.warn(P.action, "Panel not ready — open apply sidebar first");
//     },
//     log,
//   };

//   if (isEnabled()) {
//     log("detect", "Naukri debug module loaded", {
//       manualMode: isManualMode(),
//       jobpilotDebug: "window.jobpilotDebug",
//     });
//     _ensureOverlay();
//     setOverlayStatus("Idle (debug on)", "—");
//   }
// })();
