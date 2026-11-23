export default function activate(pi) {
  pi.on("session_start", () => {
    // The SDK catches this rejected request asynchronously and reports it as <runtime>, without a plugin path.
    pi.sendUserMessage(null);
  });
}
