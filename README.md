# Queue Restaurant — a free, live restaurant queue system on Google Apps Script

Customers scan a QR at the door, tap one button, get a queue number, and watch
their status update live on their phone. Staff call the next number from a
passcode-gated dashboard. A TV shows "now serving" for the whole room to see.

No servers, no database, no hosting bill — the entire thing runs on
**Google Apps Script + Google Sheets**, for free.

**Live app:** https://script.google.com/macros/s/AKfycbwPh4I_1ItCKk1-jzkTrpY63R28k_cMEOMqub8CWVNZDYhB_82IHhHZ2PIvspp2I51u/exec

> Not a developer? [`BLOG.md`](./BLOG.md) walks through getting your own
> copy running by clicking "Make a copy" on a Google Sheet — no terminal,
> no git, no clasp. This README is the command-line / clasp path.

- Customer view: the link above
- Staff view: append `?page=staff` (passcode required)
- Board view: append `?page=board`

## Why Apps Script

Google Apps Script's `HtmlService` can serve a full web app — HTML, CSS, and
JS — directly from the same script that reads and writes a Google Sheet.
There's no separate frontend, no API layer, no CORS, and no hosting cost. For
a small, single-location tool like a restaurant queue, that trade-off is
worth it: less infrastructure, in exchange for Google Sheets as your only
datastore and `google.script.run` as your only client-server bridge.

## How it works

- **One Google Sheet** is the entire database — a `queue` tab with a row per
  ticket: `id`, `date`, `number`, `status`, `createdAt`, `calledAt`.
- **Queue numbers reset daily**, computed as "count of today's rows + 1"
  inside a script lock, so concurrent taps never collide or duplicate.
- **Everything is polling**, not push. The customer page polls every 7s, the
  board every 5s, the staff dashboard every 5s — simple and reliable, at the
  cost of not being instant.
- **Staff actions are gated server-side.** The passcode check happens inside
  every mutating server function, never just in the UI.

## Project structure

```
q-restaurant/
├── appsscript.json   # manifest: web app access (Anyone), timezone
├── Code.gs           # everything server-side — routing, Sheet I/O, LockService
├── customer.html     # จองคิว button + live status polling
├── staff.html        # passcode-gated dashboard: call next / done / skip / reset day
├── board.html         # TV display: now serving + next up
└── styles.html       # shared CSS, pulled into every page via include()
```

Full build spec and design constraints are in [`CLAUDE.md`](./CLAUDE.md).

## Setting this up yourself

### 1. Prerequisites

```bash
npm i -g @google/clasp
clasp login
```

Enable the **Google Apps Script API** once at
https://script.google.com/home/usersettings if you haven't already.

### 2. Create the project

```bash
mkdir q-restaurant && cd q-restaurant
clasp create --title "q-restaurant" --type sheets
```

`--type sheets` creates a new Google Sheet **and** binds the Apps Script
project to it in one step (container-bound) — no separate Sheet-creation
step, and the code reads it via `SpreadsheetApp.getActiveSpreadsheet()`, no
ID to configure.

### 3. Set the staff passcode

Script Properties hold the one piece of config this app needs, so it never
ends up in the repo:

1. Open the script editor (clasp printed its URL when you ran `create`).
2. Project Settings (gear icon) → Script Properties → Add property.
3. Name: `STAFF_PASSCODE`, value: whatever code your staff will type in.

### 4. Push and test

```bash
clasp push
```

Open the **`/dev`** URL (also printed by `clasp create`, or find it via
`clasp open-script`) — this always reflects whatever you last pushed, so use
it for all development. On first open you'll be asked to authorize Sheets
access; that consent screen only appears for you, the owner.

### 5. Deploy for real

```bash
clasp create-deployment --description "v1"
```

This is the step people forget: pushing code updates `/dev`, but **`/exec`
only updates when you redeploy**. Save the deployment ID this command
prints — you'll need it for every future release:

```bash
clasp update-deployment --deploymentId <ID> --description "v2"
```

Then, in the script editor, go to Deploy → Manage deployments and confirm
this deployment has **Execute as: Me** and **Who has access: Anyone** — the
manifest declares this too, but it's worth eyeballing once, since a login
wall on the customer page is the most common failure mode of this whole
setup.

### 6. QR code for the door

Point any QR generator at your `/exec` URL and print it. Anyone who scans it
lands straight on the customer page — no Google account, no app install.

## Known quirks (learned the hard way)

- **Sheets silently converts date-looking strings to real `Date` cells.**
  Writing `'2026-07-12'` via `appendRow()` can come back from a later
  `getValues()` as a JS `Date` object instead of the string you wrote,
  breaking any `===` comparison against a fresh date string. `Code.gs` works
  around this with a `toDateString_()` normalizer before every date
  comparison.
- **CSS specificity can silently break `.hidden`.** If a page adds its own
  `<style>` block after the shared `styles.html` partial, and that block
  defines `display` on the same class an element also carries `.hidden`, the
  later rule wins on a specificity tie — the element never actually hides.
  Fixed by making `.hidden { display: none !important; }` in the shared
  partial, so it always wins regardless of page-specific styles.
- **`/dev` vs `/exec` is the classic trap.** They are different URLs with
  different update triggers. Never demo on `/dev` — it's the only one that
  updates on every push, which makes it easy to forget `/exec` is stale.

## Scope, on purpose

This is a deliberately small build — one queue, no accounts, no wait-time
estimates, no push notifications, no multi-branch support. See
[`CLAUDE.md`](./CLAUDE.md) for the full list of what was intentionally left
out and why.
