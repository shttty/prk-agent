const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function waitForSessionCondition(check, name) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) { if (await check()) return; await sleep(20); }
  throw new Error(`Timed out: ${name}`);
}
