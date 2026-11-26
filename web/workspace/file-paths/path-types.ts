/** One row of a directory listing (what the Gateway's file listing returns per entry). */
export type DirEntry = { name: string; path: string; type: string; size?: number; mimetype?: string; last_modified?: string };
