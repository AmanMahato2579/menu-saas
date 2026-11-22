import { runDailyReset } from "../src/lib/daily-reset";

async function main() {
  const result = await runDailyReset();
  console.log("[daily-reset] done");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[daily-reset] failed", error);
  process.exit(1);
});
