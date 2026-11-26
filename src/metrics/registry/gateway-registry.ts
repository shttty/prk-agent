import { Registry } from "prom-client";

/** One registry per Gateway process: every series describes this process's event loop. */
export const gatewayRegistry = new Registry();
