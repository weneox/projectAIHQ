FROM node:20-alpine

# Build from the monorepo root so the workspace loader and local
# shared-contracts package resolve the same way they do in local and CI runs.
WORKDIR /app

COPY shared-contracts ./shared-contracts
COPY scripts ./scripts
COPY meta-bot-backend/package*.json ./meta-bot-backend/

WORKDIR /app/meta-bot-backend
RUN npm ci

COPY meta-bot-backend/. .

ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
