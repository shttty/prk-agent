
/** `path` is `root` or lies below it; both absolute and normalized. */
export const within = (path: string, root: string) => path === root || path.startsWith(root === "/" ? "/" : `${root}/`);
