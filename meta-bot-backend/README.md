# meta-bot-backend

Meta webhook gateway for tenant-aware Instagram messaging runtime.

## Features
- `GET /webhook` - Meta webhook verification
- `POST /webhook` - Receive Meta events, resolve the tenant through AIHQ, and continue the DM runtime flow
- `GET /privacy` - Privacy Policy page
- `GET /terms` - Terms of Service page
- `GET/POST /instagram/deauthorize` - Deauthorize callback bridged into AIHQ tenant channel state
- `GET/POST /instagram/data-deletion` - Data deletion acknowledgement and status page

## Requirements
- Node.js 18+ (recommended 20+)

## Install
```bash
npm install
```
