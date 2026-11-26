import type { ToolContentPreview } from "../../../../src/gateway/wire/web-types.ts";

/** One tool call of the selected session, from live events or rebuilt from history. */
export type ToolRun = {
  key: string;
  sessionId: string;
  toolName: string;
  operationId: string;
  startedAt: string | null;
  endedAt: string | null;
  code: string;
  output: string;
  result: string;
  isError: boolean;
  unknown: boolean;
  ended: boolean;
  inputPreview?: ToolContentPreview;
  outputPreview?: ToolContentPreview;
  /** What the tool reported so far / finally: any JSON the tool returned. */
  partialResult?: unknown;
  resultValue?: unknown;
};
