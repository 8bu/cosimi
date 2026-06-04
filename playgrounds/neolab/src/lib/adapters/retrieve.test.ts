import { toRetrieveVM, highlight } from "@/lib/adapters/retrieve";
import type { RetrievalResult } from "@cosimi/core";

const docTitle = (id: string) => (id === "doc_3d10" ? "API Auth" : null);

test("pair-hit becomes a hit with grounded answer cited rank 1", () => {
  const res: RetrievalResult = {
    hits: [
      {
        kind: "pair",
        similarity: 0.91,
        input: "How long do tokens last?",
        response: "3600 seconds.",
        context: [
          {
            id: "doc_3d10#c0",
            documentId: "doc_3d10",
            content: "tokens expire after 3600 seconds",
            sectionTitle: null,
            hops: 0,
            similarity: 0.91,
          },
          {
            id: "doc_3d10#c1",
            documentId: "doc_3d10",
            content: "neighbor",
            sectionTitle: null,
            hops: 1,
            similarity: 0.7,
          },
        ],
      },
    ],
  };
  const vm = toRetrieveVM("token expiry", res, docTitle, 120);
  expect(vm.answer).toEqual({ text: "3600 seconds.", cite: 1 });
  expect(vm.hits[0]).toMatchObject({
    rank: 1,
    kind: "pair",
    score: 0.91,
    docId: "doc_3d10",
    docTitle: "API Auth",
    chunkId: "doc_3d10#c0",
    vec: 0.91,
    lex: null,
  });
  expect(vm.hits[0]!.neighbors).toHaveLength(1);
  expect(vm.tookMs).toBe(120);
});

test("chunk-hit carries its pairs; no answer when top hit is a chunk", () => {
  const res: RetrievalResult = {
    hits: [
      {
        kind: "chunk",
        similarity: 0.8,
        chunk: {
          id: "doc_x#c2",
          documentId: "doc_x",
          content: "body",
          sectionTitle: "S",
          hops: 0,
          similarity: 0.8,
        },
        pairs: [{ input: "q1", response: "a1", similarity: 0.6 }],
      },
    ],
  };
  const vm = toRetrieveVM("q", res, () => null, 90);
  expect(vm.answer).toBeNull();
  expect(vm.hits[0]).toMatchObject({ rank: 1, kind: "chunk", chunkId: "doc_x#c2" });
  expect(vm.hits[0]!.text).toContain("body");
  expect(vm.hits[0]!.pairs).toEqual([{ q: "q1", a: "a1" }]);
});

test("highlight wraps query terms in <mark>", () => {
  expect(highlight("token expiry", "token")).toContain("<mark>token</mark>");
});

test("highlight escapes html before marking", () => {
  expect(highlight("a <b> tag", "tag")).toBe("a &lt;b&gt; <mark>tag</mark>");
});
