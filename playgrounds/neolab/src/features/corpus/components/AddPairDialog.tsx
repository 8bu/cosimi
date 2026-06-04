/* Add-pair modal (Corpus pane 3). Base UI Dialog gives focus-trap + aria-modal +
   Esc. On save → POST /admin/pairs (also clears matching unanswered server-side),
   then onSaved() lets the route invalidate caches. The key is never touched here. */
import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Btn, Field } from "@/components/shell/atoms";
import { addPair } from "@/lib/api/admin-client";

export function AddPairDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = q.trim().length > 0 && a.trim().length > 0 && !saving;

  function reset() {
    setQ("");
    setA("");
    setSaving(false);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await addPair(q.trim(), a.trim());
      onSaved();
      toast.success("Pair added.");
      reset();
      onOpenChange(false);
    } catch (err) {
      setSaving(false);
      toast.error(err instanceof Error ? err.message : "Failed to add pair.");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-scrim" />
        <Dialog.Popup
          className="card"
          aria-label="Add Q/A pair"
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(540px, calc(100vw - 32px))",
            padding: 20,
            zIndex: 60,
          }}
        >
          <Dialog.Title style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
            Add Q/A pair
          </Dialog.Title>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Question">
              <textarea
                className="textarea"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="What question should this answer?"
              />
            </Field>
            <Field label="Answer">
              <textarea
                className="textarea"
                value={a}
                onChange={(e) => setA(e.target.value)}
                placeholder="The grounded answer to return."
              />
            </Field>
          </div>
          <div className="row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
            <Dialog.Close render={<Btn kind="ghost">Cancel</Btn>} />
            <Btn kind="pri" icon="plus" disabled={!canSave} onClick={save}>
              {saving ? "Saving…" : "Add pair"}
            </Btn>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
