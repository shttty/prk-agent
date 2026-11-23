import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPythonPlatform } from "../../../src/target-environment/python/check-python-platform.ts";

const target = { os: "linux", arch: "x86_64" };
test("managed Python refuses non-x86_64 pi-env hello", () => {
  assert.throws(() => checkPythonPlatform({ ...target, arch: "aarch64" }, "glibc 2.44", "2.17"), /Unsupported.*aarch64.*Linux x86_64/);
});
test("managed Python compares actual GNU libc component versions", () => {
  assert.throws(() => checkPythonPlatform(target, "glibc 2.9\n", "2.17"), /glibc 2\.9 is below required 2\.17/);
  assert.throws(() => checkPythonPlatform(target, "musl", "2.17"), /Cannot detect target glibc/);
  checkPythonPlatform(target, "glibc 2.17\n", "2.17");
  checkPythonPlatform(target, "glibc 2.44\n", "2.17");
});
