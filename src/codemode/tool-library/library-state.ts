import type { ToolsOptions } from "../../config/tools/tools-options.ts";
import type { StoredTool, Availability } from "./library-types.ts";

export interface ToolLibraryContext {
  readonly directory: string;
  readonly file: string;
  records: StoredTool[];
  readonly listeners: Set<() => void>;
  readonly availability: Map<string, Map<string, Availability>>;
  readonly options: ToolsOptions;
  readonly now: () => number;
}
