export const errorOf = (value: unknown): Error => value instanceof Error ? value : new Error(String(value));
