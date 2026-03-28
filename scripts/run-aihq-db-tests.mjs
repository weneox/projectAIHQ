import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = new URL("../", import.meta.url);
const rootPath = fileURLToPath(rootDir);

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const dockerCommand = process.platform === "win32" ? "docker.exe" : "docker";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function isTruthyFlag(value) {
  const normalized = s(value).toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldUseShell(command, options = {}) {
  if (typeof options.shell === "boolean") return options.shell;
  if (process.platform !== "win32") return false;

  const normalized = s(command).toLowerCase();
  return normalized.endsWith(".cmd") || normalized.endsWith(".bat");
}

function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: s(options.cwd) || rootPath,
      stdio: options.stdio || "inherit",
      shell: shouldUseShell(command, options),
      windowsHide: true,
      env: {
        ...process.env,
        ...(options.env || {}),
      },
    });

    child.on("error", reject);
    child.on("close", (code) => {
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
    await run(dockerCommand, ["--version"], {
      stdio: "ignore",
      shell: false,
    });
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
      await run(
        dockerCommand,
        ["exec", containerName, "pg_isready", "-U", "aihq_test", "-d", "aihq_test"],
        {
          stdio: "ignore",
          shell: false,
        }
      );
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

  await run(
    dockerCommand,
    [
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
    ],
    { shell: false }
  );

  try {
    await waitForPostgres(containerName);
    await fn(databaseUrl);
  } finally {
    await run(dockerCommand, ["rm", "-f", containerName], {
      stdio: "ignore",
      shell: false,
    }).catch(() => {});
  }
}

async function runAihqDbSuite(databaseUrl) {
  const env = {
    DATABASE_URL: databaseUrl,
  };

  if (!isTruthyFlag(process.env.AIHQ_DB_HARNESS_SKIP_MIGRATE)) {
    try {
      await run(npmCommand, ["run", "migrate:ai-hq-backend"], {
        env,
        shell: process.platform === "win32",
      });
    } catch (error) {
      throw new Error(
        `[db-harness][migration_failed] AI HQ migrations failed before the DB-backed suite could run. Check DATABASE_URL, database reachability, and migration safety.\n${String(error?.message || error)}`
      );
    }
  }

  try {
    await run(npmCommand, ["run", "test:integration:db", "-w", "ai-hq-backend"], {
      env,
      shell: process.platform === "win32",
    });
  } catch (error) {
    throw new Error(
      `[db-harness][test_failed] AI HQ DB-backed tests failed after migrations. This is a code or schema regression unless the backing database became unavailable.\n${String(error?.message || error)}`
    );
  }
}

try {
  if (s(process.env.DATABASE_URL)) {
    await runAihqDbSuite(process.env.DATABASE_URL);
  } else if (await canUseDocker()) {
    await withEphemeralPostgres(runAihqDbSuite);
  } else {
    console.error(
      "[db-harness][external_infra_unavailable] DATABASE_URL is not set and Docker is unavailable. Set DATABASE_URL or install Docker to run the AI HQ DB integration harness."
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(String(error?.message || error));
  process.exitCode = 1;
}
