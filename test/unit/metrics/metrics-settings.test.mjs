import assert from "node:assert/strict";
import { test } from "node:test";
import { isMetricsSettings } from "../../../src/config/metrics/is-metrics-settings.ts";
import { validateRequest } from "../../../src/gateway/wire/validate-request.ts";

test("metricsSet takes a boolean switch, an integer port from 1024 to 65535 and optionally an IP literal host", () => {
  for (const port of [1024, 9464, 65_535]) assert.equal(isMetricsSettings({ enabled: true, port }), true, `port ${port}`);
  for (const port of [0, 80, 1023, 65_536, 9464.5, -1, "9464", null, Number.NaN, undefined]) {
    assert.equal(isMetricsSettings({ enabled: true, port }), false, `port ${String(port)}`);
  }
  assert.equal(isMetricsSettings({ enabled: "true", port: 9464 }), false);
  assert.equal(isMetricsSettings({ port: 9464 }), false);
  for (const host of [undefined, "127.0.0.2", "0.0.0.0", "::", "fd7a:115c:a1e0::1"]) assert.equal(isMetricsSettings({ enabled: false, port: 9464, host }), true, `host ${String(host)}`);
  for (const host of ["localhost", "", "256.1.1.1", "[::1]", "127.0.0.1:9464", null, 1]) assert.equal(isMetricsSettings({ enabled: false, port: 9464, host }), false, `host ${String(host)}`);
  assert.equal(isMetricsSettings(null), false);
  assert.equal(isMetricsSettings([]), false);
});

test("the wire rejects bad metrics requests before the Gateway sees them", () => {
  const request = (method, params) => validateRequest({ v: 1, id: 1, method, params });
  assert.deepEqual(request("metricsGet", {}).params, {});
  assert.throws(() => request("metricsGet", { enabled: true }), { code: "INVALID_REQUEST" });
  assert.deepEqual(request("metricsSet", { enabled: false, port: 9500 }).params, { enabled: false, port: 9500 });
  assert.throws(() => request("metricsSet", { enabled: true, port: 80 }), { code: "INVALID_REQUEST" });
  assert.throws(() => request("metricsSet", { enabled: true }), { code: "INVALID_REQUEST" });
});
