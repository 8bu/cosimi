import { toDocVM, mimeToType, toChunkVM, toPairVM } from "@/lib/adapters/documents";

test("mimeToType maps mime to doctype", () => {
  expect(mimeToType("text/markdown")).toBe("md");
  expect(mimeToType("application/pdf")).toBe("pdf");
  expect(mimeToType("text/plain")).toBe("txt");
  expect(mimeToType("application/json")).toBe("api");
  expect(mimeToType("text/html")).toBe("web");
  expect(mimeToType("anything/else")).toBe("txt");
});

test("toDocVM fills gaps with null, status indexed", () => {
  const vm = toDocVM({
    id: "d1",
    title: "Doc",
    mime_type: "text/markdown",
    created_at: "2026-06-01",
    chunkCount: 4,
    pairCount: 2,
  });
  expect(vm).toMatchObject({
    id: "d1",
    type: "md",
    status: "indexed",
    chunks: 4,
    pairs: 2,
    tokens: null,
    source: null,
    tags: [],
  });
});

test("toChunkVM maps fields, tokens null", () => {
  const vm = toChunkVM({
    id: "c1",
    chunk_index: 3,
    section_title: "Auth",
    content: "x",
    has_embedding: true,
  });
  expect(vm).toMatchObject({
    id: "c1",
    idx: 3,
    heading: "Auth",
    embedded: true,
    tokens: null,
    page: null,
  });
});

test("toPairVM uses audit status, no conf", () => {
  const vm = toPairVM({
    id: 9,
    input: "q?",
    response: "a.",
    audit_status: "pass",
    has_embedding: true,
  });
  expect(vm).toMatchObject({
    id: 9,
    q: "q?",
    a: "a.",
    auditStatus: "pass",
    conf: null,
    model: null,
  });
});
