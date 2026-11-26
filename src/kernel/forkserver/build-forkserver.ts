import { readFileSync } from "node:fs";
import { buildGatewayBridge } from "../../codemode/kernel-prelude/build-gateway-bridge.ts";
import { readPythonSource } from "../../target-channel/deployment-source/read-python-source.ts";

export function buildForkserver(): string {
  const sources = [
    "../runner/cell/pickle_cell_values.py",
    "../runner/output/print_owned.py",
    "../runner/output/help_owned.py",
    "../runner/output/display.py",
    "../runner/output/collect_figures.py",
  ];
  return [buildGatewayBridge(), ...sources.map((file) => readFileSync(new URL(file, import.meta.url), "utf8")),
    readPythonSource(new URL("./", import.meta.url))].join("\n\n");
}
