---
title: "How AI Screenshot Scanning and Dispute Resolution Keep Results Fair"
description: "How the platform reads match scores directly off your screenshot, what happens when it isn't sure, and what to do if a result still looks wrong."
date: "2026-07-19"
---

Every organizer eventually deals with the same headache: two players report different scores, or someone "forgets" to log a loss. Here's how the platform is built to keep that from turning into a group-chat argument.

## Reading the score from your screenshot

When you submit a match result, you can attach a screenshot of the in-game full-time screen. The moment you do, the platform scans it right there in your browser — reading the two team names and the score directly off the image, using on-device OCR (optical character recognition). You'll see a quick "scanning" indicator while it works.

If it reads the score with high confidence, it prefills the score fields for you automatically, and — if you're submitting via a match link — can even confirm the result without waiting on the organizer. If it's not confident (a blurry photo, an unusual crop, a cluttered stats screen), it'll say so plainly and just ask you to type the score in yourself. Either way, your screenshot is always attached as evidence for the organizer to see.

It's genuinely not perfect — reading text off a stylized game UI is a hard problem, and it works best on a clean, well-lit, uncropped screenshot of the actual full-time score screen. But it's designed to fail safely: when it isn't sure, it says so rather than guessing.

## Why this doesn't need "trust me, bro"

The screenshot isn't just a formality — it's what lets a disputed result actually get resolved instead of turning into a back-and-forth. If a score gets contested, the organizer can look at the exact same screenshot both players saw in-game and make the call.

## When something still goes wrong

Two safety nets exist for exactly this:

**Disputes.** If a result looks wrong — the wrong score got confirmed, a screenshot got misread — either player can raise a dispute directly from the match page. The organizer gets notified immediately and can review it.

**Corrections.** Organizers can go back and correct a result even after it's been finalized — fixing the score, and if it changes who actually won, the bracket updates to match. (There's one safety rule here: if the next match has already been played with the *old* winner, the correction is blocked rather than silently breaking the bracket — you'll need to sort out that downstream match first.)

## The honest trade-off

None of this — the screenshot scanning especially — is magic. It's a genuinely useful assist that removes most of the manual "did you actually win?" checking, but it's not a replacement for organizers paying attention. Treat a high-confidence auto-read result the same way you'd treat any self-reported score: reasonably trustworthy, but disputable, and always backed by the actual screenshot if it turns out to matter.

If you're setting up your first tournament and want the full walkthrough, start with [how to run a free eFootball tournament](/blog/how-to-run-a-free-efootball-tournament).
