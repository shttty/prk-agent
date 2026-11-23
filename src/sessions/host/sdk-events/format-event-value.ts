export const cloneEventValue = (value: unknown): unknown => {
  try { return structuredClone(value); }
  catch { return String(value); }
};
