import { withGatewayValues } from "../fixtures/gateway-values/with-gateway-values.mjs";
import { checkGatewayValues } from "./gateway-values/check-gateway-values.mjs";
import { checkPluginValues } from "./gateway-values/check-plugin-values.mjs";

await withGatewayValues(async (fixture) => {
  const covered = await checkGatewayValues(fixture);
  console.log(`PASS real Gateway/SDK/owned REPL Python values: ${covered.join(", ")}`);
});
await withGatewayValues(checkPluginValues, true);
