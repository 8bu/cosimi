/* Right-anchored slide-over (SPEC §4.6). Base UI Dialog gives focus-trap +
   aria-modal + Esc + scrim-click-close; the `.sheet`/`.sheet-scrim` classes carry
   the visual. Base UI mounts on open and keeps the node during the exit transition
   (driven by [data-open]/[data-closed] in index.css). */
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Icon } from "@/lib/icon";
import { DType } from "@/components/shell/atoms";

export function Sheet({
  open,
  onClose,
  title,
  kicker,
  dtype,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  kicker?: ReactNode;
  dtype?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-scrim" />
        <Dialog.Popup className="sheet" aria-label={typeof title === "string" ? title : "Detail"}>
          <div className="sheet-head">
            {dtype && <DType type={dtype} />}
            <div className="sheet-head-main">
              {kicker && (
                <div className="kicker" style={{ color: "var(--accent)" }}>
                  {kicker}
                </div>
              )}
              <Dialog.Title
                style={{ fontSize: 15, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}
              >
                {title}
              </Dialog.Title>
            </div>
            <Dialog.Close className="iconbtn" aria-label="Close">
              <Icon name="close" size={16} />
            </Dialog.Close>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
