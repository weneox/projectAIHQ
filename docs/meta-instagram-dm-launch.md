# Instagram DM-First Launch Model

## Product story

Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.

If Meta returns more than one eligible page / Instagram asset, the product must pause in a truthful selection-required state until the tenant explicitly chooses the correct business account.

## Forced architectural decision

Keep and harden the existing page/token-based Meta connect flow for launch.

Why:
- The repo already has a real tenant-aware runtime, webhook sidecar, and page-token outbound path.
- Meta's Instagram messaging onboarding supports the page-account discovery path used here.
- A full migration to a different permission family would add risk without improving the DM-first launch path.

## Launch permissions

Requested for DM-first launch:
- `pages_show_list`
- `instagram_basic`
- `instagram_manage_messages`

Explicitly not in the DM-first launch permission story:
- `business_management`
- `instagram_manage_comments`
- `instagram_content_publish`

## State model

Tenant Instagram connection state must be explicit:
- `connected`
- `not_connected`
- `reconnect_required`
- `disconnected`
- `deauthorized`
- `blocked`

Selection-required is not a fake connected state. When Meta returns more than one eligible asset, the tenant stays `not_connected` until one account is explicitly chosen.

## Freeze posture

- Public Meta-facing privacy, terms, and deletion pages must describe the Instagram Business / Professional DM-first launch story only.
- The review story must not imply WhatsApp, Instagram comments, content publish, or broader Meta-family onboarding for this launch.
- Pending multi-account selections expire after 15 minutes and are cleaned up instead of lingering as stale pseudo-connections.
- The system does not auto-refresh Meta user tokens. If the stored user-token window is expired or nearly expired, the product should stay truthful and recommend an explicit reconnect without pretending to renew auth automatically.

## Phase 2 surfaces

These remain outside the launch story until permissions and production paths match:
- Instagram comments
- Instagram content publish
- Non-Instagram self-serve connectors
