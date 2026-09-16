import { execSync } from "node:child_process";

const BASELINE = "20260916000000_init";

function sh(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`[prepare-db] command failed: ${cmd}`);
    process.exit(err.status ?? 1);
  }
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

console.log("[prepare-db] syncing schema (additive only, existing data untouched): prisma db push");
sh("npx prisma db push --skip-generate");

console.log(`[prepare-db] recording baseline as applied: ${BASELINE}`);
sh(`npx prisma migrate resolve --applied ${BASELINE}`);

console.log("[prepare-db] final: prisma migrate deploy");
sh("npx prisma migrate deploy");

console.log("[prepare-db] database ready");
process.exit(0);