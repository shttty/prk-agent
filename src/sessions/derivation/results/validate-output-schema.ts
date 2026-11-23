import * as Schema from "typebox/schema";

export function validateOutputSchema(schema: object | boolean): void {
  const dialect = typeof schema === "object" && "$schema" in schema ? schema.$schema : "https://json-schema.org/draft/2020-12/schema";
  if (typeof dialect !== "string" || !Object.hasOwn(Schema.Meta, dialect)) throw new Error(`Unsupported outputSchema dialect: ${String(dialect)}`);
  const [valid, errors] = Schema.Errors(Schema.Meta[dialect as keyof typeof Schema.Meta], schema);
  if (!valid) throw new Error(`Invalid outputSchema: ${JSON.stringify(errors)}`);
}
