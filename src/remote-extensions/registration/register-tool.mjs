import { rendererKeys, toolMetadataKeys } from "./host-protocol.mjs";
import { registering } from "./assert-registering.mjs";
import { schemaMetadata } from "./metadata/validate-schema-metadata.mjs";
import { jsonMetadata } from "./metadata/validate-json-metadata.mjs";
import { freeze } from "../sdk-facade/freeze-value.mjs";
import { unsupported } from "../sdk-facade/reject-capability.mjs";

export function registerTool(ctx, owner, pkg, tool) {
  registering(ctx, owner);
  if (!tool || typeof tool.execute !== "function") throw new TypeError("Remote tool requires execute()");
  const native = owner.nativeDefinitions.has(tool);
  const metadata = native ? {} : { renderShell: "default" };
  for (const key of Object.keys(tool)) {
    if (key === "execute" || tool[key] === undefined) continue;
    if (Object.hasOwn(rendererKeys, key)) {
      if (native && key === "renderShell") metadata[key] = tool[key];
      else if (!native) ctx.warning(`tool.${key}`);
      continue;
    }
    // The Gateway restores native preparation/rendering from the public Pi factory.
    if (native && key === "prepareArguments") continue;
    if (!Object.hasOwn(toolMetadataKeys, key)) unsupported(`tool.${key}`);
    metadata[key] = tool[key];
  }
  for (const key of ["name", "label", "description"]) {
    if (typeof metadata[key] !== "string" || !metadata[key].length) throw new TypeError(`Remote tool requires ${key}`);
  }
  if (owner.toolNames.has(metadata.name)) throw new Error(`Duplicate remote tool: ${metadata.name}`);
  metadata.parameters = schemaMetadata(metadata.parameters, `${metadata.name}.parameters`);
  if (metadata.outputSchema !== undefined) metadata.outputSchema = schemaMetadata(metadata.outputSchema, `${metadata.name}.outputSchema`);
  const toolId = `package:${pkg.index}:tool:${pkg.tools.length}`;
  const declaration = freeze({ ...jsonMetadata(metadata, "Tool metadata"), toolId, ...(native ? { piNativeTool: true } : {}) });
  owner.toolNames.add(metadata.name);
  owner.tools.set(toolId, { declaration, definition: tool });
  pkg.tools.push(declaration);
}
