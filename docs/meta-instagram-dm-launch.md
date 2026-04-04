# Instagram DM-First Launch Model

## Product story

Businesses connect their own Instagram Business / Professional account and the platform helps them manage inbound customer conversations using tenant-specific business settings and runtime.

## Forced architectural decision

Keep and harden the existing page/token-based Meta connect flow for launch.

Why:
- The repo already has a real tenant-aware runtime, webhook sidecar, and page-token outbound path.
- Meta's Instagram messaging onboarding supports the page-account discovery path used here.
- A full migration to a different permission family would add risk without improving the DM-first launch path.

## Launch permissions

Requested for DM-first launch:
- `pages_show_list`
- `pages_manage_metadata`
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

## Phase 2 surfaces

These remain outside the launch story until permissions and production paths match:
- Instagram comments
- Instagram content publish
- Non-Instagram self-serve connectors
