import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { RetrievalTurn } from "../types";
import { AnswerBubble } from "./AnswerBubble";

afterEach(cleanup);
const done = (response: string | null): RetrievalTurn => ({
  id: "t",
  query: "q",
  status: "done",
  result: {
    hits: response ? [{ kind: "pair", similarity: 1, input: "q", response, context: [] }] : [],
  },
});

it("shows answer + Details when chunks present", () => {
  render(<AnswerBubble turn={done("30 days")} />);
  expect(screen.getByText("30 days")).toBeTruthy();
  expect(screen.getByRole("button", { name: /details/i })).toBeTruthy();
});
it("opens the detail sheet", async () => {
  const user = userEvent.setup();
  render(<AnswerBubble turn={done("30 days")} />);
  await user.click(screen.getByRole("button", { name: /details/i }));
  expect(screen.getByText(/retrieved sources/i)).toBeTruthy();
});
it("nothing-relevant on empty; no Details", () => {
  render(<AnswerBubble turn={done(null)} />);
  expect(screen.getByText(/nothing relevant/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /details/i })).toBeNull();
});
it("error state renders", () => {
  render(<AnswerBubble turn={{ id: "t", query: "q", status: "error", message: "boom" }} />);
  expect(screen.getByText(/boom/)).toBeTruthy();
});
