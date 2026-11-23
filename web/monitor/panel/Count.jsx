
export function Count({ added, removed }) {
  return <><span className={added > 0 ? "is-add" : "is-zero"}>+{added}</span> <span className={removed > 0 ? "is-del" : "is-zero"}>-{removed}</span></>;
}
