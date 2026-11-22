// Restore a MenuQR Postgres backup taken by scripts/backup-db.mjs.
//
// DESTRUCTIVE: replaces the current database contents. Requires --file and --yes.
//
// Usage:
//   node scripts/restore-db.mjs --file backups/menu-saas-XXXX.dump --yes
//   node scripts/restore-db.mjs --file backups/menu-saas-XXXX.dump --yes --host=...
//
// Env overrides: PG_USER, PG_DB, PG_PASSWORD.

import { execSync } from "node:child_process";

const PG_USER = process.env.PG_USER ?? "postgres";
const PG_DB = process.env.PG_DB ?? "menu-saas";
const PG_PASSWORD = process.env.PG_PASSWORD ?? "postgres";
const PG_CONTAINER = process.env.PG_CONTAINER ?? "menu-saas-postgres";

const fileArg = process.argv.find((a) => a.startsWith("--file="));
const hostArg = process.argv.find((a) => a.startsWith("--host="));
const confirmed = process.argv.includes("--yes");

if (!fileArg || !confirmed) {
  console.error("[restore-db] usage: node scripts/restore-db.mjs --file <dump> --yes [--host=...]");
  process.exit(1);
}

const file = fileArg.split("=")[1];

console.log(`[restore-db] RESTORING ${file} INTO ${PG_DB} — this overwrites current data.`);

const docker = !hostArg;

let cmd;
if (docker) {
  const inContainer = "/tmp/menu-saas-restore.dump";
  cmd = `docker cp "${file}" ${PG_CONTAINER}:${inContainer} && docker exec ${PG_CONTAINER} pg_restore --clean --if-exists --no-owner -U ${PG_USER} -d ${PG_DB} ${inContainer} && docker exec ${PG_CONTAINER} rm -f ${inContainer}`;
} else {
  const host = hostArg.split("=")[1];
  cmd = `PGPASSWORD=${PG_PASSWORD} pg_restore --clean --if-exists --no-owner -h ${host} -U ${PG_USER} -d ${PG_DB} "${file}"`;
}

try {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, PGPASSWORD: PG_PASSWORD } });
} catch (err) {
  console.error("[restore-db] restore failed");
  process.exit(err.status ?? 1);
}
console.log("[restore-db] restore complete");
