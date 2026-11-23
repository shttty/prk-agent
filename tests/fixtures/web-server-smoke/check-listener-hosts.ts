import type { WebGatewayClient } from "../../../src/http/gateway-connection/client-types.ts";
import type { createWebRequest } from "./create-web-request.ts";
import assert from "node:assert/strict";
import { startWebServer } from "../../../src/http/listener/start-listener.ts";

export async function checkListenerHosts(gateway: WebGatewayClient, raw: ReturnType<typeof createWebRequest>, ENVIRONMENT: string) {
const wildcard = await startWebServer(gateway, { host: "0.0.0.0", port: 0 });
try {
  const port = new URL(wildcard.url).port;
  for (const host of ["127.0.0.1"]) {
    const url = `http://${host}:${port}`;
    assert.equal((await fetch(`${url}/api/workbench`)).status, 200);
    assert.equal((await fetch(`${url}/api/sessions`, {
      method: "POST", headers: { Origin: url, "Content-Type": "application/json" },
      body: JSON.stringify({ target: ENVIRONMENT }),
    })).status, 201, "Same-origin mutations work through each local destination");
    for (const authority of [`example.invalid:${port}`]) {
      const response = await raw("/api/sessions", {
        headers: { Host: authority, Origin: `http://${authority}` },
        body: JSON.stringify({ target: ENVIRONMENT }),
      }, url);
      assert.equal(response.status, 201, "Wildcard accepts arbitrary Host with matching Origin");
    }
    for (const headers of [
      { Origin: "http://evil.example" },
      { Origin: url, "Sec-Fetch-Site": "cross-site" },
    ]) {
      assert.equal((await raw("/api/workbench", { headers }, url)).status, 403);
    }
    assert.equal((await fetch(`${url}/api/sessions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
    })).status, 403, "Wildcard binding does not waive mutation Origin checks");
  }
} finally {
  await wildcard.close();
}

}
