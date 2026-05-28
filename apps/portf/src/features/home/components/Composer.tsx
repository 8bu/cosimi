import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useThreadsStore } from "@/store/threads";
import { AUTO_SUBMIT_DELAY_MS, TYPING_ANIM_MS_PER_CHAR } from "../tokens";

export interface ComposerHandle {
  runChipAnimation: (text: string) => void;
}

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "Tab"]);

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * V2 composer.
 *
 * Real <input> inside the design's `.input-row` wrapper. The decorative
 * `.input-row-cursor` blink CSS from the design source is intentionally
 * unused - the real text caret takes its place.
 *
 * The chip animation uses a synchronous-cancel pattern via `cancelRef`:
 * React `useState` updates are async and would let one more tick slip
 * through before the loop sees the cancel. Reading a ref between awaits
 * is the only correct shape.
 *
 * Cancel triggers: any keydown in the input whose `event.key` is not a
 * pure modifier (Shift / Control / Alt / Meta / Tab); Escape; another
 * `runChipAnimation()` call.
 */
export const Composer = forwardRef<ComposerHandle>(function Composer(_, ref) {
  const navigate = useNavigate();
  const create = useThreadsStore((s) => s.create);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const id = create();
      navigate({
        to: "/chat/$threadId",
        params: { threadId: id },
        search: { artifact: undefined },
        state: { initialPrompt: trimmed },
      });
    },
    [create, navigate],
  );

  const runChipAnimation = useCallback(
    async (text: string) => {
      cancelRef.current = true; // signal any in-flight loop to bail
      await Promise.resolve(); // let the prior loop observe the flag
      cancelRef.current = false;
      setValue("");

      for (let i = 0; i < text.length; i++) {
        await sleep(TYPING_ANIM_MS_PER_CHAR);
        if (cancelRef.current) return;
        setValue(text.slice(0, i + 1));
      }
      await sleep(AUTO_SUBMIT_DELAY_MS);
      if (cancelRef.current) return;
      submit(text);
    },
    [submit],
  );

  useImperativeHandle(ref, () => ({ runChipAnimation }), [runChipAnimation]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="input-row"
    >
      <input
        ref={inputRef}
        type="text"
        className="input-row-mono"
        style={{
          background: "transparent",
          border: 0,
          outline: "none",
          flex: 1,
        }}
        placeholder="Type a question, or pick one below…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (!MODIFIER_KEYS.has(e.key)) {
            cancelRef.current = true;
          }
        }}
      />
      <span className="kbd" style={{ marginRight: 4 }}>
        ⏎
      </span>
      <button type="submit" className="send-btn" aria-label="Send">
        ↑
      </button>
    </form>
  );
});
