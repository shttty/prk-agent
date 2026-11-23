#!/usr/bin/env node
// Directory picker browsing uses absolute target paths through HTTP → Gateway → pi-env.
// Instance cwd is a starting location, not a filesystem root restriction.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { fauxProvider } from "@earendil-works/pi-ai";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";

const home = await mkdtemp(join(tmpdir(), "pi-browse-absolute-"));
try {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
  const provider = fauxProvider({ provider: "browse-absolute", models: [{ id: "controlled" }] });
  modelRuntime.registerNativeProvider(provider.provider);
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");

  await withTargetFixture(async (fsRoot) => {
    await withTargetFixture(async (subRoot) => {
      assert.ok(fsRoot.tempRoot && subRoot.tempRoot, "owned target fixtures");
      const homeA = fsRoot.tempRoot;
      const rootB = join(subRoot.tempRoot, "root");
      await mkdir(join(homeA, "dir1", "dir2"), { recursive: true });
      await mkdir(join(rootB, "proj", "sub", "deep"), { recursive: true });
      await writeFile(join(rootB, "proj", "note.txt"), "B\n");

      const targets = [
        executionTargetFromConfig({ ...fsRoot.config, id: "fsroot", label: "fs root", tags: [], cwd: homeA }),
        executionTargetFromConfig({ ...subRoot.config, id: "subroot", label: "sub root", tags: [], cwd: join(rootB, "proj") }),
      ];
      const socket = join(home, "gateway.sock");
      const host = await createGatewayHost(
        { cwd: home, home, config: parsePrkConfig({ session: { workerTools: "direct" } }), historyDir: join(home, "history"), model: "browse-absolute/controlled", targets },
        { runtimeDependencies: { model: provider.getModel(), modelRuntime, thinkingLevel: "off", cwd: home, agentDir } },
      );
      const gateway = await startGateway(host, socket);
      const web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
      try {
        const browse = async (connection, path) => {
          const response = await fetch(`${web.server.url}/api/targets/browse`, {
            method: "POST",
            headers: { Accept: "application/json", "Content-Type": "application/json", Origin: web.server.url },
            body: JSON.stringify({ connection, path }),
          });
          return { status: response.status, body: await response.json() };
        };
        const saved = (target) => { const { local, sshCommand, python, cwd } = host.getTarget(target); return { local, sshCommand, python, cwd }; };
        const names = (result) => result.body.entries.map((entry) => entry.name).sort();
        const ok = async (connection, path) => {
          const result = await browse(connection, path);
          assert.equal(result.status, 200, `${path}: ${JSON.stringify(result.body)}`);
          return result;
        };
        const failed = async (connection, path, status, reason) => {
          const result = await browse(connection, path);
          assert.equal(result.status, status, `${path}: ${JSON.stringify(result.body)}`);
          assert.equal(result.body.details?.reason, reason, `${path}: ${JSON.stringify(result.body)}`);
          return result.body;
        };

        // Entries carry absolute paths; only the actual POSIX root has atRoot=true.
        const fsCwd = saved("fsroot");
        const dir1 = await ok(fsCwd, join(homeA, "dir1"));
        assert.deepEqual([dir1.body.path, dir1.body.atRoot], [join(homeA, "dir1"), false]);
        assert.deepEqual(dir1.body.entries, [{ name: "dir2", type: "directory", path: join(homeA, "dir1", "dir2") }]);
        const slash = await ok(fsCwd, "/");
        assert.deepEqual([slash.body.path, slash.body.atRoot], ["/", true]);
        assert.ok(slash.body.entries.every((entry) => entry.path === `/${entry.name}`), "entries of / are /name");
        assert.equal((await ok(fsCwd, `${join(homeA, "dir1")}/`)).body.path, join(homeA, "dir1"), "a trailing slash is the same directory");

        // A nested instance cwd does not limit browsing to that subtree.
        const subCwd = saved("subroot");
        const top = await ok(subCwd, rootB);
        assert.deepEqual([top.body.path, top.body.atRoot], [rootB, false]);
        assert.deepEqual(top.body.entries, [{ name: "proj", type: "directory", path: join(rootB, "proj") }]);
        const proj = await ok(subCwd, join(rootB, "proj"));
        assert.deepEqual([proj.body.path, proj.body.atRoot, names(proj)], [join(rootB, "proj"), false, ["note.txt", "sub"]]);
        assert.deepEqual(proj.body.entries.find((entry) => entry.name === "sub"), { name: "sub", type: "directory", path: join(rootB, "proj", "sub") });
        assert.deepEqual(names(await ok(subCwd, join(rootB, "proj", "sub"))), ["deep"]);

        // Parent browsing is allowed; nonexistent sibling prefixes remain ordinary not-found errors.
        assert.equal((await ok(subCwd, "/")).body.atRoot, true);
        assert.equal((await ok(subCwd, subRoot.tempRoot)).body.path, subRoot.tempRoot);
        for (const missing of [`${rootB}x`, `${rootB}x/proj`]) await failed(subCwd, missing, 404, "not-found");
        await failed(subCwd, `${rootB}/proj/../..`, 400, "invalid-path");
        await failed(subCwd, join(rootB, "proj", "missing"), 404, "not-found");
        await failed(subCwd, join(rootB, "proj", "note.txt"), 400, "not-directory");
        for (const relative of ["proj", ".", "../x"]) assert.equal((await browse(subCwd, relative)).status, 400, `relative ${relative}`);

        // Unsaved forms browse a connected target before selecting Python or workspace.
        const form = { local: true };
        assert.equal((await browse(form, join(rootB, "proj"))).status, 200);
        const typed = await ok({ ...form, cwd: join(rootB, "proj", "sub") }, join(rootB, "proj"));
        assert.deepEqual([typed.body.path, typed.body.atRoot], [join(rootB, "proj"), false]);
        assert.equal((await browse({ ...form, cwd: "proj" }, join(rootB, "proj"))).status, 400, "the typed anchor must be absolute");
        console.log("PASS browse absolute: POSIX paths and actual root; cwd is not a sandbox; traversal/missing/file/relative failures; unsaved browsing needs no Python or cwd");
      } finally {
        await Promise.allSettled([web.close(), gateway.close()]);
        await host.close().catch(() => {});
      }
    }, { tempParent: home });
  }, { tempParent: home });
} finally {
  await rm(home, { recursive: true, force: true });
}
