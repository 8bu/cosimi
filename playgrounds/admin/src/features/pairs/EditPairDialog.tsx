import { useEffect, useState } from "react";
import type { AdminPair } from "@cosimi/core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEditPair, type EditPairBody } from "@/api/pairs";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pair: AdminPair;
}

/**
 * EditPairDialog fields: input/response/topic/flagged. Locale is
 * deliberately absent — AdminPair has no `locale` field and admin-api's
 * PATCH EditSchema rejects it. Phase the locale-edit UX separately if/
 * when product asks.
 *
 * Only changed fields are PATCH-shipped: a no-op submit (everything
 * matches the pristine pair) sends an empty body, which admin-api
 * treats as "touch updated_at only". That's fine — it's a single
 * sub-ms UPDATE — but the savings here keep the diff comprehensible
 * if the operator later checks logs.
 */
export function EditPairDialog({ open, onOpenChange, pair }: Props) {
  const [input, setInput] = useState(pair.input);
  const [response, setResponse] = useState(pair.response);
  const [topic, setTopic] = useState(pair.topic ?? "");
  const [flagged, setFlagged] = useState(pair.flagged);
  const edit = useEditPair();

  // Re-sync state when a different pair is loaded into the dialog (the
  // parent reuses the dialog instance across rows; without this the
  // form would stick on the previous pair's values).
  useEffect(() => {
    setInput(pair.input);
    setResponse(pair.response);
    setTopic(pair.topic ?? "");
    setFlagged(pair.flagged);
    edit.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.id]);

  const submit = () => {
    const patch: EditPairBody = {};
    if (input !== pair.input) patch.input = input;
    if (response !== pair.response) patch.response = response;
    if (topic !== (pair.topic ?? "")) patch.topic = topic;
    if (flagged !== pair.flagged) patch.flagged = flagged;
    edit.mutate({ id: pair.id, patch }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit pair</DialogTitle>
          <DialogDescription>
            Updating the input re-normalizes server-side; the matcher picks up the new form on the
            next request.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-muted-foreground" htmlFor="edit-input">
            Input
          </label>
          <Textarea
            id="edit-input"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <label className="text-xs text-muted-foreground" htmlFor="edit-response">
            Response
          </label>
          <Textarea
            id="edit-response"
            rows={3}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <label className="text-xs text-muted-foreground" htmlFor="edit-topic">
            Topic (optional)
          </label>
          <Input id="edit-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
            />
            Flagged
          </label>
          {/* Phase 15: error display moved to sonner toast (see
              useEditPair onError). Keeping an inline alert here would
              double-surface the same failure. */}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={edit.isPending || !input.trim() || !response.trim()}>
            {edit.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
