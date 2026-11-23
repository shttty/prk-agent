export async function flushUi(_ctx, operation) {
  let failure;
  while (operation.ui.size) {
    const batch = [...operation.ui];
    operation.ui.clear();
    for (const result of await Promise.allSettled(batch)) {
      if (result.status === "rejected") failure ??= result.reason;
    }
  }
  if (failure) throw failure;
}
