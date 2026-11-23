#!/usr/bin/env node
// References use real HTTP → Gateway → target file operations for independent session cwd values.
// Covers relative/absolute paths, normalized parents, bounded reads and structured lookup failures.
import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { parsePrkConfig } from "../../src/config/document/parse-prk-config.ts";
import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";

const home = await mkdtemp(join(tmpdir(), "pi-reference-candidates-"));
try {
  const { agentDir } = initializePrkHome(home);
  await mkdir(agentDir, { recursive: true });
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { fauxProvider, fauxAssistantMessage } = await import("@earendil-works/pi-ai");
  const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
  const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
  const { startWebApplication } = await import("../../src/http/application/start-application.ts");
  const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");

  await withTargetFixture(async (fsRoot) => {
    await withTargetFixture(async (subRoot) => {
      assert.ok(fsRoot.tempRoot && subRoot.tempRoot, "owned target fixtures");
      const homeA = fsRoot.tempRoot;
      const homeB = subRoot.tempRoot;
      const rootB = join(homeB, "root");
      await mkdir(join(homeA, "dir1", "dir2"), { recursive: true });
      await writeFile(join(homeA, "dir1", "dir2", "file.txt"), "A\n");
      await mkdir(join(rootB, "proj", "sub"), { recursive: true });
      const locked = join(rootB, "proj", "locked");
      await writeFile(join(rootB, "proj", "sub", "note.txt"), "B\n");
      await mkdir(join(rootB, "proj", ".config"));
      await writeFile(join(rootB, "proj", ".env"), "HIDDEN\n");
      await writeFile(join(rootB, "proj", ".config", "settings.json"), "{}\n");
      await writeFile(join(rootB, "proj", ".config", ".secret"), "HIDDEN\n");
      await writeFile(join(rootB, "proj", "sub", ".env"), "SUB_HIDDEN\n");
      await mkdir(join(rootB, "sub"));
      await writeFile(join(rootB, "sub", "note.txt"), "ROOT_DECOY\n");
      await mkdir(locked);
      await chmod(locked, 0o000);

      const runtime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false });
      const faux = fauxProvider({ provider: "reference-controlled", models: [{ id: "controlled" }] });
      runtime.registerNativeProvider(faux.provider);
      let modelInput;
      faux.setResponses([(context) => {
        modelInput = context.messages.filter((message) => message.role === "user").at(-1)?.content;
        return fauxAssistantMessage("REFERENCE_RECEIVED");
      }]);
      const targets = [
        executionTargetFromConfig({ ...fsRoot.config, id: "fsroot", label: "fs root", tags: [], cwd: homeA }),
        executionTargetFromConfig({ ...subRoot.config, id: "subroot", label: "sub root", tags: [], cwd: join(rootB, "proj") }),
      ];
      const socket = join(home, "gateway.sock");
      // Workers fall asleep after 4 s idle, so the same lookups are also checked on a sleeping session.
      const host = await createGatewayHost(
        { cwd: home, home, config: parsePrkConfig({ session: { workerTools: "direct", idleTimeoutMs: 4000 } }), historyDir: join(home, "history"), model: "reference-controlled/controlled", thinkingLevel: "off", targets },
        { runtimeDependencies: { model: faux.getModel(), modelRuntime: runtime, thinkingLevel: "off", cwd: home, agentDir } },
      );
      const observedKernelIds = new Set();
      const stopKernelObservation = host.subscribeSessions((event) => {
        if (event.type === "session_kernel" && event.details?.kernel?.kernelId) observedKernelIds.add(event.details.kernel.kernelId);
      });
      const gateway = await startGateway(host, socket);
      const web = await startWebApplication({ socket, host: "127.0.0.1", port: 0 });
      try {
        const request = async (path, body) => {
          const response = await fetch(`${web.server.url}${path}`, {
            method: body ? "POST" : "GET",
            headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json", Origin: web.server.url } : {}) },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          return { status: response.status, body: await response.json() };
        };
        const createSession = async (target) => {
          const created = await request("/api/sessions", { target, label: target });
          assert.equal(created.status, 201, `worker on ${target}: ${JSON.stringify(created.body)}`);
          const state = await request(`/api/sessions/${encodeURIComponent(created.body.session.sessionId)}`);
          return { target, sessionId: state.body.sessionId };
        };
        let counter = 0;
        const refs = (worker, path) => request(`/api/sessions/${encodeURIComponent(worker.sessionId)}/native`, {
          requestId: `refs-${++counter}`, action: "reference-candidates",
          args: { target: worker.target, sessionId: worker.sessionId, path },
        });
        const ok = async (worker, path) => {
          const result = await refs(worker, path);
          assert.equal(result.status, 200, `${worker.target} ${JSON.stringify(path)}: ${JSON.stringify(result.body)}`);
          return result.body.data.candidates;
        };
        const failed = async (worker, path, status, reason) => {
          const result = await refs(worker, path);
          assert.equal(result.status, status, `${worker.target} ${JSON.stringify(path)} status: ${JSON.stringify(result.body)}`);
          assert.equal(result.body.details?.reason, reason, `${worker.target} ${JSON.stringify(path)} reason: ${JSON.stringify(result.body)}`);
          assert.doesNotMatch(result.body.error, /Host operation failed|Web operation failed/);
          return result.body;
        };
        const names = (candidates) => candidates.map((candidate) => candidate.name);

        // Observe real lifecycle emissions: file lookups may connect a target but never start a REPL.
        const noNewKernels = async (run) => {
          const before = [...observedKernelIds];
          await run();
          assert.deepEqual([...observedKernelIds], before, "Reference lookups start no kernel");
        };

        const a = await createSession("fsroot");
        const b = await createSession("subroot");

        const rootSlash = async () => {
          // Root "/": relative tokens start at cwd, absolute tokens retain their mapping.
          assert.ok(names(await ok(a, "")).includes("dir1"));
          assert.deepEqual((await ok(a, "dir1/dir2/")).map((candidate) => candidate.path), [`${homeA}/dir1/dir2/file.txt`]);
          assert.deepEqual(names(await ok(a, "/tm")).filter((name) => name === "tmp"), ["tmp"], "/abs without trailing slash filters the parent, not the root by accident");
          const absolute = await ok(a, `${homeA}/`);
          assert.ok(absolute.some((candidate) => candidate.name === "dir1" && candidate.path === `${homeA}/dir1` && candidate.navigable === true));
          assert.deepEqual(names(await ok(a, `${homeA}/di`)), ["dir1"]);
          assert.deepEqual((await ok(a, `${homeA}/dir1/`)).map((candidate) => candidate.path), [`${homeA}/dir1/dir2`]);
          assert.deepEqual((await ok(a, `${homeA}/dir1/dir2/`)).map((candidate) => [candidate.path, candidate.selectable]), [[`${homeA}/dir1/dir2/file.txt`, true]]);
        };
        const subRootAbsolute = async () => {
          assert.deepEqual((await ok(b, `${rootB}/`)).map((candidate) => candidate.path).sort(), [`${rootB}/proj`, `${rootB}/sub`]);
          assert.deepEqual((await ok(b, `${rootB}/proj/`)).map((candidate) => candidate.path).sort(), [`${rootB}/proj/locked`, `${rootB}/proj/sub`]);
          assert.deepEqual((await ok(b, `${rootB}/proj/sub/`)).map((candidate) => candidate.path), [`${rootB}/proj/sub/note.txt`]);
          assert((await ok(b, `${homeB}/`)).some((candidate) => candidate.path === rootB), "Instance cwd does not restrict its parent filesystem");
          for (const missing of [`${rootB}x/`, `${rootB}x/proj/`]) await failed(b, missing, 404, "not-found");
        };
        const cwdRelative = async () => {
          assert.deepEqual((await ok(b, "")).map((candidate) => candidate.path).sort(), [`${rootB}/proj/locked`, `${rootB}/proj/sub`], "@ lists the worker cwd");
          assert.deepEqual((await ok(b, "sub/")).map((candidate) => candidate.path), [`${rootB}/proj/sub/note.txt`]);
          assert.deepEqual((await ok(b, "../")).map((candidate) => candidate.path).sort(), [`${rootB}/proj`, `${rootB}/sub`]);
          assert.deepEqual((await ok(b, "sub/../Su")).map((candidate) => candidate.path), [`${rootB}/proj/sub`], "Normalize before case-insensitive fragment filtering");
          assert((await ok(b, "../../")).some((candidate) => candidate.path === rootB));
        };
        const hiddenReferences = async () => {
          assert.deepEqual(names(await ok(b, "")).sort(), ["locked", "sub"], "@ hides dotfiles and dot-directories");
          assert.deepEqual(names(await ok(b, "env")), [], "a non-dot fragment does not reveal matching dotfiles");
          assert.deepEqual(names(await ok(b, ".")).sort(), [".config", ".env"], "@. lists only dot entries");
          assert.deepEqual(names(await ok(b, ".co")), [".config"], "@.co filters dot entries");
          assert.deepEqual(names(await ok(b, ".config/")), ["settings.json"], "a dot-directory does not reveal its hidden children");
          assert.deepEqual(names(await ok(b, ".config/.")), [".secret"], "a dot fragment reveals hidden children in a dot-directory");
          assert.deepEqual((await ok(b, "sub/.")).map((candidate) => candidate.path), [`${rootB}/proj/sub/.env`], "@sub/. lists nested dotfiles");
        };
        await noNewKernels(hiddenReferences);
        await noNewKernels(cwdRelative);
        await noNewKernels(rootSlash);
        await noNewKernels(subRootAbsolute);
        for (const worker of [a, b]) {
          const body = await failed(worker, "~/", 400, "home-unsupported");
          assert.doesNotMatch(body.error, /outside/);
        }
        await failed(a, "~/dir1/", 400, "home-unsupported");
        assert((await ok(a, `${homeA}/../`)).some((candidate) => candidate.path === homeA));
        assert((await ok(a, `${homeA}/dir1/../../`)).some((candidate) => candidate.path === homeA));
        await failed(a, `${homeA}/missing/`, 404, "not-found");
        await failed(a, `${homeA}/dir1/dir2/file.txt/`, 400, "not-directory");
        await failed(b, "home/", 404, "not-found");
        await failed(b, "locked/", 503, "forbidden");

        // Select by cwd-relative spelling; send the candidate's absolute target path.
        const [{ type, source, target, sessionId, path, name }] = await ok(b, "sub/no");
        const sent = await request(`/api/sessions/${encodeURIComponent(b.sessionId)}/send`, {
          requestId: "cwd-reference-send", message: "inspect @sub/note.txt", mode: "plain", references: [{ type, source, target, sessionId, path, name }],
        });
        assert.equal(sent.body.accepted, true, JSON.stringify(sent));
        const completionDeadline = Date.now() + 15_000;
        let completion;
        while (!completion) {
          completion = (await request(`/api/sessions/${encodeURIComponent(b.sessionId)}`)).body.recentOperations?.find((operation) => operation.operationId === sent.body.operationId);
          assert.ok(Date.now() < completionDeadline, "reference send completes");
          if (!completion) await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.equal(completion.status, "completed");
        const text = typeof modelInput === "string" ? modelInput : modelInput.filter((part) => part.type === "text").map((part) => part.text).join("\n");
        assert.ok(text.includes(`path="${rootB}/proj/sub/note.txt"]\nB\n\n[/target-file]`), "Provider receives the selected cwd file through target operations");
        assert.ok(!text.includes("ROOT_DECOY"), "A same-named file outside cwd is not read");

        // Explicit reference lookup can access target files while the session remains asleep.
        const state = async (worker) => (await request(`/api/sessions/${encodeURIComponent(worker.sessionId)}`)).body.state;
        const deadline = Date.now() + 30_000;
        while ((await state(a)) !== "sleeping" || (await state(b)) !== "sleeping") {
          assert.ok(Date.now() < deadline, "workers fall asleep");
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        await noNewKernels(rootSlash);
        await noNewKernels(subRootAbsolute);
        await noNewKernels(cwdRelative);
        await noNewKernels(hiddenReferences);
        assert.equal(await state(a), "sleeping", "browsing does not wake the session");
        assert.equal(await state(b), "sleeping");

        console.log("PASS references awake/sleeping without REPL: absolute target paths, cwd-relative and normalized parents, hidden entries, permission errors and bounded selected file reaching the provider");
      } finally {
        await chmod(locked, 0o755).catch(() => {});
        stopKernelObservation();
        await Promise.allSettled([web.close(), gateway.close()]);
        await host.close().catch(() => {});
      }
    }, { tempParent: home });
  }, { tempParent: home });
} finally {
  await rm(home, { recursive: true, force: true });
}
