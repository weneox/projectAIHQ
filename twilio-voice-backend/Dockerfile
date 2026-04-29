FROM node:20-alpine

# Build from the monorepo root so the workspace loader and local
# shared-contracts package resolve the same way they do in local and CI runs.
WORKDIR /app

COPY shared-contracts ./shared-contracts
COPY scripts ./scripts
COPY twilio-voice-backend/package*.json ./twilio-voice-backend/

WORKDIR /app/twilio-voice-backend
RUN npm ci

COPY twilio-voice-backend/. .

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]
