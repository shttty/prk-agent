import { readProjectMember } from "../../sdk-facade/read-project-member.mjs";

export function unavailable(ctx, label, members = {}) {
  return new Proxy(members, { get: readProjectMember.bind(undefined, ctx, label) });
}
