export function renderReplyImages(): string {
  return `<reply_images>
To show the user an image from the session's target machine in your reply, use Markdown image syntax, for example ![Chart](./chart.png). PNG, JPEG, GIF, and WebP are supported; use an absolute path, a ~/ path, or a path relative to the session's working directory.
</reply_images>`;
}
