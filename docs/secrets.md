# Secrets policy

This repository is designed so that real secrets do not live in tracked files.

## Rules

- Commit only sanitized examples such as [`.env.example`](/C:/Users/bagir/OneDrive/Desktop/projectAIHQ/.env.example).
- Keep real `.env`, `.env.local`, `.env.development.local`, and similar files untracked.
- Store production secrets only in the deployment platform's secrets or environment settings.
- Store Codex or cloud-agent secrets only in the platform secret store, not in repo files.
- Never paste live tokens, passcodes, hashes, private keys, or database URLs into Markdown, source files, or committed examples.

## Local development

- Prefer `.env.local` or workspace-local `.env.local` files for private development values.
- Use placeholder values in examples and docs.
- Disable optional features locally when you do not have the corresponding secret.

## Production and deploys

- Provision secrets through the host platform, CI secret manager, or deployment environment configuration.
- Rotate any secret immediately if it was ever committed, copied into a tracked file, or exposed in logs.
- Treat database URLs, session secrets, internal tokens, VAPID private keys, provider API keys, OAuth client secrets, and webhook tokens as sensitive.

## Codex and agent safety

- Do not keep live secrets in workspace files that an agent can casually inspect.
- Inject secrets through secure environment configuration before running commands.
- Prefer short-lived or scoped credentials for local agent sessions.
- Clear temporary shell-exported secrets when you finish a session.
