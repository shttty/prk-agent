/** One row of a parsed unified diff. */
export type DiffRow = { kind: "add" | "del" | "ctx" | "gap"; label: string; text: string };

/** A parsed unified diff: its rows, the added and deleted line counts and the widest line label. */
export type ParsedDiff = { rows: DiffRow[]; add: number; del: number; width: number };
