
export function GroupName({ parts }) {
  const [head, tail, machine] = parts;
  return <>
    <span data-part="head">{head}</span>
    {tail === null ? null : <span data-part="tail">{tail}</span>}
    <span data-part="machine">{machine}</span>
  </>;
}
