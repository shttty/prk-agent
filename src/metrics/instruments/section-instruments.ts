import { Histogram } from "prom-client";
import { gatewayRegistry } from "../registry/gateway-registry.ts";

const SECONDS = [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
const BYTES = [1024, 16_384, 131_072, 1_048_576, 4_194_304, 8_388_608, 33_554_432, 134_217_728];

/** Synchronous part of one plugin handler call: from the call to the value or promise it returns. */
export const hookSyncSeconds = new Histogram({
  name: "prk_plugin_hook_sync_seconds",
  help: "Synchronous time of one Gateway-side plugin event handler call, by plugin and event.",
  labelNames: ["plugin", "event"], buckets: SECONDS, registers: [gatewayRegistry],
});

export const serializationSeconds = new Histogram({
  name: "prk_serialization_seconds",
  help: "Synchronous time spent serializing or loading one large payload, by kind.",
  labelNames: ["kind"], buckets: SECONDS, registers: [gatewayRegistry],
});

export const serializationBytes = new Histogram({
  name: "prk_serialization_bytes",
  help: "Bytes of one serialized frame or loaded history file, by kind.",
  labelNames: ["kind"], buckets: BYTES, registers: [gatewayRegistry],
});
