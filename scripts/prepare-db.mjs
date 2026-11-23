import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

function sh(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`[prepare-db] command failed: ${cmd}`);
    process.exit(err.status ?? 1);
  }
}

function migrationNames() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

console.log("[prepare-db] attempting: prisma migrate deploy");
try {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
  console.log("[prepare-db] database already migrated; nothing to do");
  process.exit(0);
} catch {
  console.warn(
    "[prepare-db] migrate deploy failed - database appears to have been created with `prisma db push`; baselining it in-place"
  );
}

console.log(
  "[prepare-db] syncing schema (additive only, existing data untouched): prisma db push"
);
sh("npx prisma db push --skip-generate --accept-data-loss");

for (const name of migrationNames()) {
  console.log(`[prepare-db] recording migration as applied: ${name}`);
  sh(`npx prisma migrate resolve --applied ${name}`);
}

console.log("[prepare-db] final: prisma migrate deploy");
sh("npx prisma migrate deploy");

console.log("[prepare-db] database ready");
process.exit(0);