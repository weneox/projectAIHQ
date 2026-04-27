const commands = [
  ["AI HQ frontend", "npm run build:ai-hq-frontend", "ai-hq-frontend/dist"],
  ["Neox frontend", "npm run build:neox-frontend", "neox-frontend/dist"],
  ["AI HQ backend", "npm run build:ai-hq-backend", "Railway workspace"],
  ["Meta bot backend", "npm run build:meta-bot-backend", "Railway workspace"],
  [
    "Twilio voice backend",
    "npm run build:twilio-voice-backend",
    "Railway workspace",
  ],
  ["Release gate", "npm run build:all", "all workspaces"],
];

console.error("Root npm run build is intentionally disabled.");
console.error(
  "This monorepo has multiple deploy targets; choose the target-specific command:"
);

for (const [target, command, output] of commands) {
  console.error(`- ${target}: ${command} (${output})`);
}

process.exit(1);
