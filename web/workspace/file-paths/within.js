
/** `path` is `root` or lies below it; both absolute and normalized. */
export const within = (path, root) => path === root || path.startsWith(root === "/" ? "/" : `${root}/`);
