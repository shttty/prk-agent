/** One row of a directory listing (what the Gateway's file listing returns per entry). */
export type DirEntry = { name: string; path: string; type: "directory" | "file"; size?: number; mimetype?: string; last_modified?: string };
