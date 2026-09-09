# Two-minute Launder Board demo

Use only bundled synthetic fixtures. Keep the **Synthetic demo** banner visible throughout.

## 0:00–0:15 — Promise and fairness

Open the mobile landing page.

> Launder Board turns laundry into a hall competition, but paying more never buys points. Each participant can help their hall once per week.

Show Maple, River, and Oak as percentages with credited/eligible counts—not load totals.

## 0:15–0:35 — Honest dashboard

Open **View synthetic demo** as Maya Quest. Show:

- self-reported and simulated source labels;
- last recorded qualifying wash;
- tracking freshness;
- current weekly credit.

State that live CSC access is not claimed. The CSC adapter is deliberately disabled until an approved contract exists.

## 0:35–1:00 — Search is the interaction

Use the preset **Friends · 14 days**. Show only accepted, opted-in friends with current tracking. Open **Why these results?** and point out the relationship, tracking, and cutoff rules. A stale synthetic participant must be absent.

## 1:00–1:15 — Controlled encouragement

Send:

> Laundry quest this week? You've got this.

The button changes to a 72-hour cooldown state. Mention mute, block, report, and the lack of any public inactivity list.

## 1:15–1:40 — Import, dedupe, and anti-waste

Import `fixtures/demo-activities.csv`. Preview one accepted washer row, a duplicate, and a refunded row. Confirm that only the qualifying new washer can score.

Record another washer session. Show:

> Recorded, but this week's participation credit is already earned.

## 1:40–1:52 — Hall result

Return to the leaderboard. Show Maple's normalized percentage and credited/eligible counts. Search or sort the hall results through the Typesense-backed preset when local services are connected.

## 1:52–2:00 — Consent proof

Open Maya's public preview. Disable public sharing. Confirm the public route/search result is denied immediately from authoritative policy even if an index deletion is queued.

Close:

> Search creates the social moment, one capped weekly action keeps it sustainable, and every public field is voluntary.

## Rehearsal gate

- Run once at 375×667 and once on desktop.
- Start from a clean seeded state.
- Keep natural-language search disabled; preset filters are the deterministic path.
- If Supabase or Typesense is unavailable, show the explicit unavailable state. Never silently substitute unlabeled local results.
