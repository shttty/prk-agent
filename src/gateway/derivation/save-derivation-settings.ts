import { publishConfig } from "../instances/publish-config.ts";
import { unlink } from "node:fs/promises";
import type { HostContext } from "../host/host-state.ts";
import type { DerivationConfig, DerivationSettings } from "../../config/derivation/derivation-types.ts";
import { parseDerivationConfig } from "../../config/derivation/parse-config.ts";
import { readPrkConfigSnapshot } from "../../config/document/read-prk-config-snapshot.ts";
import { parsePrkConfig } from "../../config/document/parse-prk-config.ts";
import { stageConfig } from "../instances/stage-config.ts";
import { rejectProviderRoleUnload } from "./reject-provider-role-unload.ts";
import { gatewayLoadablePackages } from "../remote-packages/list-loadable-packages.ts";
import { object } from "../wire/is-record.ts";
import { keys } from "../wire/fields/has-only-fields.ts";
import { WireError } from "../wire/create-error.ts";

export async function derivationSet(ctx: HostContext, request: { readonly derivation: DerivationConfig }): Promise<DerivationSettings> {
  if (!object(request) || !keys(request, ["derivation"]) || !object(request.derivation)) {
    throw new WireError("INVALID_REQUEST", "Derivation settings require exactly {derivation: object}.");
  }
  let derivation: DerivationConfig;
  try { derivation = parseDerivationConfig(request); }
  catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid derivation configuration."); }
  rejectProviderRoleUnload(derivation, gatewayLoadablePackages(ctx));
  return ctx.methods.exclusive(async () => {
    const snapshot = await readPrkConfigSnapshot(ctx.host.paths.configPath);
    const document = snapshot.document ?? {};
    document.derivation = derivation;
    try { parsePrkConfig(document); }
    catch (error) { throw new WireError("INVALID_REQUEST", error instanceof Error ? error.message : "Invalid PRK configuration."); }
    const staged = await stageConfig(ctx.host.paths.configPath, document);
    try {
      if (ctx.lifecycle.closing) throw new WireError("BUSY", "Gateway is shutting down; derivation settings were not changed.");
      publishConfig(ctx.host.paths.configPath, staged, snapshot.hash);
      ctx.derivation.derivationConfig = derivation;
      return ctx.methods.derivationGet();
    } finally {
      await unlink(staged.temporary).catch(() => {});
    }
  });
}
