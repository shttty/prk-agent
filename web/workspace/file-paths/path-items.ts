
/** Breadcrumb for an absolute POSIX path: every ancestor is a target, the last item is the current directory. */
export function pathItems(path: string) {
  const parts = path.split("/").filter(Boolean);
  return [{ label: "/", path: "/" }, ...parts.map((name, index) => ({ label: name, path: `/${parts.slice(0, index + 1).join("/")}` }))];
}
