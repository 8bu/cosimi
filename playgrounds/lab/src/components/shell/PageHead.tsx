import type { ReactNode } from "react";

export function PageHead({
  kicker,
  title,
  sub,
  children,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="phead">
      <div className="phead-l">
        {kicker && <div className="kicker">{kicker}</div>}
        <h1 className="ptitle">{title}</h1>
        {sub && <p className="psub">{sub}</p>}
      </div>
      {children && <div className="phead-r">{children}</div>}
    </div>
  );
}
