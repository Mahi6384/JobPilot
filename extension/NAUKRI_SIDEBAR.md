# Naukri sidebar & questionnaire auto-apply

This note describes a bug that showed up when JobPilot’s extension automated **Naukri** application flows (including the sidebar / questionnaire modals), and the fix that was shipped in the extension.

---

## Problem statement

During auto-apply on Naukri (for example **Naukri Campus** recruiter questions), the extension logs showed that fields were filled—for example:

- `Filled 1 fields (step 1)`
- `[stage:fill]` with a non-zero `filled` count

Visually, a radio option (such as **Yes** for a service-agreement style question) could **appear selected**, but the primary **Save** control stayed **disabled** (low opacity / non-clickable), so the flow could not continue.

From a product perspective: **automation believed it had answered the question, while Naukri’s UI still treated the step as incomplete.**

---

## Why it happened (root cause)

Naukri’s questionnaire is built with a modern SPA stack (e.g. **React**). For those UIs:

1. **DOM state is not the same as app state.** Setting `input.checked = true` or dispatching a bare synthetic `change` event does not always run the same code path as a **real user interaction** on the **visible** control (often a styled label or wrapper, not the raw `<input>`).

2. **Our radio helper short-circuited.** `fillRadioGroup` used to return immediately when **any** radio in the group was already checked. That meant: if the native input was checked (from a prior partial automation path or fallback) but React had **not** updated its internal form state, we **never** re-fired the label click sequence Naukri expects—so **Save** never became enabled.

3. **Post-fill “nudge” only targeted text-like controls.** `nudgeFormAfterFill` re-dispatched `input` / `change` / `blur` on text inputs, textareas, and selects. Radio groups often need a **click-style** nudge on the visible target, not only generic events on the hidden input.

Chrome **Violation** messages (`setTimeout` handler took N ms`, forced reflow) were **performance hints**, not the cause of the disabled Save button.

---

## Solution implemented

Changes are scoped to the extension’s Naukri apply path and shared form utilities.

### 1. `fillRadioGroup` — resync when a selection already exists (`utils/formFiller.js`)

- **Before:** If any radio in the group was checked, return `false` and do nothing.
- **After:**
  - If **nothing** is checked: keep the previous behavior (click the visible target for the **first** option, set `checked`, fire `change` / `input`).
  - If **something** is already checked: treat it as a **React resync**—click the **visible** target for that checked option, then fire `change` / `input` on that input (without fighting `checked` state).

This aligns DOM selection with what a real user click would do, so Naukri can enable **Save** / **Next**.

### 2. `nudgeRadioGroupsReact` (`utils/formFiller.js`)

A small helper that walks all **named** radio groups under the panel and, for each group that has a checked option, runs the same **label + full synthetic click + events** pass again. This acts as a **second sync pass** after batch filling.

### 3. `naukriNudgeAfterFill` (`content-scripts/naukri.js`)

After `nudgeFormAfterFill` (text/select nudge from `utils/dom.js`), call `nudgeRadioGroupsReact(panel)` when available. All relevant spots in the Naukri apply loop that previously called only `nudgeFormAfterFill` now use this combined helper.

### 4. Debug re-run parity

`__jobpilotReRunNaukriFill__` also runs `naukriNudgeAfterFill` after `fillAllFields`, so manual “re-run fill” matches the live apply flow.

---

## What you should do locally

1. Reload the extension in `chrome://extensions` (or your browser’s equivalent) after pulling these changes.
2. Run the Naukri apply / sidebar flow again; **Save** should become clickable once the question is answered in a way Naukri’s React layer accepts.

---

## Related files

| File | Role |
|------|------|
| `jobpilot/extension/utils/formFiller.js` | `fillRadioGroup`, `nudgeRadioGroupsReact`, `fillAllFields` |
| `jobpilot/extension/utils/dom.js` | `nudgeFormAfterFill` (unchanged contract; still used first) |
| `jobpilot/extension/content-scripts/naukri.js` | `naukriNudgeAfterFill`, apply loop, `__jobpilotReRunNaukriFill__` |
| `jobpilot/extension/config/naukri-hints.json` | Host / panel hints (separate from this fix) |

---

## Follow-ups (optional)

- **Smarter radio choice:** Today, when no option is checked, the first radio in DOM order is still chosen. For questions like “2.5 year service agreement”, you may later want label-based rules (e.g. prefer **Yes**) keyed off question text or `naukri-hints.json`.
- **Modal-specific selectors:** If a new Naukri surface uses different markup, extend hints or `_getRadioClickTarget` logic only where needed.
