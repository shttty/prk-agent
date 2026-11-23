
export function setPath(object, key, value) {
  const parts = key.split(".");
  const next = structuredClone(object ?? {});
  let node = next;
  for (const part of parts.slice(0, -1)) { if (node[part] === null || typeof node[part] !== "object") node[part] = {}; node = node[part]; }
  node[parts.at(-1)] = value;
  return next;
}
