# CLAUDE.md — Queue Restaurant MVP Build Spec

> This file is the source of truth for Claude Code when building this project.
> Always read this file first when starting a new session.

## Project Overview

**Queue Restaurant** — a restaurant queue system running entirely on Google Apps Script + Google Sheets. Customers scan a QR at the door, tap a button, get a queue number, and watch their status live. Staff call the next number from a passcode-gated dashboard. A display-board view shows "now serving" on a TV.

Goal: prove a real multi-user, customer-facing tool can ship **100% free** on the Apps Script lane in one sitting. The app ships to a live web-app `/exec` URL by the end.

This is the **HtmlService sub-shape**: Apps Script serves the UI *and* the logic. One origin, `google.script.run` for all client→server calls, **no CORS anywhere, no fetch, no separate frontend**.

## Non-Negotiable Scope Rules

These are intentional design constraints. **Do not expand scope without being asked.**

- ✅ Apps Script lane, HtmlService sub-shape only. **No Vite, no React, no separate frontend, no Cloudflare.** Plain HTML/CSS/JS inside HtmlService templates.
- ✅ Google Sheets is the only datastore. No external DB, no PropertiesService-as-database (Script Properties hold config only).
- ✅ One queue. No table sizes, no zones, no multiple branches.
- ✅ No customer accounts, no login for customers. Staff view is gated by a single shared passcode checked **server-side**.
- ✅ Status updates via polling (`setInterval` + `google.script.run`). No push, no LINE/SMS notify, no time-driven triggers.
- ✅ No wait-time estimates — just "X ahead of you". No history/analytics views.
- ✅ Web only (responsive). Customer view is phone-first; board view is TV-first.

If a feature is not listed in the checkpoints below, **ask before adding**.

## Tech Stack (Locked)

- **Google Apps Script** — backend + serving the UI (HtmlService).
- **Google Sheets** (`SpreadsheetApp`) — the datastore. One spreadsheet, tabs: `queue`, `archive` (optional, checkpoint 3).
- **HtmlService templates** — `customer.html`, `staff.html`, `board.html`, plus shared partials via the standard `include()` pattern.
- **`google.script.run`** — all client→server calls. Never `fetch`, never `UrlFetchApp` for own endpoints.
- **`LockService`** — script lock around every queue-mutating function.
- **clasp 3.x** — local dev + deploy. Note: clasp 3.x renamed commands (`clasp create-deployment` is the deploy command; some aliases remain). Confirm with `clasp help` before assuming a command exists.
- **`.clasp.json`** — clasp 3.x lists `.gs` in `scriptExtensions` by default (generated automatically on `clasp create`), so naming the server file `Code.gs` just works — no config change needed.
- **No frameworks, no bundler, no npm packages in the app itself.** Vanilla JS + small inline CSS. Keep each HTML file self-contained apart from shared partials.

## Scaffold (assumed done — the prebuild)

```bash
npm i -g @google/clasp
# Enable "Google Apps Script API" at https://script.google.com/home/usersettings (one time)
clasp login
mkdir q-restaurant && cd q-restaurant
clasp create --title "q-restaurant" --type sheets
```

`--type sheets` creates a new Google Sheet and binds the Apps Script project to it directly (container-bound) — no separate Sheet-creation step and no `SHEET_ID` needed.

Also done in prebuild:
- Staff passcode stored in Script Properties as `STAFF_PASSCODE`.
- One throwaway deployment created so the `/exec` URL exists and **Execute as: Me / Who has access: Anyone** are already set in the editor (Deploy → Manage deployments — clasp cannot set these).

## Project Structure (Target)

```
queueq/
├── appsscript.json        # manifest (webapp access: ANYONE_ANONYMOUS, executeAs: USER_DEPLOYING)
├── Code.gs                # everything server-side: doGet router, include() helper, all Sheet read/write logic + LockService
├── customer.html          # default view (phone)
├── staff.html             # ?page=staff (passcode gate + queue controls)
├── board.html             # ?page=board (TV display)
└── styles.html            # shared CSS partial, pulled in via include()
```

## Data Model (Source of Truth)

`queue` tab columns (row 1 = header):

| col | field      | notes                                            |
|-----|------------|--------------------------------------------------|
| A   | id         | uuid (`Utilities.getUuid()`)                     |
| B   | date       | `yyyy-MM-dd` (script timezone) — numbering is per-day |
| C   | number     | integer, per-day sequence starting at 1          |
| D   | status     | `waiting` \| `called` \| `done` \| `skipped`     |
| E   | createdAt  | ISO string                                       |
| F   | calledAt   | ISO string or empty                              |

