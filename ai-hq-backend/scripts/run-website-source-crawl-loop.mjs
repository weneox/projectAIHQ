import { spawn } from "node:child_process";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function n(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "../scripts/workspace-module-loader.mjs",
        "scripts/run-website-source-crawl-once.mjs",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        code: 1,
        stdout: stdout.trim(),
        stderr: s(error?.message || error),
      });
    });
  });
}

async function main() {
  const intervalMs = Math.max(
    5000,
    n(process.env.WEBSITE_SOURCE_CRAWL_INTERVAL_MS, 30000)
  );

  const idleIntervalMs = Math.max(
    intervalMs,
    n(process.env.WEBSITE_SOURCE_CRAWL_IDLE_INTERVAL_MS, intervalMs)
  );

  const errorIntervalMs = Math.max(
    5000,
    n(process.env.WEBSITE_SOURCE_CRAWL_ERROR_INTERVAL_MS, 15000)
  );

  console.log(JSON.stringify({
    ok: true,
    worker: "website-source-crawl-loop",
    intervalMs,
    idleIntervalMs,
    errorIntervalMs,
  }));

  while (true) {
    const result = await runOnce();
    const idle = result.stdout.includes("no_queued_website_crawl_run");

    if (!result.ok) {
      await sleep(errorIntervalMs);
      continue;
    }

    await sleep(idle ? idleIntervalMs : intervalMs);
  }
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    worker: "website-source-crawl-loop",
    error: s(error?.message || error),
  }));
  process.exitCode = 1;
});
