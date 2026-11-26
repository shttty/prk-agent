export const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
