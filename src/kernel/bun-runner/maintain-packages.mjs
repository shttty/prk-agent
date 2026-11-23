import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const { root, registry, scopes = {}, pins } = JSON.parse(process.argv[1]);
mkdirSync(root, { recursive: true });
const stage = mkdtempSync(join(root, ".stage-"));
const pending = join(stage, "project");
const cache = join(stage, "cache");
const home = join(stage, "home");
const link = join(stage, "pointer");
const config = join(stage, "bunfig.toml");
const token = process.env.NPM_TOKEN;
const allowed = Object.values({ registry, ...scopes }).map((source) => new URL(source));
let exitCode = 2;
try {
  mkdirSync(pending);
  mkdirSync(home);
  writeFileSync(join(pending, "package.json"), JSON.stringify({ name: "prk-bun-package-set", private: true, dependencies: pins }));
  const source = (url) => token ? `{ url = ${JSON.stringify(url)}, token = "$NPM_TOKEN" }` : JSON.stringify(url);
  writeFileSync(config, `[install]\nregistry = ${source(registry)}\n[install.scopes]\n${Object.entries(scopes)
    .map(([scope, url]) => `${JSON.stringify(scope)} = ${source(url)}`).join("\n")}\n`);
  // Scope configuration and auth are explicit; ignore user/project npm defaults and lifecycle scripts.
  const env = { HOME: home, PATH: process.env.PATH, ...(token ? { NPM_TOKEN: token } : {}) };
  const install = (policy) => {
    const child = Bun.spawnSync([process.execPath, "install", `--config=${config}`, "--no-env-file", "--save-text-lockfile", "--ignore-scripts", `--cache-dir=${cache}`, policy], {
      cwd: pending, env, stdout: "ignore", stderr: "ignore", stdin: "ignore",
    });
    if (!child.success) throw new Error("Bun install failed");
  };
  install("--lockfile-only");
  const lock = readFileSync(join(pending, "bun.lock"), "utf8");
  if (token && lock.includes(token)) throw new Error("Credentials in lockfile");
  for (const item of Object.values(Bun.JSONC.parse(lock).packages ?? {})) {
    if (!Array.isArray(item) || typeof item[0] !== "string" || !/^(?:@[^/]+\/)?[^@/]+@\d+\.\d+\.\d+/u.test(item[0])) throw new Error("Non-registry dependency");
    if (item[1]) {
      const url = new URL(item[1]);
      if (url.username || url.password || url.hash || url.search || !allowed.some((source) => source.origin === url.origin
          && url.pathname.startsWith(source.pathname.replace(/\/?$/u, "/")))) throw new Error("Lockfile source outside instance registries");
    }
  }
  install("--frozen-lockfile");
  exitCode = 3;
  const imports = Object.keys(pins);
  const verification = `import { realpathSync } from 'node:fs';
    for (const name of ${JSON.stringify(imports)}) {
      const resolved = realpathSync(Bun.resolveSync(name, process.cwd()));
      if (!resolved.startsWith(process.cwd() + '/node_modules/')) throw new Error('Package outside staged set');
      await import(resolved);
    }`;
  const verify = (cwd) => {
    if (!Bun.spawnSync([process.execPath, "--config=/dev/null", "--no-env-file", "--no-install", "-e", verification], {
      cwd, env: { HOME: home, PATH: process.env.PATH }, stdin: "ignore", stdout: "ignore", stderr: "ignore",
    }).success) throw new Error("Bun import failed");
  };
  const platform = [Bun.version, process.platform, process.arch, process.report.getReport().header.glibcVersionRuntime ?? null];
  const key = new Bun.CryptoHasher("sha256").update(JSON.stringify([registry, Object.entries(scopes).sort(), platform])).update(lock).digest("hex");
  writeFileSync(join(pending, ".prk-platform.json"), JSON.stringify(platform));
  const published = join(root, key);
  if (existsSync(published)) {
    if (readFileSync(join(published, "bun.lock"), "utf8") !== lock
        || readFileSync(join(published, ".prk-platform.json"), "utf8") !== JSON.stringify(platform)) throw new Error("Published package set changed");
    verify(published);
  } else {
    verify(pending);
    renameSync(pending, published);
  }
  symlinkSync(key, link);
  renameSync(link, join(root, "current"));
  exitCode = 0;
} finally {
  rmSync(stage, { recursive: true, force: true });
  process.exit(exitCode);
}
