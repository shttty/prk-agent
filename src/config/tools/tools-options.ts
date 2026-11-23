export interface ToolsOptions {
  readonly staging: { readonly capacity: number; readonly idleDays: number };
  readonly promoted: { readonly capacity: number; readonly idleDays: number };
  readonly promotion: { readonly distinctSessions: number };
  readonly archive: { readonly capacity: number };
  readonly versionsKept: number;
}
export const DEFAULT_TOOLS_OPTIONS: ToolsOptions = Object.freeze({
  staging: Object.freeze({ capacity: 20, idleDays: 14 }),
  promoted: Object.freeze({ capacity: 15, idleDays: 14 }),
  promotion: Object.freeze({ distinctSessions: 3 }),
  archive: Object.freeze({ capacity: 200 }),
  versionsKept: 5,
});
