import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { packagedDaemon } from "@earendil-works/pi-env";
import { PI_ENV_VERSION } from "./daemon-version.ts";
import { observeMarker } from "./observe-marker.mjs";
import { quoteShell } from "./quote-shell.mjs";
import { writeInput } from "./write-input.mjs";
import { resolveCacheRoot } from "../python/resolve-cache-root.ts";

export async function deployDaemon(child, target, report, targetCacheRoot) {
  const binary = await readFile(packagedDaemon(target));
  const hash = createHash("sha256").update(binary).digest("hex");
  const directory = `${resolveCacheRoot(target.home, targetCacheRoot)}/pi-env/${PI_ENV_VERSION}/${hash}`;
  const daemon = `${directory}/pi-env`;
  const nonce = randomBytes(16).toString("hex");
  const marker = `PRK_HASH_${nonce}`;
  let observed = observeMarker(child.stdout, Buffer.from(`${marker}\n`), 10000, "cache");
  await writeInput(child.stdin, `if [ -f ${quoteShell(daemon)} ]; then sha256sum ${quoteShell(daemon)}; fi\nprintf '%s\\n' '${marker}'\n`);
  const result = (await observed).toString("utf8").trim();
  if (result.split("\n").some((line) => line.startsWith(`${hash} `))) {
    report({ kind: "deployment", cached: true, hash, daemon });
    return daemon;
  }
  const temporary = `${directory}/.upload-${nonce}`;
  const delimiter = `PRK_BASE64_${nonce}`;
  const ok = `PRK_UPLOAD_OK_${nonce}`;
  observed = observeMarker(child.stdout, Buffer.from(`${ok}\n`), 30000, "upload");
  const script = `mkdir -p ${quoteShell(directory)} || exit 70
trap ${quoteShell(`rm -f ${quoteShell(temporary)}`)} EXIT HUP INT TERM
base64 -d > ${quoteShell(temporary)} <<'${delimiter}'
${binary.toString("base64").match(/.{1,76}/g).join("\n")}
${delimiter}
prk_hash=$(sha256sum ${quoteShell(temporary)}) || exit 71
case "$prk_hash" in
  ${hash}' '*) chmod 755 ${quoteShell(temporary)} && mv ${quoteShell(temporary)} ${quoteShell(daemon)} || exit 72 ;;
  *) printf '%s\\n' 'upload: SHA-256 mismatch' >&2; exit 73 ;;
esac
trap - EXIT HUP INT TERM
printf '%s\\n' '${ok}'
`;
  await writeInput(child.stdin, script);
  await observed;
  report({ kind: "deployment", cached: false, hash, bytes: binary.length, daemon });
  return daemon;
}
