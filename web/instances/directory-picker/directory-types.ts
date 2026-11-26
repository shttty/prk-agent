import type { AbsoluteListing } from "../../../src/gateway/wire/web-types.ts";

/** What the picker shows: the current absolute target path and its listing. */
export type DirectoryState = {
  path: string;
  atRoot: boolean;
  entries: AbsoluteListing["entries"];
  truncated: boolean;
  loading: boolean;
  error: string;
};
