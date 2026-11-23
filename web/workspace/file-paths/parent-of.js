
/** Parent of an absolute POSIX path; "/" is its own parent. */
export const parentOf = (path) => path.slice(0, path.lastIndexOf("/")) || "/";
