import { nodePlatform, type RemoteInfo } from "@earendil-works/pi-env";

const order = new Intl.Collator("en", { numeric: true });

export function checkPythonPlatform(info: Pick<RemoteInfo, "os" | "arch">, glibc: string, required: string): void {
  const { platform, arch } = nodePlatform(info);
  if (platform !== "linux" || arch !== "x64") throw new Error(`Unsupported managed Python platform: ${info.os}/${info.arch}; requires Linux x86_64.`);
  const actual = /^glibc (\d+(?:\.\d+)+)$/u.exec(glibc.trim())?.[1];
  if (!actual) throw new Error(`Cannot detect target glibc; managed Python requires glibc ${required}.`);
  if (order.compare(actual, required) < 0) throw new Error(`glibc ${actual} is below required ${required}.`);
}
