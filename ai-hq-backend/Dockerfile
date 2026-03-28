# Use official Playwright image with Chromium + required Linux deps already installed.
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

# Build from the monorepo root so the workspace loader and local
# shared-contracts package resolve the same way they do in local and CI runs.
WORKDIR /app

COPY shared-contracts ./shared-contracts
COPY scripts ./scripts
COPY ai-hq-backend/package*.json ./ai-hq-backend/

WORKDIR /app/ai-hq-backend
RUN npm ci

COPY ai-hq-backend/. .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
