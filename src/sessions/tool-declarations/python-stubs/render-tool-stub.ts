import { collectObjects } from "./collect-objects.ts";
import { pascalCase } from "./pascal-case.ts";
import { printType } from "./print-type.ts";
import { renderClass } from "./render-class.ts";
import { renderDef } from "./render-def.ts";
import { renderDocstring } from "./render-docstring.ts";
import { renderParameters, type ParameterLine } from "./render-parameters.ts";
import { schemaType } from "./schema-type.ts";
import type { PythonObject, StubContext } from "./stub-types.ts";

/** Largest rendered argument type, in characters, before the arguments become `**args: Any` (Pi 1.6.0 DEFAULT_INPUT_SCHEMA_MAX_CHARS). */
const INPUT_MAX_CHARS = 16_000;

/** The Pi ToolDefinition/ToolInfo fields a stub is made of. */
export interface StubTool {
  readonly name: string;
  readonly description: string;
  readonly parameters?: unknown;
  readonly outputSchema?: unknown;
  readonly promptGuidelines?: readonly string[];
}

export interface ToolStub {
  readonly name: string;
  /** TypedDict definitions by class name, for the arguments and the result. */
  readonly classes: ReadonlyMap<string, string>;
  readonly def: string;
}

const context = (schema: unknown, stem: string, tags: boolean): StubContext => ({ root: schema, resolving: new Set(), names: new Set(), tags, stem, expansions: 0 });

/**
 * The Python stub of a tool as scripts call it, `gateway.<name>(**args)`: `def name(*, a: T, b: U = ...) -> R` with a docstring, and the TypedDicts of inline objects
 * named after the tool (`<Tool>Args…` for arguments, `<Tool>Output…` for the result). Arguments and result types are read from `parameters` and `outputSchema` only;
 * a tool without outputSchema returns Any. An argument type over 16000 characters is rendered again without constraint tags, then as Any.
 */
export function renderToolStub(tool: StubTool, detail: "summary" | "full"): ToolStub {
  const stem = pascalCase(tool.name) || "Tool";
  const input = (tags: boolean) => {
    const { lines, referenced } = renderParameters(schemaType(tool.parameters, context(tool.parameters, `${stem}Args`, tags), []));
    const classes = new Map<string, PythonObject>();
    for (const type of referenced) collectObjects(type, classes);
    return { classes, lines, size: sizeOf(classes, lines) };
  };
  const first = input(true);
  const fitted = first.size <= INPUT_MAX_CHARS ? first : input(false);
  const args = fitted.size <= INPUT_MAX_CHARS ? fitted : { classes: new Map<string, PythonObject>(), lines: [{ comments: [], text: "**args: Any" }] };
  const outputType = tool.outputSchema === undefined ? undefined : schemaType(tool.outputSchema, context(tool.outputSchema, `${stem}Output`, true), []);
  const classes = new Map([...args.classes, ...(outputType ? collectObjects(outputType) : [])].map(([name, object]) => [name, renderClass(object)]));
  const docstring = renderDocstring(tool.description, tool.promptGuidelines ?? [], detail);
  return { name: tool.name, classes, def: renderDef(tool.name, args.lines, outputType ? printType(outputType) : "Any", docstring) };
}

function sizeOf(classes: ReadonlyMap<string, PythonObject>, lines: readonly ParameterLine[]): number {
  return [...[...classes.values()].map(renderClass), ...lines.map((line) => [...line.comments, line.text].join("\n"))].join("\n").length;
}
