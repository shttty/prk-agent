import assert from "node:assert/strict";
import { fork, execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { cpus, release, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function runScenarios({ args, out, smoke, samples, cycles, help, option, jsonFile, scriptURL }) {
  await jsonFile(join(out, "machine.json"), {
    date: new Date().toISOString(), cpu: cpus()[0]?.model, logicalCpus: cpus().length,
    totalMemoryBytes: totalmem(), kernel: release(), node: process.version,
    commit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), smoke,
    samples, cycles, methodology: help,
  });
  const selected = option("--scenario");
  const scenarios = ["local", "remote"].flatMap((target) => ["code", "direct"].flatMap((mode) =>
    ["off", "on"].map((native) => `${target}/${mode}/${native}`))).filter((name) => !selected || name === selected);
  assert(scenarios.length, "Unknown scenario");
  for (const scenario of scenarios) {
    console.log(`BEGIN ${scenario}`);
    await new Promise((done, reject) => {
      const child = fork(fileURLToPath(scriptURL), [...args.filter((arg) => arg !== "--worker"), "--worker", "--scenario", scenario, "--out", out], { stdio: "inherit" });
      child.once("error", reject);
      child.once("exit", (code, signal) => code === 0 ? done() : reject(new Error(`${scenario}: exit ${code}, ${signal}`)));
    });
  }
  const summary = [];
  for (const scenario of scenarios) {
    const data = JSON.parse(await readFile(join(out, scenario.replaceAll("/", "-") + ".json"), "utf8"));
    for (const group of ["samples", "hot", "retained", "churn"]) {
      const rows = data[group] ?? [];
      for (const key of new Set(rows.flatMap((row) => Object.keys(row.metrics)))) {
        const values = rows.map((row) => row.metrics[key]).filter((n) => typeof n === "number").sort((a, b) => a - b);
        const n = values.length;
        if (n) summary.push({ scenario, group, metric: key, count: n, median: (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2, max: values[n - 1] });
      }
    }
  }
  await jsonFile(join(out, "summary.json"), summary);
  console.log(`DONE ${out}`);
}
