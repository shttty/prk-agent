/** The inside of one banner: the message on the left, its actions (reload, retry, ...) on the right. */
export default function BannerRow({ actions, children }) {
  return <div className="pi-banner-row">
    <div className="pi-banner-text">{children}</div>
    {actions ? <div className="pi-banner-actions">{actions}</div> : null}
  </div>;
}
