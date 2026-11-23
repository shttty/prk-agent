// Limits of the composer's attachment block (web/chat/attachments.js).
import assert from "node:assert/strict";
import { addAttachments } from "../../web/chat/composer/attachments/add-attachments.js";

const limits = { maxItems: 3, maxDecodedBytesPerItem: 100, maxDecodedBytesTotal: 150, imageMimeTypes: ["image/png"], textMimeTypes: ["text/plain"] };
const file = (name, type, size) => new File([new Uint8Array(size).fill(65)], name, { type });
const reason = async (promise) => { try { await promise; } catch (error) { return error.message; } return null; };

const one = await addAttachments([], [file("a.png", "image/png", 10)], limits);
assert.deepEqual(one.map((item) => [item.name, item.type, item.size, item.source]), [["a.png", "image/png", 10, "browser"]]);
assert.equal(one[0].data, Buffer.alloc(10, 65).toString("base64"), "payload is the file's base64");

assert.ok(await reason(addAttachments(one, [file("b.png", "image/png", 10), file("c.png", "image/png", 10), file("d.png", "image/png", 10)], limits)), "more than maxItems is refused");
assert.ok(await reason(addAttachments([], [file("big.png", "image/png", 101)], limits)), "over the per-item bound is refused");
assert.ok(await reason(addAttachments([], [file("x.gif", "image/gif", 5)], limits)), "a type outside the catalog is refused");
assert.ok(await reason(addAttachments([], [file("a.png", "image/png", 90), file("b.png", "image/png", 90)], limits)), "over the total bound is refused");

// Replacing swaps one entry, does not count against maxItems and frees the replaced entry's bytes.
const full = await addAttachments([], [file("a.png", "image/png", 90), file("b.png", "image/png", 10), file("c.png", "image/png", 10)], limits);
const swapped = await addAttachments(full, [file("n.png", "image/png", 100)], limits, { replaceAt: 0 });
assert.deepEqual(swapped.map((item) => item.name), ["n.png", "b.png", "c.png"]);

console.log("PASS attachments logic");
