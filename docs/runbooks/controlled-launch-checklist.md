# Controlled Launch Checklist

Use this checklist for the surviving controlled launch slice only:
Home -> Setup Widget -> Truth/Runtime -> Channels -> Inbox

## Workspace isolation
- [ ] Start in tenant A and confirm `/home` shows tenant A launch posture.
- [ ] Switch to tenant B and confirm Home, the setup widget, Truth, Channels, and Inbox do not show tenant A draft, review, or channel state.
- [ ] Switch back to tenant A and confirm the same pages rehydrate tenant A posture without manual cache clearing.

## Home
- [ ] `/home` loads without false "ready" language when approved truth or runtime is blocked.
- [ ] `/setup` redirects to `/home?assistant=setup`.
- [ ] `/home?assistant=setup` opens the global `FloatingAiWidget` on the active tenant.

## Setup Widget
- [ ] The widget opens on the active tenant and does not show another tenant's current review or session state.
- [ ] Website import runs inside the widget and writes into the current draft session only.
- [ ] Same-website re-scan reuses the current draft session only when the intake bundle matches.
- [ ] Different-website scan does not silently merge into the active draft session.
- [ ] Partial or weak extraction remains review-needed and does not look approved or launch-ready.

## Truth and Runtime
- [ ] No approved truth means Truth stays blocked and Home stays fail-closed.
- [ ] Runtime problems keep launch posture blocked even when a channel is connected.
- [ ] Truth rollback or other truth-changing actions refresh Home and Truth for the same tenant.

## Channels
- [ ] Website chat, Instagram/Meta, and Telegram all reflect the active tenant only.
- [ ] Connected channel plus blocked truth/runtime still reads as blocked, not launch-ready.
- [ ] Channel configuration changes refresh Home, Channels, and the widget posture for the same tenant.

## Inbox
- [ ] Inbox does not read as live-ready when truth, runtime, or delivery posture is blocked.
- [ ] Workspace switch clears thread/detail state before the next tenant load finishes.

## One real dress rehearsal
1. Start with a controlled tenant that has no approved truth.
2. Open `/home?assistant=setup`.
3. Import a real website and confirm the draft stays review-only.
4. Re-scan the same site and confirm the review session is reused.
5. Finalize setup and confirm Home, Truth, and Channels refresh for the same tenant.
6. Open Inbox and confirm live posture matches the actual truth/runtime/channel state.
