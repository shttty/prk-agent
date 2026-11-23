import { readFacadeMember } from "./read-facade-member.mjs";
import { rejectFacadeMutation } from "./reject-facade-mutation.mjs";

export function facade(ctx, owner, label, members) {
  return new Proxy(members, {
    get: readFacadeMember.bind(undefined, ctx, owner, label),
    set: rejectFacadeMutation.bind(undefined, ctx, label),
    defineProperty: rejectFacadeMutation.bind(undefined, ctx, label),
    deleteProperty: rejectFacadeMutation.bind(undefined, ctx, label),
  });
}
