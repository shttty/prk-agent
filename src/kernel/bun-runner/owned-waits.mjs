import { connect } from "node:net";
import { Resolver } from "node:dns/promises";
import { setTimeout as sleep } from "node:timers/promises";

function hold(owner, done, stop = () => {}) {
  const resource = { done, stop };
  owner.resources.add(resource);
  const release = () => owner.resources.delete(resource);
  void done.then(release, release);
}

function ownedWaits(owner) {
  const signal = owner.abort.signal;
  let resolver;
  function assertOpen() {
    signal.throwIfAborted();
    if (!owner.accepting) throw new Error("Kernel cell ended.");
  }
  return {
    sleep(ms) {
      assertOpen();
      const pending = sleep(ms, undefined, { signal });
      hold(owner, pending);
      return pending;
    },
    connect({ host, port }) {
      assertOpen();
      const connected = Promise.withResolvers();
      const closed = Promise.withResolvers();
      const socket = connect({ host, port });
      socket.once("connect", () => connected.resolve(socket));
      socket.on("error", connected.reject);
      socket.once("close", () => {
        connected.reject(new Error("Socket closed before connecting."));
        closed.resolve();
      });
      hold(owner, closed.promise, () => socket.destroy());
      void connected.promise.catch(() => {});
      return connected.promise;
    },
    fetch(url, init) {
      assertOpen();
      return ownedFetch(owner, url, init);
    },
    resolve(name, rrtype = "A") {
      assertOpen();
      if (!resolver) resolver = new Resolver();
      const pending = resolver.resolve(name, rrtype);
      hold(owner, pending, () => resolver.cancel());
      return pending;
    },
  };
}
