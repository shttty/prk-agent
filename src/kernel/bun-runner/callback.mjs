function gatewayFor(owner) {
  async function request(channel, payload) {
    if (!owner.accepting || owner.cancelled) throw new Error("Kernel callback owner is no longer active.");
    if (owner.reply) throw new Error("A Gateway request is already pending in this cell.");
    const bytes = Buffer.from(JSON.stringify(payload));
    if (bytes.length > maxMessageBytes) throw new Error("Callback request exceeds process message budget.");
    const reply = owner.reply = { ...Promise.withResolvers(), requestId: ++owner.requestId, chunks: [], bytes: 0 };
    for (let offset = 0; offset < bytes.length; offset += blockBytes) {
      owner.emit({ kind: "callback_chunk", requestId: reply.requestId, channel,
        data: bytes.subarray(offset, offset + blockBytes).toString("base64"), final: offset + blockBytes >= bytes.length });
    }
    return reply.promise;
  }
  return new Proxy(Object.freeze({
    call: (name, args = {}) => request("gateway", { name, args }),
    describe: (name) => request("describe", name === undefined ? {} : { name }),
    search: (query, limit) => request("describe", limit === undefined ? { query } : { query, limit }),
  }), {
    get(target, name) {
      if (Object.hasOwn(target, name)) return target[name];
      if (typeof name === "string" && name !== "then") return (args) => target.call(name, args);
    },
  });
}

function receiveReply(owner, { requestId, data, final }) {
  const reply = owner?.reply;
  if (!reply || reply.requestId !== requestId) return;
  try {
    const bytes = Buffer.from(data, "base64");
    reply.bytes += bytes.length;
    if (reply.bytes > maxMessageBytes) throw new Error("Callback reply exceeds process message budget.");
    reply.chunks.push(bytes);
    if (!final) return;
    owner.reply = undefined;
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(reply.chunks, reply.bytes)));
    if (value?.ok !== true) throw new Error(value?.error ?? "Gateway callback failed.");
    reply.resolve(value.value);
  } catch (error) {
    owner.reply = undefined;
    reply.reject(error);
  }
}