Rules:
- **Queue number = (count of today's rows) + 1**, computed inside the lock.
- "Now serving" = the most recent row with status `called` today.
- "X ahead" for a waiting customer = count of today's rows with status `waiting` created before theirs, plus any `called` not yet `done`/`skipped` minus... keep it simple: count of today's `waiting` rows with a smaller number.
- Batch reads only: `getDataRange().getValues()` once per call, filter in JS. Never `getValue()` in a loop.

## Build Checkpoints (Execute in Order)

**Rule:** Do not start checkpoint N+1 until checkpoint N passes its verification. Each checkpoint is a clean, viewer-visible win.

---

### Checkpoint 1 — Customer page: จองคิว works

**Deliverable:**
- `Code.gs`: `doGet(e)` routes on `e.parameter.page` (`staff`, `board`, default → customer). Use `HtmlService.createTemplateFromFile(...).evaluate()` with `.addMetaTag('viewport', 'width=device-width, initial-scale=1')`.
- `include(filename)` helper for `styles.html`.
- `Code.gs`: `issueQueue()` — appends a row, returns `{ id, number, date }`. (Lock comes in checkpoint 2 — write the function so the lock is a 3-line addition.)
- `customer.html`: big "จองคิว" button → `google.script.run.withSuccessHandler(...).issueQueue()` → shows คิวที่ N. Store the returned `id` in a JS variable (and `sessionStorage` so a refresh survives).

**Critical implementation details:**
- Open the spreadsheet via `SpreadsheetApp.getActiveSpreadsheet()` — the script is container-bound to the Sheet, no ID lookup needed.
- `google.script.run` returns nothing directly; all results flow through `withSuccessHandler`. Always attach `withFailureHandler` too and surface the error in the UI.

**Verify:**
- Open the `/dev` URL on desktop + phone. Tap จองคิว → a number renders and a row lands in the Sheet with today's date and status `waiting`.
- Refresh the page → the same number is still shown (sessionStorage).

---

### Checkpoint 2 — Concurrency hardening (LockService)

**Deliverable:**
- Wrap the read-count-append section of `issueQueue()` in `LockService.getScriptLock()` with `lock.waitLock(10000)` and `lock.releaseLock()` in a `finally`.
- On lock timeout, throw a user-readable error; customer page shows "คิวหนาแน่น ลองอีกครั้ง".

**Known gotchas to handle:**
- The lock must cover **both** the count-read and the append — locking only the append still produces duplicates.
- Use the **script lock** (global), not the user lock — different anonymous users don't share a user lock.

**Verify:**
- Two browsers (or browser + phone) hammering จองคิว near-simultaneously ~10 times → numbers in the Sheet are strictly sequential, zero duplicates.

---

### Checkpoint 3 — Staff view

**Deliverable:**
- `staff.html` at `?page=staff`: a passcode field gates the UI; after entry, show today's queue as a list (number, status, created time) with buttons: **เรียกคิวถัดไป** (oldest `waiting` → `called`), **เสร็จ** and **ข้าม** per called row, and **เริ่มวันใหม่** (all of today's `waiting`/`called` → `skipped`).
- `Code.gs`: `getQueue(passcode)`, `callNext(passcode)`, `markDone(passcode, id)`, `markSkipped(passcode, id)`, `resetDay(passcode)`. **Every one of these validates the passcode server-side** against Script Properties and throws if wrong. All mutating functions take the script lock.
- Staff list refreshes after every action and auto-polls every ~5 s.

**Verify:**
- Wrong passcode → server throws, UI shows an error (check via failure handler); no data returned.
- เรียกคิวถัดไป flips the oldest waiting row to `called` in the Sheet, `calledAt` stamped.
- เริ่มวันใหม่ leaves `done` rows alone and skips the rest; next จองคิว still continues today's numbering (numbering counts all of today's rows, including skipped).

---

### Checkpoint 4 — Customer status polling

**Deliverable:**
- `Code.gs`: `getStatus(id)` → `{ number, status, ahead, nowServing }`.
- `customer.html`: after getting a number, `setInterval` every **7000 ms** calling `getStatus`. Renders: "คิวของคุณ: N · อีก X คิว · กำลังเรียก: M". When status becomes `called` → full-screen flip to "ถึงคิวคุณแล้ว 🔔" (vibrate via `navigator.vibrate` if available). When `done`/`skipped` → stop polling and show an end state.
- Pause polling when `document.visibilityState === 'hidden'` (visibilitychange listener), resume on visible — cuts pointless executions.

**Verify:**
- Two devices on the `/dev` URL: phone holds a waiting queue; desktop staff presses เรียกคิวถัดไป; within ≤7 s the phone flips to "ถึงคิวคุณแล้ว".
- Background the phone tab → executions stop appearing in the Apps Script dashboard; foreground → polling resumes.

---

### Checkpoint 5 — Display board

**Deliverable:**
- `board.html` at `?page=board`: huge "กำลังเรียกคิว" number (readable across a room), a "ถัดไป" strip of the next 3–5 waiting numbers, auto-poll every **5000 ms** via a public `getBoardState()` (no passcode — it exposes only numbers/statuses, no ids).
- Subtle pulse animation when the now-serving number changes.

**Verify:**
- Board open on a third screen; staff calls next → board updates within ≤5 s and pulses.

