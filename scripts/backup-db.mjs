// Backup the MenuQR Postgres database to backups/menu-saas-<timestamp>.dump
// (custom pg_dump format, restorable with scripts/restore-db.mjs).
//
// Usage:
//   node scripts/backup-db.mjs                 # dockerized Postgres (menu-saas-postgres)
//   node scripts/backup-db.mjs --host=...      # direct host pg_dump instead of docker
//
// Env overrides: PG_USER, PG_DB, PG_PASSWORD, BACKUP_DIR, KEEP (number of backups to keep).

import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PG_USER = process.env.PG_USER ?? "postgres";
const PG_DB = process.env.PG_DB ?? "menu-saas";
const PG_PASSWORD = process.env.PG_PASSWORD ?? "postgres";
const PG_CONTAINER = process.env.PG_CONTAINER ?? "menu-saas-postgres";
const BACKUP_DIR = process.env.BACKUP_DIR ?? "backups";
const KEEP = Number(process.env.KEEP ?? 14);

const time = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = join(BACKUP_DIR, `menu-saas-${time}.dump`);

mkdirSync(BACKUP_DIR, { recursive: true });

const docker = !process.argv.some((a) => a.startsWith("--host="));

let cmd;
if (docker) {
  // Run pg_dump inside the running Postgres container (no local pg tools needed).
  const inContainer = "/tmp/menu-saas-backup.dump";
  cmd = `docker exec ${PG_CONTAINER} pg_dump -U ${PG_USER} -d ${PG_DB} -Fc -f ${inContainer} && docker cp ${PG_CONTAINER}:${inContainer} "${outFile}" && docker exec ${PG_CONTAINER} rm -f ${inContainer}`;
} else {
  const host = process.argv.find((a) => a.startsWith("--host=")).split("=")[1];
  cmd = `PGPASSWORD=${PG_PASSWORD} pg_dump -h ${host} -U ${PG_USER} -d ${PG_DB} -Fc -f "${outFile}"`;
}

console.log(`[backup-db] writing ${outFile}`);
try {
  execSync(cmd, { stdio: "inherit", env: { ...process.env, PGPASSWORD: PG_PASSWORD } });
} catch (err) {
  console.error("[backup-db] backup failed");
  process.exit(err.status ?? 1);
}

// Prune old backups.
const files = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("menu-saas-") && f.endsWith(".dump")).sort();
while (files.length > KEEP) {
  rmSync(join(BACKUP_DIR, files.shift()), { force: true });
}
console.log(`[backup-db] kept ${Math.min(files.length, KEEP)} of last backups in ${BACKUP_DIR}`);
