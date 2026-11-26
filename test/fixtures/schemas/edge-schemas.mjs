const many = (count, make) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`field${String(index).padStart(3, "0")}`, make(index)]));

/** Hand-made schemas for the cases a tool author can reach but the repository's own tools do not: each entry is [name, schema]. */
export const EDGE_SCHEMAS = [
  ["recursive $ref", { $ref: "#/$defs/Tree", $defs: { Tree: { type: "object", required: ["value"], properties: { value: { type: "integer" }, children: { type: "array", items: { $ref: "#/$defs/Tree" } } } } } }],
  ["shared $ref used twice", { type: "object", properties: { from: { $ref: "#/definitions/Point" }, to: { $ref: "#/definitions/Point" } }, required: ["from"], definitions: { Point: { type: "object", properties: { x: { type: "number", minimum: 0 }, y: { type: "number" } }, required: ["x", "y"] } } }],
  ["remote and dangling $ref", { type: "object", properties: { a: { $ref: "https://example.com/a.json" }, b: { $ref: "#/$defs/missing" } } }],
  ["anyOf null", { type: "object", required: ["limit"], properties: { limit: { anyOf: [{ type: "integer", minimum: 1, maximum: 50 }, { type: "null" }], default: 10, description: "Rows to return" }, label: { type: ["string", "null"], maxLength: 20 } } }],
  ["oneOf objects", { type: "object", properties: { target: { oneOf: [{ type: "object", required: ["id"], properties: { id: { type: "string" } } }, { type: "object", required: ["path", "line"], properties: { path: { type: "string", format: "uri-reference" }, line: { type: "integer" } } }] } } }],
  ["tuple", { type: "object", required: ["range"], properties: { range: { type: "array", prefixItems: [{ type: "integer" }, { type: "integer" }], minItems: 2, maxItems: 2 }, legacy: { type: "array", items: [{ type: "string" }, { type: "boolean" }] }, open: { type: "array" } } }],
  ["allOf of objects", { allOf: [{ type: "object", required: ["id"], properties: { id: { type: "string", minLength: 1 } } }, { $ref: "#/$defs/Audit" }], $defs: { Audit: { type: "object", properties: { by: { type: "string" }, at: { type: "string", format: "date-time" } }, required: ["by"] } } }],
  ["allOf with a non-object", { type: "object", properties: { name: { allOf: [{ type: "string" }, { minLength: 2 }] } } }],
  ["enum with a float", { type: "object", properties: { ratio: { enum: [0.25, 0.5, 1] }, mode: { enum: ["fast", "slow", null] }, level: { enum: [1, 2, 3], default: 2 }, flag: { const: true }, shape: { enum: [[1, 2], "x"] } } }],
  ["additionalProperties", { type: "object", properties: { env: { type: "object", additionalProperties: { type: "string" }, description: "Environment" }, tags: { type: "object", additionalProperties: true }, mixed: { type: "object", required: ["id"], properties: { id: { type: "string" }, note: { type: "string" } }, additionalProperties: { type: "integer" } }, closed: { type: "object", properties: {}, additionalProperties: false } } }],
  ["top level open object", { type: "object", required: ["id"], properties: { id: { type: "string" } }, additionalProperties: { type: "string" } }],
  ["property names that are not Python names", { type: "object", required: ["max-results"], properties: { "max-results": { type: "integer" }, from: { type: "string" }, class: { type: "boolean" }, ok_name: { type: "string" } } }],
  ["draft-04 exclusive bounds", { type: "object", properties: { score: { type: "number", minimum: 0, exclusiveMinimum: true, maximum: 1, exclusiveMaximum: true }, sizes: { type: "array", items: { type: "string" }, uniqueItems: true, minItems: 1, deprecated: true } } }],
  ["constraints on a pydantic optional", { type: "object", properties: { size: { anyOf: [{ type: "integer", minimum: 1, maximum: 9, multipleOf: 2 }, { type: "null" }], default: null } } }],
  ["nested objects and a long description", { type: "object", properties: { outer: { type: "object", description: "First line\nsecond line", properties: { inner: { type: "object", properties: { deep: { type: "array", items: { type: "object", properties: { leaf: { type: "string" } }, required: ["leaf"] } } } } } } } }],
  ["tags overflow the budget", { type: "object", properties: many(300, () => ({ type: "integer", minimum: 1, maximum: 100, default: 20 })) }],
  ["too long to render", { type: "object", properties: many(400, () => ({ type: "string", description: "x".repeat(100) })) }],
  ["boolean schemas", { type: "object", properties: { anything: true, nothing: false, bare: {} } }],
];
