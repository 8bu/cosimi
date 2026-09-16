import { toMissVM } from "@/lib/adapters/fallback";

test("maps unanswered row to miss vm with source", () => {
  const vm = toMissVM({
    id: 5,
    input: "how to X?",
    normalized_input: "how to x?",
    source: "retrieve",
    count: 12,
    last_seen: "2026-06-04 09:00",
  });
  expect(vm).toEqual({
    id: 5,
    query: "how to X?",
    count: 12,
    lastSeen: "2026-06-04 09:00",
    source: "retrieve",
  });
});
