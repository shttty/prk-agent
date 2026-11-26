import type { TodoStatus } from "./todo-types.ts";

export const SYMBOLS: Record<string, TodoStatus | undefined> = { "▸": "in_progress", "✓": "completed", "✕": "cancelled", "!": "blocked", "○": "pending" };

export const HEADER = /^([IVXLCDM]+)\. (.+) {2}(\d+)\/(\d+)$/;

export const FOLD = /^✓ (\d+) completed$/;

export const TITLE = /^Todo (\d+)\/(\d+)$/;

export const OWNER = "· ";

export const ROMAN: readonly (readonly [number, string])[] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
