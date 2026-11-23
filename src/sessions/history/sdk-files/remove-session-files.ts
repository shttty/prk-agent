import type { HistoryContext } from "../history-types.ts";
import { getRecord } from "../catalog/find-record.ts";
import { invalid } from "../reject-invalid-history.ts";
import { unlinkSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

export function removeSessionFiles(ctx: HistoryContext, sessionId: string): void {
  const { records, directory } = ctx;
  const record = getRecord(ctx, sessionId);
  if (record === undefined) invalid(`unknown session ${JSON.stringify(sessionId)}`);
  const file = resolve(record.sessionFile);
  const relativePath = relative(directory, file);
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    invalid("session file outside directory");
  }
  unlinkSync(file);
  records.delete(sessionId);
}
