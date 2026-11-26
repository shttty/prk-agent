// Ported from @earendil-works/pi-codemode 1.6.0 dist/declarations.js (constraintTags, TAG_KEYWORDS, MAX_TAG_CHARS).
// Re-check the keyword list and the bound rules against it whenever Pi is upgraded; test/unit/session/schema-parity.test.mjs compares the two.
const TAG_KEYWORDS = ["minimum", "exclusiveMinimum", "maximum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength", "pattern", "format", "minItems", "maxItems"];
/** Keywords whose values all hold at once, so only the largest (lower) or smallest (upper) matters. */
const LOWER_BOUNDS = new Set(["minimum", "exclusiveMinimum", "minLength", "minItems"]);
const UPPER_BOUNDS = new Set(["maximum", "exclusiveMaximum", "maxLength", "maxItems"]);
const MAX_TAG_CHARS = 80;
const LINE_TERMINATORS = /[\r\n\u2028\u2029]/gu;

type Schema = Record<string, unknown>;

const isSchema = (value: unknown): value is Schema => typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (type: unknown) => type === "integer" || (Array.isArray(type) && type.includes("integer"));

/** Constraints a Python type cannot express, as tags: `@integer @minimum 1 @maximum 100 @default 20`. Empty when there are none. */
export function constraintTags(property: unknown): string {
  if (!isSchema(property)) return "";
  // Optional fields such as Pydantic's `int | None` keep their constraints in the non-null branch.
  const variants = Array.isArray(property.anyOf) ? property.anyOf : property.oneOf;
  const nonNull = Array.isArray(variants) ? variants.filter((variant) => (variant as Schema | undefined)?.type !== "null") : [];
  const branch = nonNull.length === 1 ? nonNull[0] : undefined;
  const branches: Schema[] = isSchema(branch) ? [property, branch] : [property];
  // Draft-04 and OpenAPI 3.0 make minimum/maximum exclusive with a boolean exclusiveMinimum/exclusiveMaximum.
  const schemas = branches.map((schema): Schema => ({
    ...schema,
    ...(schema.exclusiveMinimum === true ? { minimum: undefined, exclusiveMinimum: schema.minimum } : {}),
    ...(schema.exclusiveMaximum === true ? { maximum: undefined, exclusiveMaximum: schema.maximum } : {}),
  }));
  const tags: string[] = [];
  if (schemas.some((schema) => isInteger(schema.type))) tags.push("@integer");
  for (const keyword of TAG_KEYWORDS) {
    const values = schemas.map((schema) => schema[keyword]);
    if (LOWER_BOUNDS.has(keyword) || UPPER_BOUNDS.has(keyword)) {
      const numbers = values.filter((value): value is number => typeof value === "number");
      if (numbers.length === 0) continue;
      tags.push(`@${keyword} ${LOWER_BOUNDS.has(keyword) ? Math.max(...numbers) : Math.min(...numbers)}`);
      continue;
    }
    for (const value of new Set(values)) if (typeof value === "number" || typeof value === "string") tags.push(`@${keyword} ${value}`);
  }
  if (schemas.some((schema) => schema.uniqueItems === true)) tags.push("@uniqueItems");
  // Annotations, unlike constraints, come from the property itself.
  if (property.default !== undefined && property.default !== null) tags.push(`@default ${JSON.stringify(property.default)}`);
  if (property.deprecated === true) tags.push("@deprecated");
  return tags
    .filter((tag) => tag.length <= MAX_TAG_CHARS)
    .map((tag) => tag.replace(LINE_TERMINATORS, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`))
    .join(" ");
}
