import assert from "node:assert/strict";
import { prepareNativeToolArtifacts } from "./native-tool-artifacts.mjs";

/** Performs the UI's explicit deployment prerequisite; socket callers lend the collection subscription. */
export async function prepareGatewayEnvironment(gateway, home, target, { prepareArtifacts = true } = {}) {
  if (prepareArtifacts) await prepareNativeToolArtifacts(home);
  const finished = Promise.withResolvers();
  const socketClient = typeof gateway.request === "function";
  const observe = (event) => {
    if (event.type !== "target_environment_changed" || event.target !== target) return;
    const environment = event.details.environment;
    if (environment.status === "ready" || environment.status === "failed") finished.resolve(environment);
  };
  const unsubscribe = socketClient ? gateway.onCollectionEvent(observe) : gateway.subscribeSessions(observe);
  const timer = setTimeout(() => finished.reject(new Error(`Fixture environment deployment timed out: ${target}`)), 120_000);
  try {
    if (socketClient) {
      await gateway.request("subscribeSessions");
      await gateway.request("deployTargetEnvironment", { target });
    } else gateway.deployTargetEnvironment({ target });
    const environment = await finished.promise;
    assert.equal(environment.status, "ready", JSON.stringify(environment));
    return environment;
  } finally {
    clearTimeout(timer);
    unsubscribe();
    if (socketClient) await gateway.request("unsubscribeSessions");
  }
}
