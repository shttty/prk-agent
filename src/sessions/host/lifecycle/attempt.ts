export async function attempt(failures: unknown[], action: () => unknown): Promise<void> {
  try { await action(); } catch (error) { failures.push(error); }
}
