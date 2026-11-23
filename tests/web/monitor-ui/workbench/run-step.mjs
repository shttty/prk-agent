export async function runStep(ctx, name, run) {
  if (process.env.PRK_STEP && !name.includes(process.env.PRK_STEP)) return;
  const t0 = Date.now();
  await run();
  ctx.done.push(name);
  console.log(`PASS ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
