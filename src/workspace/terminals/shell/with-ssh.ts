// The encoded body excludes its own assignment, so nested hops do not grow it.
export function withSsh(rc: string): string {
  const body = String.raw`
prk_ssh() {
  if (( $# == 0 )); then printf 'usage: prk_ssh [ssh options] <destination>\n' >&2; return 2; fi
  command ssh -t "$@" "exec bash --noprofile --norc -c 'exec bash --noprofile --rcfile <(printf \"%s\n\" \"__prk_rcfile=1\" \"__prk_rc_b64=$__prk_rc_b64\"; printf %s \"$__prk_rc_b64\" | base64 -d) -i'"
}
` + rc;
  return `__prk_rc_b64=${Buffer.from(body).toString("base64")}\n${body}`;
}
