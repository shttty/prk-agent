import type { HostContext } from "../host-state.ts";
import type { GatewaySessionHost } from "../host-types.ts";
import { appendNativeSessionState } from "../../../sessions/history/append-native-session-state.ts";

export function close(ctx: HostContext): Promise<void> {
   ctx.lifecycle.extensionLifetime.abort();
   clearInterval(ctx.lifecycle.idleTimer);
   ctx.metrics.close();
   for (const watch of ctx.monitoring.kernelWatches.values()) watch.unsubscribe();
   ctx.monitoring.kernelWatches.clear();
   const unsubscribeMonitor = ctx.monitoring.unsubscribeMonitor;
   unsubscribeMonitor();
      return ctx.lifecycle.closing ??= (async () => {
        const failures: unknown[] = [];
        const handoffs = Promise.allSettled(ctx.host.collection.snapshot().map((session) =>
          ctx.host.collection.get(session.sessionId)?.kernel.prepareHandoff?.()));
        for (const record of ctx.instances.environments.values()) record.abort.abort(new Error("Gateway is shutting down; retry environment deployment explicitly."));
        await Promise.allSettled([...ctx.instances.environments.values()].flatMap((record) => record.pending ? [record.pending] : []));
        await Promise.allSettled(ctx.capabilities.catalogLoading ? [ctx.capabilities.catalogLoading] : []);
    await Promise.allSettled([...ctx.lifecycle.transitions.values()]);
    for (const result of await handoffs) if (result.status === "rejected") failures.push(result.reason);
        for (const sessionId of ctx.workspace.modelTerminals.keys()) {
          try { await ctx.methods.closeModelTerminals(sessionId); } catch (error) { failures.push(error); }
        }
        try { await ctx.workspace.terminals.shutdown(); } catch (error) { failures.push(error); }
    // A session that is awake when the Gateway stops was not ended by anyone: record it as sleeping so it comes back
    // asleep (selecting it wakes it with a fresh runtime) instead of looking closed. Explicitly ended sessions have no
    // live runtime here and stay closed.
    for (const session of ctx.host.collection.snapshot()) {
     if (session.state === "closed" || session.state === "closing") continue;
     if (!ctx.host.history.get(session.sessionId)) continue;
     const runtime = ctx.host.collection.get(session.sessionId);
     try {
      if (runtime) appendNativeSessionState({ manager: runtime.session.sessionManager }, runtime.session);
      ctx.host.history.setSleeping(session.sessionId, true);
     } catch (error) { failures.push(error); }
    }
    for (const binding of ctx.sessionHosts.hostBindings.values()) binding.dispose();
    ctx.sessionHosts.hostBindings.clear();
        try { await ctx.host.collection.close(); } catch (error) { failures.push(error); }
        if (ctx.models.modelRuntime) await Promise.allSettled([ctx.models.modelRuntime]);
        try { await ctx.models.providerRuntime?.dispose(); } catch (error) { failures.push(error); }
        const unsubscribeCollection = ctx.events.unsubscribeCollection;
        unsubscribeCollection();
        try { await ctx.monitoring.monitor.close(); } catch (error) { failures.push(error); }
        ctx.events.listeners.clear();
        ctx.packages.remoteStatuses.clear();
        ctx.packages.remoteCatalogStatuses.clear();
        ctx.capabilities.instanceExtensionCatalogs.clear();
        ctx.sessionHosts.hosts.clear();
        ctx.lifecycle.recoveryStates.clear();
        if (failures.length) throw new AggregateError(failures, "Gateway shutdown failed; owned resources were still attempted.");
      })();
    }
