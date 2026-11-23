export function renameInstanceIds(document) {
  if (!Array.isArray(document?.instances) || !document.instances.some(hasOldId)) return document;
  return { ...document, instances: document.instances.map((entry, index) => {
    if (!hasOldId(entry)) return entry;
    if (Object.hasOwn(entry, "id")) throw new Error(`instances[${index}] has both name and id; keep only id before migrating`);
    const { name, ...fields } = entry;
    return { id: name, ...fields };
  }) };
}

function hasOldId(entry) {
  return entry !== null && typeof entry === "object" && !Array.isArray(entry) && Object.hasOwn(entry, "name");
}
