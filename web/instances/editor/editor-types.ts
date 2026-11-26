import type { EditableExecutionTarget } from "../../../src/gateway/wire/web-types.ts";
import type { TargetErrorText } from "../target-errors/target-error.ts";

/** What opens the editor in place of a configuration that could not be read. */
export type ConfigLoadFailure = { id: string; label: string; loadError: string };
export type EditorConfig = EditableExecutionTarget | ConfigLoadFailure;

/** The instance being typed: text fields as the inputs hold them. */
export type DraftForm = {
  id: string;
  label: string;
  labelTouched: boolean;
  tags: string;
  local: boolean;
  sshCommand: string;
  python: string;
  pythonIndexUrl: string;
  cwd: string;
  executionTimeoutMs: number | undefined;
};

/** The instance as POST/PATCH sends it. */
export type TargetPayload = {
  id: string;
  label: string;
  tags: string[];
  local: boolean;
  cwd: string;
  sshCommand?: string;
  python?: string;
  pythonIndexUrl?: string;
  executionTimeoutMs?: number;
};

/** The draft's connection test and interpreter check; each result belongs to the draft (`key`) it was asked for. */
export type ConnectionProbe =
  | { key: string; status: "pending" }
  | { key: string; status: "success"; hostname: string; platform: string; candidates: string[] }
  | { key: string; status: "error"; error: TargetErrorText };
export type PythonCheck =
  | { key: string; status: "pending" }
  | { key: string; status: "success"; path: string; version: string }
  | { key: string; status: "error"; error: TargetErrorText };

/** What `useDraftInspection` hands the fields. */
export type DraftInspection = {
  connection: { local: true } | { local: false; sshCommand: string } | null;
  probed: ConnectionProbe | null;
  checked: PythonCheck | null;
  testConnection: () => Promise<void>;
  checkPython: (path: string) => Promise<void>;
};
