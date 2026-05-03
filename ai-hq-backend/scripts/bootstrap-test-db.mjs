import pg from "pg";

const { Client } = pg;

function s(value = "", fallback = "") {
  return String(value ?? fallback).trim();
}

function bool(value = "") {
  return ["1", "true", "yes", "y", "on"].includes(s(value).toLowerCase());
}

function quoteIdent(value = "") {
  const ident = s(value);
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Unsafe database identifier: ${ident || "(empty)"}`);
  }
  return `"${ident.replace(/"/g, '""')}"`;
}

function resolveAdminUrl(targetUrl = "") {
  const url = new URL(targetUrl);
  const dbName = url.pathname.replace(/^\//, "");
  url.pathname = "/postgres";
  return {
    adminUrl: url.toString(),
    dbName,
  };
}

const targetUrl = s(process.env.AIHQ_TEST_DATABASE_URL || process.env.DATABASE_URL);

if (!targetUrl) {
  console.error("AIHQ_TEST_DATABASE_URL or DATABASE_URL is required.");
  process.exit(1);
}

const { adminUrl, dbName } = resolveAdminUrl(targetUrl);
if (!/^aihq(_|-)?test/i.test(dbName) && !bool(process.env.AIHQ_TEST_DB_ALLOW_NON_TEST_NAME)) {
  console.error(
    `Refusing to bootstrap non-test database "${dbName}". Use an aihq_test* database name or set AIHQ_TEST_DB_ALLOW_NON_TEST_NAME=true.`
  );
  process.exit(1);
}

const admin = new Client({ connectionString: adminUrl });
await admin.connect();

try {
  if (bool(process.env.AIHQ_TEST_DB_RESET)) {
    await admin.query(
      `
      select pg_terminate_backend(pid)
      from pg_stat_activity
      where datname = $1
        and pid <> pg_backend_pid()
      `,
      [dbName]
    );
    await admin.query(`drop database if exists ${quoteIdent(dbName)}`);
  }

  await admin.query(`create database ${quoteIdent(dbName)}`).catch((error) => {
    if (error?.code !== "42P04") throw error;
  });

  console.log(
    JSON.stringify({
      ok: true,
      database: dbName,
      reset: bool(process.env.AIHQ_TEST_DB_RESET),
    })
  );
} finally {
  await admin.end().catch(() => {});
}
