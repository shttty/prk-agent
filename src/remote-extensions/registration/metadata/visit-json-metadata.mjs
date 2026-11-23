export function visit(item, label) {
  if (item[0] === "undefined" || item[0] === "error") throw new TypeError(`${label} must be JSON-only`);
  if (item[0] === "array") item[1].forEach((child) => visit(child, label));
  if (item[0] === "object") item[1].forEach((entry) => visit(entry[1], label));
}
