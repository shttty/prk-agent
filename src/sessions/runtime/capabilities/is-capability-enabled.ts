import { resolveCapability } from "../../../config/capabilities/resolve-capability.ts";
import { LOCAL_TOOLS_GROUP } from "../../resource-catalog/catalog-constants.ts";
import { localEnabled } from "../configuration/read-native-tools.ts";
import { lazyLayers } from "./read-lazy-layers.ts";
import type { RuntimeContext } from "../runtime-state.ts";

export function capabilityEnabled(ctx: RuntimeContext, id: string, group?: string): boolean {
  return (group !== LOCAL_TOOLS_GROUP || localEnabled(ctx)) && resolveCapability(id, group === LOCAL_TOOLS_GROUP ? undefined : group, lazyLayers(ctx));
}
