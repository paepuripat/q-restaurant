# Run Your Own Restaurant Queue — No Code Required (5 Minutes)

Customers scan a QR code at your door, tap one button, and get a queue
number they can watch update live on their phone. You call the next number
from a simple, password-protected dashboard. A TV shows "now serving" for
the whole room.

It's **100% free**, runs entirely inside Google Sheets, and you don't need
to write or touch a single line of code to get your own copy running.

> Prefer the developer route — command line, git, `clasp`? See
> [`README.md`](./README.md) instead. Same app, different setup path.

## What you'll end up with

- Your own private Google Sheet that stores every queue ticket.
- Your own live web link customers tap to get a number.
- A staff dashboard only your team can access (behind a passcode you pick).
- A board view you can put on any TV or tablet.

## Step 1 — Get your own copy

Click the link below. Google will ask "Make a copy?" — say yes. This
copies the Sheet **and** the app logic attached to it into your own Google
Drive, under your own account. Nothing you do next affects the original.

**[→ Make your own copy of Queue Restaurant](PASTE_YOUR_TEMPLATE_COPY_LINK_HERE)**

## Step 2 — Set your staff passcode

Your copy needs one setting before it's ready: the passcode your staff will
type in to reach the call-next dashboard.

1. In your new copy, go to **Extensions → Apps Script**.
2. Click the gear icon (⚙️ **Project Settings**) on the left sidebar.
3. Scroll to **Script Properties** → **Add script property**.
4. Property: `STAFF_PASSCODE` — Value: any code your staff will remember.
5. Click **Save**.

## Step 3 — Publish it as a live web app

Still in the Apps Script editor:

1. Click **Deploy** (top right) → **New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Description: anything, e.g. `v1`.
4. **Execute as:** Me.
5. **Who has access:** Anyone.
6. Click **Deploy**.

The first time you do this, Google will show an "unverified app" warning —
this is normal for any script you (or someone you trust) wrote yourself
that hasn't gone through Google's public app review. Click **Advanced** →
**Go to (your project name) (unsafe)** → **Allow**. You're authorizing your
own script to read and write your own Sheet — nothing is being sent
anywhere else.

Copy the **Web app URL** it gives you at the end. That's your permanent
customer-facing link.

## Step 4 — Try all three views

- **Customers:** the web app URL from Step 3, as-is.
- **Staff:** the same URL with `?page=staff` added at the end. Enter the
  passcode from Step 2.
- **Board / TV:** the same URL with `?page=board` added at the end.

Tap จองคิว on the customer link — a number should appear, and a new row
should land in your Sheet's `queue` tab.

## Step 5 — Put it to work

- Paste your customer URL into any free QR code generator, print it, and
  stick it on the door.
- Bookmark the `?page=staff` link on your counter device, and `?page=board`
  on whatever screen faces the waiting area.

## If something's not working

- **A Google login screen shows up for customers** — go back to Step 3 and
  make sure "Who has access" is set to **Anyone**, not "Only myself."
- **"Authorization required" pop-up on first tap** — expected, one-time,
  only visible to you as the owner while testing.
- **You changed something in the code and the live link didn't change** —
  every code change needs a fresh deployment: **Deploy → Manage
  deployments → pencil icon → New version → Deploy.** There's no
  auto-publish here since there's no command line involved.
- **Wrong passcode always rejected** — double check Script Properties
  (Step 2) for typos; the value is case-sensitive.

---

*Before publishing this post: replace the placeholder link in Step 1 with
your real template's copy-link. To get it — open your finished, clean
template Sheet (test data cleared out), set sharing to "Anyone with the
link — Viewer," copy its URL, and change the `/edit...` part at the end to
`/copy`. Opening that link is what triggers Drive's "Make a copy" prompt
for readers.*
