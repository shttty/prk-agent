/** One successful `write` or `edit` of a file by the agent, in session order. */
export interface FileEdit {
  readonly path: string;
  /** Pi-format edit diff (`<+|-| ><number> <text>` lines), or synthesized the same way for a write. */
  readonly diff: string;
  readonly added: number;
  readonly removed: number;
}
