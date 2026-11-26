/**
 * What Pi's schemaToType output says about objects, read back from its TypeScript text: for every property path, whether it is optional and
 * which constraint tags its comment carries. Pi's output is a closed little grammar (objects, Array<T>, tuples, unions, intersections), so a
 * small parser is enough; the ported renderer never goes through this text.
 */
export function readPiFacts(text) {
  const tokens = [...text.matchAll(/\/\/ ?([^\n]*)|"(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*|-?\d[\w.+-]*|[{}[\]()<>;:?|&,]/g)].map((match) => (match[0].startsWith("//") ? { comment: match[1].trim() } : { text: match[0] }));
  let at = 0;
  const peek = () => tokens[at]?.text;
  const take = (expected) => { const token = tokens[at++]?.text; if (expected !== undefined && token !== expected) throw new Error(`expected ${expected} at ${at}, got ${token}`); return token; };
  const parseUnion = () => { const items = [parseIntersection()]; while (peek() === "|") { take(); items.push(parseIntersection()); } return items.length === 1 ? items[0] : { kind: "union", items }; };
  const parseIntersection = () => { const items = [parseAtom()]; while (peek() === "&") { take(); items.push(parseAtom()); } return items.length === 1 ? items[0] : { kind: "intersection", items }; };
  function parseAtom() {
    const token = take();
    let node;
    if (token === "(") { node = parseUnion(); take(")"); }
    else if (token === "{") node = parseObject();
    else if (token === "[") { const items = []; while (peek() !== "]") { items.push(parseUnion()); if (peek() === ",") take(); } take("]"); node = { kind: "tuple", items }; }
    else if (token === "Array" && peek() === "<") { take(); node = { kind: "array", item: parseUnion() }; take(">"); }
    else node = { kind: "primitive" };
    while (peek() === "[" && tokens[at + 1]?.text === "]") { take(); take(); node = { kind: "array", item: node }; }
    return node;
  }
  function parseObject() {
    const members = [];
    let comments = [];
    while (peek() !== "}") {
      if (tokens[at].comment !== undefined) { comments.push(tokens[at++].comment); continue; }
      let key = null;
      if (peek() === "[") { while (take() !== "]"); } else { const raw = take(); key = raw.startsWith('"') ? JSON.parse(raw) : raw; }
      const optional = peek() === "?" ? (take(), true) : false;
      take(":");
      members.push({ key, optional, tags: comments.findLast((line) => line.startsWith("@")) ?? "", type: parseUnion() });
      if (peek() === ";") take(); // a JSON object literal type, {"a":1}, has no terminator
      comments = [];
    }
    take("}");
    return { kind: "object", members };
  }
  const facts = new Map();
  const add = (path, fact) => facts.set(path, [...(facts.get(path) ?? []), JSON.stringify(fact)].sort());
  const walk = (node, path) => {
    if (node.kind === "array") walk(node.item, `${path}[]`);
    else if (node.kind === "tuple") node.items.forEach((item, index) => walk(item, `${path}[${index}]`));
    else if (node.kind === "union") node.items.forEach((item) => walk(item, path));
    else if (node.kind === "intersection") walk(mergeObjects(node.items), path);
    else if (node.kind === "object") {
      for (const member of node.members) {
        if (member.key === null) { walk(member.type, `${path}[*]`); continue; }
        add(`${path}.${member.key}`, { optional: member.optional, tags: member.tags });
        walk(member.type, `${path}.${member.key}`);
      }
    }
  };
  // An intersection of objects is one object: a property is required when any part requires it.
  const mergeObjects = (parts) => {
    const members = new Map();
    for (const part of parts.filter((item) => item.kind === "object")) {
      for (const member of part.members) {
        const old = members.get(member.key);
        members.set(member.key, old ? { ...old, optional: old.optional && member.optional, tags: old.tags || member.tags } : member);
      }
    }
    return { kind: "object", members: [...members.values()] };
  };
  walk(parseUnion(), "");
  return facts;
}
