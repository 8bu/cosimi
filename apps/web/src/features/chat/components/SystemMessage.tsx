import type { SystemMsg } from "@/features/chat/types";

const VARIANT_CLASS: Record<SystemMsg["variant"], string> = {
  success: "text-success",
  info: "text-muted-foreground",
  error: "text-destructive",
};

export function SystemMessage({ msg }: { msg: SystemMsg }) {
  return (
    <div
      className={`py-2 text-xs italic ${VARIANT_CLASS[msg.variant]}`}
      role={msg.variant === "error" ? "alert" : undefined}
    >
      {msg.text}
    </div>
  );
}
