import { executionTargetFromConfig } from "../../src/config/execution-target/from-config.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { initializePrkHome } from "../../src/config/home/initialize-prk-home.ts";
import { prepareRgArtifact } from "../fixtures/rg-artifact.mjs";


function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const tag = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const check = Buffer.alloc(4);
  check.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([length, tag, data, check]);
}

function makePng(width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3, 0x24);
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const home = await mkdtemp(join(tmpdir(), "prk-images-"));
const { agentDir } = initializePrkHome(home);
await mkdir(agentDir);
const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
const { fauxAssistantMessage, fauxProvider, fauxToolCall, getCurrentSystemPrompt } = await import("@earendil-works/pi-ai");
const { createGatewayHost } = await import("../../src/gateway/host/start-host.ts");
const { startGateway } = await import("../../src/gateway/socket-server/start-listener.ts");
const { connectGateway } = await import("../../src/gateway/socket-client/connect-client.ts");
const { parsePrkConfig } = await import("../../src/config/document/parse-prk-config.ts");
const { withTargetFixture } = await import("../fixtures/target-fixture.mjs");

try {
  await withTargetFixture(async ({ config, onCleanup }) => {
    const targetCwd = join(home, "target");
    await mkdir(targetCwd);
    await writeFile(join(targetCwd, "image 24.png"), makePng(4, 3));
    await writeFile(join(targetCwd, "binary.bin"), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    await prepareRgArtifact(home);

    const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    const provider = fauxProvider({
      provider: "image-check",
      models: [{ id: "vision", input: ["text", "image"] }],
      tokensPerSecond: 10000,
    });
    modelRuntime.registerNativeProvider(provider.provider);

    const host = await createGatewayHost({
      cwd: home,
      home,
      config: parsePrkConfig({
        session: { workerTools: "code", localTools: false, noSkills: true },
        memory: { review: false },
        targetCacheRoot: join(home, "target-cache"),
      }),
      historyDir: join(home, "history"),
      model: "image-check/vision",
      targets: [executionTargetFromConfig({ ...config, id: "target", label: "Owned target", cwd: targetCwd })],
    }, {
      runtimeDependencies: { model: provider.getModel("vision"), modelRuntime, thinkingLevel: "off", cwd: home, agentDir },
    });
    const endpoint = await startGateway(host, join(home, "gateway.sock"));
    const client = await connectGateway(join(home, "gateway.sock"));
    onCleanup(async () => { await client.disconnect(); await endpoint.close(); });

    const sessionId = (await client.request("createSession", { target: "target" })).session.sessionId;

    const runCode = async (code, expectError = false) => {
      const callId = randomUUID();
      let prompt = "";
      let toolResult;
      provider.setResponses([
        (context) => {
          prompt = getCurrentSystemPrompt(context.messages);
          return fauxAssistantMessage(fauxToolCall("kernel_code", { code }, { id: callId }), { stopReason: "toolUse" });
        },
        (context) => {
          prompt = getCurrentSystemPrompt(context.messages);
          toolResult = context.messages.findLast((entry) => entry.role === "toolResult" && entry.toolCallId === callId);
          return fauxAssistantMessage("done");
        },
      ]);
      const operation = await host.session(sessionId).submit({ requestId: randomUUID(), message: "inspect image" });
      assert.equal(operation.accepted, true);
      assert.equal((await operation.completion).status, "completed");
      assert.ok(toolResult, "model follow-up receives toolResult");
      assert.equal(Boolean(toolResult.isError), expectError);
      return { prompt, toolResult };
    };

    const { prompt, toolResult: readResult } = await runCode('view = read("image 24.png")\nprint(view)');
    assert.match(prompt, /images \(PNG\/JPEG\/GIF\/WebP\/BMP/i, "kernel prompt advertises image support on read()");
    const imageBlocks = readResult.content.filter((part) => part.type === "image");
    assert.equal(imageBlocks.length, 1, "read('image 24.png') attaches one ImageContent block");
    assert.equal(imageBlocks[0].mimeType, "image/png");
    assert.ok(Buffer.from(imageBlocks[0].data, "base64").subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));
    const readText = readResult.content.filter((part) => part.type === "text").map((part) => part.text).join("\n");
    assert.match(readText, /Read image file \[image\/png\]/);
    assert.doesNotMatch(readText, /unsupported MIME output/);

    // Stdlib runner rich display reaches the model as ImageContent.
    const { toolResult: displayResult } = await runCode(
      'import base64\ndisplay({"image/png": base64.b64encode(open("image 24.png", "rb").read()).decode("ascii")}, raw=True)',
    );
    assert.equal(displayResult.content.filter((part) => part.type === "image").length, 1, "cell display image reaches the model");

    // Non-image binary files are still rejected by hashline read().
    const { toolResult: binResult } = await runCode('read("binary.bin")', true);
    assert.match(binResult.content.filter((part) => part.type === "text").map((part) => part.text).join("\n"), /UTF-8 text required/);

    console.log("PASS kernel images: PRK read() and rich display deliver ImageContent to vision models while rejecting arbitrary binaries");
  });
} finally {
  await rm(home, { recursive: true, force: true });
}
