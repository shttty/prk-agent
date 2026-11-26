/** The inside of one banner: the message on the left, its actions (reload, retry, ...) on the right. */
import type { ReactNode } from "react";

export default function BannerRow({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return <div className="pi-banner-row">
    <div className="pi-banner-text">{children}</div>
    {actions ? <div className="pi-banner-actions">{actions}</div> : null}
  </div>;
}
