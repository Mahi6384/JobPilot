# JobPilot extension — Naukri sidebar autofill dev log

Chronological engineering notes for the Naukri apply sidebar: panel detection, autofill loop, chat-style questions, and debug tooling. Each production commit that touches this area should add a **new section at the bottom** (never rewrite older sections).

**Commit messages:** use a short imperative subject (under ~72 characters), scoped when helpful, e.g. `fix(naukri): …` or `feat(naukri): …`. Add a body (2–6 lines): what changed, why (DOM drift, timeouts, React remount, false positives), and user-visible outcome. Avoid vague subjects like `fix stuff` or `wip`.

**After every such commit:** append one section using the template below, include the short git SHA, and paste only **relevant snippets** (5–25 lines), not whole files.

---

## 2026-04-19 — docs(naukri): add extension dev-log for sidebar autofill

**Commit:** `d67a28b`

### What changed

- Added [`extension/dev-log.md`](dev-log.md) as the canonical place for Naukri sidebar autofill progress notes.

### Why

The Naukri flow spans `naukri-hints.json`, `panelKernel.js`, `naukri.js`, chat/debug helpers, and manifest wiring. A running log next to the extension keeps commit-sized decisions (what/why/snippets) easy to find without digging through git alone.

### Snippets

```markdown
**Commit messages:** use a short imperative subject (under ~72 characters), scoped when helpful, e.g. `fix(naukri): …` or `feat(naukri): …`. Add a body (2–6 lines): what changed, why (DOM drift, timeouts, React remount, false positives), and user-visible outcome.
```

---

## 2026-04-19 — docs(naukri): correct bootstrap commit SHA in dev-log

**Commits:** `git log -2 --oneline extension/dev-log.md` (import `d67a28b`, then this metadata fix on the same branch).

### What changed

- Updated the bootstrap section’s **Commit** line in [`extension/dev-log.md`](dev-log.md) to reference `d67a28b` (the commit that first added this file) instead of a stale amend hash.

### Why

Intermediate `git commit --amend` runs changed the object id shown in the first draft of the bootstrap entry; the log should match `git log --diff-filter=A -1 --pretty=%h -- extension/dev-log.md` for traceability.

### Snippets

```diff
-**Commit:** `3e74791`
+**Commit:** `d67a28b`
```

---

## Template for new entries (copy below this line)

````markdown
## YYYY-MM-DD — <same subject line as git commit>

**Commit:** `<short-sha>`

### What changed

- …

### Why

…

### Snippets

```lang
// critical lines only
```

````

---
