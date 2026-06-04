/* Bulk-remove confirmation. Base UI AlertDialog (focus-trap + aria-modal + Esc).
   On confirm it deletes each document via the admin client, then calls `onDone`
   (the route invalidates the documents query + toasts). Token-styled via the
   ported `.card` surface; the danger confirm uses `Btn kind="danger"`. */
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { useState } from "react";
import { Btn } from "@/components/shell/atoms";
import { deleteDocument } from "@/lib/api/admin-client";

export function RemoveDialog({
  open,
  ids,
  onClose,
  onDone,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const n = ids.length;

  async function confirm() {
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => deleteDocument(id)));
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className="sheet-scrim"
          style={{ background: "rgba(10,12,20,0.34)" }}
        />
        <AlertDialog.Popup
          className="card"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 50,
            width: "min(420px, calc(100vw - 32px))",
          }}
        >
          <div className="card-head">
            <div>
              <AlertDialog.Title className="card-head-t">
                Remove {n} {n === 1 ? "document" : "documents"}?
              </AlertDialog.Title>
            </div>
          </div>
          <div className="card-body">
            <AlertDialog.Description
              style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}
            >
              This permanently deletes the selected {n === 1 ? "document" : "documents"}, including
              all derived chunks and generated Q/A pairs. This cannot be undone.
            </AlertDialog.Description>
            <div className="row" style={{ marginTop: 18, justifyContent: "flex-end", gap: 8 }}>
              <AlertDialog.Close
                render={
                  <Btn kind="ghost" disabled={busy}>
                    Cancel
                  </Btn>
                }
              />
              <Btn kind="danger" icon="trash" disabled={busy} onClick={confirm}>
                {busy ? "Removing…" : "Remove"}
              </Btn>
            </div>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
