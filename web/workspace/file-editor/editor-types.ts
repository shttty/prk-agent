import type { PromptReport } from "../../../src/gateway/wire/web-types.ts";
import type { FileStore } from "../file-store/file-store-types.ts";

/** What the unified-diff request replies with (a monitor diff of one file). */
export type DiffReply = { text?: string; kind?: string; truncated?: boolean };

/** What a file or diff tab and panel in the workspace dock need from the page (see EditorContext). */
export type EditorContextValue = {
  store: FileStore;
  requestClose: (id: string, path: string) => void;
  loadDiff: (path: string) => Promise<DiffReply>;
  loadPrompt: () => Promise<PromptReport>;
  /** One whole part of the latest request: `tools`, `raw`, or `messages?offset=N&limit=N`. */
  loadPromptPart: <Part>(part: string) => Promise<Part>;
  closeTab: (id: string) => void;
};