---

### Checkpoint 6 — Deploy 🏆

**Deliverable:**
- `clasp push` the final code.
- Redeploy the existing deployment so the `/exec` URL updates: `clasp create-deployment --deploymentId <ID> --description "v1"` (confirm exact syntax with `clasp help` — clasp 3.x renamed commands). **Saving/pushing code does NOT update `/exec` by itself.**
- Generate a QR code image pointing at the `/exec` URL (any QR generator) for the door.

**Verify — the money shot:**
- Three screens on the **`/exec`** URL (not `/dev`): phone = customer, laptop = staff, tablet/TV = board.
- Phone taps จองคิว from the QR → staff presses เรียกคิวถัดไป → board and phone both update within seconds.
- An incognito window can reach the customer page with **no Google sign-in prompt** (access = Anyone).

---

## Deploy

- `clasp push` — upload code. The **test deployment `/dev` URL** always reflects the latest pushed code; use it for all dev/testing.
- The **`/exec` URL only updates when you redeploy** to the same deployment ID. This is the lane's classic trap — never demo `/exec` after only pushing.
- Access settings (Execute as: Me, Who has access: Anyone) live in the editor's Deploy → Manage deployments; set once in prebuild, they persist across redeploys.
- Config (`STAFF_PASSCODE`) lives in Script Properties — nothing secret in code or in the repo.

## Coding Conventions

- **One server file:** all routing, templating, and Sheet/queue logic lives in a single `Code.gs` — keeps the project copy-paste-able. Group it internally (doGet/include at top, queue functions below) but don't split into multiple `.gs` files. Client JS lives inside each page's HTML file.
- **Batch Sheet access:** one `getValues()` per server call; filter/compute in JS; single `appendRow`/`setValues` writes.
- Every mutating server function: validate passcode (staff ones) → take script lock → do work → release in `finally`.
- Every `google.script.run` call has both `withSuccessHandler` and `withFailureHandler`.
- Comments: the "why," not the "what."
- Commits: one per checkpoint, `feat(checkpoint-N): {summary}`.

## Anti-Patterns to Avoid

- ❌ Don't build a separate Vite/React frontend or expose JSON endpoints (`ContentService`) — that's the other sub-shape and it drags in the CORS mess. Everything stays same-origin in HtmlService.
- ❌ Don't issue queue numbers outside the script lock, and don't lock only the write — cover the read+write.
- ❌ Don't call `getValue()`/`setValue()` per cell in loops. Batch.
- ❌ Don't gate staff actions client-side only. The passcode check lives in every server function.
- ❌ Don't use time-driven triggers to "push" updates — polling from the client is the lane's model.
- ❌ Don't hardcode the passcode in code. Script Properties.
- ❌ Don't demo on `/dev` in the final shot, and don't expect `/exec` to update on push — redeploy.
- ❌ Don't add a service worker / PWA install flow. Out of scope.

## When Stuck

If something fails after one attempt:
1. State what you tried and the exact error.
2. Give **two** likely causes, ranked.
3. Recommend the smallest test to tell them apart.
4. Wait for direction. Don't thrash.

Common stuck-points for this build:
- `google.script.run` silently does nothing → missing `withFailureHandler`; add it and read the real error.
- "You do not have permission" on `SpreadsheetApp.getActiveSpreadsheet()` → the script hasn't been authorized for the Sheets scope; run any function once in the editor to trigger consent.
- Duplicate queue numbers under load → the lock doesn't cover the count-read, or user lock was used instead of script lock.
- `/exec` shows old UI → you pushed but didn't redeploy.
- Anonymous visitor hits a Google login wall → deployment access is not "Anyone"; fix in Manage deployments.

## Pre-flight (test OFF-camera before recording)

> The things most likely to break on camera. Test them first.

- 🔥 **The two-browser hammer test on `issueQueue()`** — 10 rapid taps from two devices, confirm strictly sequential numbers. This is the #1 fragile piece.
- 🔥 **The `/dev` vs `/exec` trap** — do one full push→redeploy→open `/exec` cycle and confirm the new UI appears, so the final checkpoint has zero surprises.
- Confirm an **incognito/anonymous** visitor reaches the customer page with no login (access = Anyone) — the first-consent screen belongs to the owner only, done in prebuild.
- Sanity-check polling load: ~30 customers × 1 poll/7 s ≈ 4–5 short executions/s peak, well under the 30-simultaneous-executions ceiling — but confirm nothing else heavy runs on this account.
- Run Checkpoint 1 end-to-end before recording.

## Done Definition

Done when:
- All checkpoints pass their verification.
- The app is **deployed and reachable on its `/exec` URL** — full three-screen loop working live, anonymous access confirmed.
- Code committed to GitHub with checkpoint tags (`checkpoint-1` … `checkpoint-6`).
- Script Properties documented in the repo (names only, no values).
- At wrap-up: `README.md` written with setup + deploy + the live URL and blog/video links.
