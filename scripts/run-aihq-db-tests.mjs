import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = new URL("../", import.meta.url);
const rootPath = fileURLToPath(rootDir);

function s(v, d = "") {
  return String(v ?? d).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: s(options.cwd) || rootPath,
      stdio: options.stdio || "inherit",
      shell: false,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function canUseDocker() {
  try {
    await run("docker", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForPostgres(containerName, { retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await run("docker", ["exec", containerName, "pg_isready", "-U", "aihq_test", "-d", "aihq_test"], {
        stdio: "ignore",
      });
      return;
    } catch {
      await sleep(delayMs);
    }
  }
  throw new Error("postgres_container_not_ready");
}

async function withEphemeralPostgres(fn) {
  const port = await getFreePort();
  const containerName = `aihq-test-db-${randomUUID().slice(0, 8)}`;
  const databaseUrl = `postgresql://aihq_test:aihq_test@127.0.0.1:${port}/aihq_test`;

  await run("docker", [
    "run",
    "--rm",
    "-d",
    "--name",
    containerName,
    "-e",
    "POSTGRES_USER=aihq_test",
    "-e",
    "POSTGRES_PASSWORD=aihq_test",
    "-e",
    "POSTGRES_DB=aihq_test",
    "-p",
    `${port}:5432`,
    "postgres:16",
  ]);

  try {
    await waitForPostgres(containerName);
    await fn(databaseUrl);
  } finally {
    await run("docker", ["rm", "-f", containerName], { stdio: "ignore" }).catch(() => {});
  }
}

async function runAihqDbSuite(databaseUrl) {
  const env = {
    DATABASE_URL: databaseUrl,
  };

  await run("npm", ["run", "migrate:ai-hq-backend"], { env });
  await run("npm", ["run", "test:integration:db", "-w", "ai-hq-backend"], { env });
}

if (s(process.env.DATABASE_URL)) {
  await runAihqDbSuite(process.env.DATABASE_URL);
} else if (await canUseDocker()) {
  await withEphemeralPostgres(runAihqDbSuite);
} else {
  console.error(
    "DATABASE_URL is not set and Docker is unavailable. Set DATABASE_URL or install Docker to run the AI HQ DB integration harness."
  );
  process.exitCode = 1;
}
