import type { PrkConfig } from "../../config/document/document-types.ts";

export type Options = PrkConfig["toolContent"];
export interface ToolContentPreview {
  readonly preview: string;
  readonly bytes: number;
  readonly lines: number;
  readonly version: string;
  readonly imageCount?: number;
}
export interface ToolContent {
  readonly sessionId: string;
  readonly toolCallId: string;
  readonly args?: unknown;
  readonly argumentsError?: string;
  readonly result?: unknown;
  readonly inputVersion?: string;
  readonly outputVersion?: string;
}
