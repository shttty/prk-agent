import type { PeerContext, Respond } from "../connection/peer-state.ts";
import type { Request } from "../../wire/wire-types.ts";
import type { CapabilitySettingsChange } from "../../../config/capabilities/capability-types.ts";
import type { DerivationConfig } from "../../../config/derivation/derivation-types.ts";
import type { KernelExecutionSettings } from "../../../config/kernel/kernel-options.ts";
import type { ToolTitleSettings } from "../../../config/session/session-options.ts";
import type { MetricsSettings } from "../../../config/metrics/metrics-options.ts";

export async function dispatchCatalogs(ctx: PeerContext, respond: Respond, request: Request): Promise<void> {
  const { id, method, params } = request;
  const { host } = ctx.listener;
      if (method === "workbench") { respond(id, host.workbench()); return; }
   if (method === "modelCatalog") { respond(id, await host.modelCatalog()); return; }
      if (method === "reloadTargets") { respond(id, await host.reloadTargets()); return; }
      if (method === "derivationGet") { respond(id, host.derivationGet()); return; }
      if (method === "derivationSet") { respond(id, await host.derivationSet(params as unknown as { derivation: DerivationConfig })); return; }
      if (method === "kernelExecutionGet") { respond(id, host.kernelExecutionGet()); return; }
      if (method === "kernelExecutionSet") { respond(id, await host.kernelExecutionSet(params as unknown as KernelExecutionSettings)); return; }
      if (method === "toolTitleGet") { respond(id, host.toolTitleGet()); return; }
      if (method === "soulGet") { respond(id, host.soulGet()); return; }
      if (method === "soulSave") { respond(id, host.soulSave(params as { content: string; revision: string })); return; }
      if (method === "metricsGet") { respond(id, host.metricsGet()); return; }
      if (method === "metricsSet") { respond(id, await host.metricsSet(params as unknown as MetricsSettings)); return; }
      if (method === "toolTitleSet") { respond(id, await host.toolTitleSet(params as unknown as ToolTitleSettings)); return; }
      if (method === "capabilitiesList") { respond(id, await host.capabilitiesList(params.instance as string | undefined)); return; }
      if (method === "capabilitiesRefresh") { respond(id, await host.capabilitiesRefresh(params.instance as string | undefined)); return; }
      if (method === "capabilitiesChange") { respond(id, await host.capabilitiesChange(params as CapabilitySettingsChange)); return; }
}
