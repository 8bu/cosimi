import { sql, insertManyPairs, type InsertPairInput } from "@cosimi/adapter-postgres";
import { toVectorLiteral } from "@cosimi/retriever";
import { mkVec, setPairEmbedding } from "./fixtures";

export interface RetrieveFixtureIds {
  docId: string;
  chunkA: string;
  chunkB: string;
  chunkC: string;
  chunkD: string;
  pairA: number;
  pairB: number;
  queryVec: number[];
}

/**
 * Graph:  chunkA --REFERENCES--> chunkB --REFERENCES--> chunkC ;  chunkD isolated.
 * Vectors: A=e0 (sim 1), B approx e0 (cos 0.96), C=e1 (sim 0), D=e7 (sim 0).
 * Query=e0. With minSimilarity 0.5: seeds={A,B}; walk reaches C (1 hop from B);
 * D unreachable + sub-threshold. retrieve returns [A,B,C] ranked, NOT D -- and C
 * proves graph neighbors ride along below the seed floor.
 */
export async function seedRetrieveFixtures(): Promise<RetrieveFixtureIds> {
  const db = sql();
  const [doc] = await db<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key)
    VALUES ('kb', 'text/markdown', 'kb.md') RETURNING id
  `;
  const docId = doc!.id;

  const mkChunk = async (content: string, idx: number, vec: number[], section: string) => {
    const [row] = await db<{ id: string }[]>`
      INSERT INTO chunks (document_id, content, chunk_index, section_title, embedding)
      VALUES (${docId}, ${content}, ${idx}, ${section}, ${toVectorLiteral(vec)}::vector)
      RETURNING id
    `;
    return row!.id;
  };
  const chunkA = await mkChunk("refund window is 30 days", 0, mkVec({ 0: 1 }), "Refunds");
  const chunkB = await mkChunk(
    "refund exceptions apply",
    1,
    mkVec({ 0: Math.cos(0.28), 1: Math.sin(0.28) }),
    "Refunds",
  );
  const chunkC = await mkChunk("store hours are nine to five", 2, mkVec({ 1: 1 }), "Hours");
  const chunkD = await mkChunk("careers and hiring", 3, mkVec({ 7: 1 }), "Careers");

  await db`INSERT INTO chunk_relations (from_chunk_id, to_chunk_id, relation_type) VALUES (${chunkA}, ${chunkB}, 'REFERENCES')`;
  await db`INSERT INTO chunk_relations (from_chunk_id, to_chunk_id, relation_type) VALUES (${chunkB}, ${chunkC}, 'REFERENCES')`;

  const pairRows: InsertPairInput[] = [
    { input: "how long to get a refund", response: "30 days", source: "llm" },
    { input: "any refund exceptions", response: "yes, some", source: "llm" },
  ];
  await insertManyPairs(pairRows);
  const inserted = await db<{ id: number; input: string }[]>`
    SELECT id::int AS id, input FROM pairs
    WHERE input IN ('how long to get a refund','any refund exceptions') ORDER BY id ASC
  `;
  const pairA = inserted.find((r) => r.input === "how long to get a refund")!.id;
  const pairB = inserted.find((r) => r.input === "any refund exceptions")!.id;
  await setPairEmbedding(pairA, mkVec({ 0: Math.cos(0.2), 1: Math.sin(0.2) }));
  await setPairEmbedding(pairB, mkVec({ 0: Math.cos(0.5), 1: Math.sin(0.5) }));
  await db`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunkA}, ${pairA})`;
  await db`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunkB}, ${pairB})`;

  return { docId, chunkA, chunkB, chunkC, chunkD, pairA, pairB, queryVec: mkVec({ 0: 1 }) };
}

export interface HitFixtureIds {
  docId: string;
  chunkA: string; // source of pairP; vector e1 (orthogonal to query e0 -> low chunk sim)
  chunkB: string; // graph neighbor of chunkA
  chunkC: string; // vector ~e0 (high chunk sim -> a chunk-hit)
  pairP: number; // vector ~e0 (high pair sim -> a pair-hit); linked to chunkA
  queryVec: number[]; // e0
}

/**
 * Graph: chunkA --REFERENCES--> chunkB.  chunkC is separate.
 * Vectors (query = e0):
 *   chunkA = e1            -> chunk sim ~0   (so chunkA only surfaces via pairP's context)
 *   chunkB = e7            -> chunk sim ~0
 *   chunkC = cos16deg.e0   -> chunk sim ~0.96 (a CHUNK hit)
 *   pairP  = cos10deg.e0   -> pair  sim ~0.98 (a PAIR hit; its source chunk is chunkA)
 * Expect retrieve(): hits = [pairP (0.98), chunkC (0.96)]; pairP.context = [chunkA(hops0), chunkB(hops1)].
 */
export async function seedHitFixtures(): Promise<HitFixtureIds> {
  const db = sql();
  const [doc] = await db<{ id: string }[]>`
    INSERT INTO documents (title, mime_type, storage_key) VALUES ('kb','text/markdown','kb.md') RETURNING id`;
  const docId = doc!.id;
  const mkChunk = async (content: string, idx: number, vec: number[], section: string) => {
    const [row] = await db<{ id: string }[]>`
      INSERT INTO chunks (document_id, content, chunk_index, section_title, embedding)
      VALUES (${docId}, ${content}, ${idx}, ${section}, ${toVectorLiteral(vec)}::vector) RETURNING id`;
    return row!.id;
  };
  const chunkA = await mkChunk("about and contact narrative", 0, mkVec({ 1: 1 }), "About");
  const chunkB = await mkChunk("experience narrative", 1, mkVec({ 7: 1 }), "Experience");
  const chunkC = await mkChunk(
    "the stack is typescript and vue",
    2,
    mkVec({ 0: Math.cos(0.28), 1: Math.sin(0.28) }),
    "Skills",
  );
  await db`INSERT INTO chunk_relations (from_chunk_id, to_chunk_id, relation_type) VALUES (${chunkA}, ${chunkB}, 'REFERENCES')`;

  await insertManyPairs([
    { input: "what is the email address", response: "x@y.z", source: "llm" } as InsertPairInput,
  ]);
  const [p] = await db<{ id: number }[]>`
    SELECT id::int AS id FROM pairs WHERE input='what is the email address' ORDER BY id DESC LIMIT 1`;
  const pairP = p!.id;
  await setPairEmbedding(pairP, mkVec({ 0: Math.cos(0.17), 1: Math.sin(0.17) }));
  await db`INSERT INTO chunk_pair_map (chunk_id, pair_id) VALUES (${chunkA}, ${pairP})`;

  return { docId, chunkA, chunkB, chunkC, pairP, queryVec: mkVec({ 0: 1 }) };
}
