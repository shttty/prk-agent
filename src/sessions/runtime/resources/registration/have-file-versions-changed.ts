export function fileVersionsChanged(loaded: ReadonlyMap<string, string>, current: ReadonlyMap<string, string>): boolean {
  return loaded.size !== current.size || [...loaded].some(([path, version]) => current.get(path) !== version);
}
