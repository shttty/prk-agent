
/** `dir` is an absolute POSIX directory; the root is "/" and must not double its slash. */
export const joinPath = (dir, name) => (dir === "/" ? `/${name}` : `${dir}/${name}`);
