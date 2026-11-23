
// Pure logic for tool-row bodies (no React), so node tests can import it directly.

/** Lines shown before a code/output block folds behind "show the rest". */
export const TOOL_FOLD_LINES = 20;

export const FILE_TOOLS = new Set(["read", "write", "edit"]);

// Pi's read tool appends one of these after the file text: truncation notice, user-limit notice; or, when even the
// first line is too long, the notice is the whole output.
export const READ_TAIL = /\n\n(\[(?:Showing lines \d+-\d+ of \d+[^\]\n]*|\d+ more lines in file\.[^\]\n]*)\])$/;

export const READ_ONLY_NOTICE = /^\[Line \d+ is [^\]\n]*\]$/;
