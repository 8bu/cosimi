import type { PropsWithChildren } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  destructive?: boolean;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * Workspace-shared destructive-action gate. Phase 13 used per-feature
 * dialogs (RejectDialog, EditPairDialog); Phase 14 onwards routes every
 * destructive flow through this component so the confirmation chrome
 * stays consistent and the DialogDescription a11y wiring is in one
 * place. `children` becomes the dialog body, wrapped in
 * DialogDescription — Radix emits a console warning if Dialog has no
 * Description (Phase 12 learned this on TeachDialog).
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  destructive,
  onConfirm,
  confirmLabel,
  cancelLabel,
  children,
}: PropsWithChildren<Props>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {/* DialogDescription renders <p> by default — callers MUST
              pass inline children only (text, <code>, <span>). Block
              children inside <p> would be invalid HTML and trigger
              hydration warnings. */}
          <DialogDescription>{children}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm}>
            {confirmLabel ?? (destructive ? "Delete" : "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
