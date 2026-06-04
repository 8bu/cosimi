import { randomUUID } from "node:crypto";
import type { Chunk } from "@cosimi/db-core";
import { chunk as chunkText } from "./chunking/index";
import { estimateTokens } from "./tokens";
import { extractRelations } from "./relations";
import { generatePairs } from "./generate";
import { auditPair, reverseCheck } from "./audit";
import type {
  ChunkNode,
  IngestDeps,
  IngestInput,
  IngestOptions,
  IngestProgress,
  IngestResult,
} from "./types";

const DEFAULTS = {
  pairsPerChunk: 4,
  splitThreshold: 600,
  chunkSplitThreshold: 0.55,
  minSentences: 3,
  minGenTokens: 12,
  reverseCheck: false,
  reverseCheckThreshold: 0.75,
};

function slug(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "doc"
  );
}

interface Flat {
  node: ChunkNode;
  isLeaf: boolean;
  parentIndex: number | null;
}

/** A generated pair carried in memory from generation through audit/reverse (spec E5). */
interface Candidate {
  pairId: number;
  q: string;
  a: string;
  qaEmbedding: number[];
  chunk: Chunk;
}

/** Depth-first pre-order flatten: parent precedes its children; assigns reading order. */
function flatten(nodes: ChunkNode[]): Flat[] {
  const out: Flat[] = [];
  const walk = (node: ChunkNode, parentIndex: number | null) => {
    const isLeaf = !node.children || node.children.length === 0;
    const myIndex = out.length;
    out.push({ node, isLeaf, parentIndex });
    if (node.children) for (const c of node.children) walk(c, myIndex);
  };
  for (const n of nodes) walk(n, null);
  return out;
}

export interface IngestService {
  ingest(input: IngestInput): Promise<IngestResult>;
}

export function createIngestService(deps: IngestDeps, options: IngestOptions = {}): IngestService {
  const opts = { ...DEFAULTS, ...options };
  const log = deps.logger;

  return {
    async ingest(input): Promise<IngestResult> {
      const locale = input.locale ?? "und";
      const source = input.source ?? "llm";
      const bytes =
        typeof input.content === "string" ? new TextEncoder().encode(input.content) : input.content;
      const text =
        typeof input.content === "string" ? input.content : new TextDecoder().decode(bytes);
      const storageKey = input.storageKey ?? `${slug(input.title)}-${randomUUID()}`;

      // Best-effort progress sink (the admin-api ingest job mirrors this to the
      // ingest_jobs row the UI polls). Never let a progress write break ingest.
      const progress: IngestProgress = {
        stage: "chunking",
        chunksTotal: 0,
        chunksDone: 0,
        pairsGenerated: 0,
        pairsAudited: 0,
        pairsPassed: 0,
      };
      const emit = async () => {
        try {
          await deps.onProgress?.(progress);
        } catch {
          /* progress is advisory — swallow */
        }
      };
      await emit();

      // 1. Ingest
      await deps.storage.upload(bytes, storageKey, input.mimeType);
      const doc = await deps.documents.create({
        title: input.title,
        mimeType: input.mimeType,
        storageKey,
      });

      // 2. Chunk → flatten → embed → persist (parent before child) → PARENT_OF edges
      const forest = await chunkText(text, input.mimeType, deps.embedder, {
        splitThreshold: opts.splitThreshold,
        chunkSplitThreshold: opts.chunkSplitThreshold,
        minSentences: opts.minSentences,
      });
      const flats = flatten(forest);
      const chunkEmbeddings =
        flats.length > 0 ? await deps.embedder.embed(flats.map((f) => f.node.content)) : [];

      const persisted: Chunk[] = [];
      for (let i = 0; i < flats.length; i++) {
        const f = flats[i]!;
        const created = await deps.chunks.create({
          documentId: doc.id,
          content: f.node.content,
          chunkIndex: i,
          sectionTitle: f.node.sectionTitle,
          embedding: chunkEmbeddings[i]!,
        });
        persisted.push(created);
        if (f.parentIndex !== null) {
          await deps.graph.addEdge(persisted[f.parentIndex]!.id, created.id, "PARENT_OF");
        }
      }

      // 3. Relations — over LEAF chunks only (same policy as generation below).
      // Structural parents hold a thin heading+lead, not body text, so feeding
      // them to the cross-reference LLM adds noise and skews the <3-chunk skip.
      // `leafFlatIndices` maps the LLM's 0-based positions back to `persisted`.
      const leafFlatIndices = flats.flatMap((f, i) => (f.isLeaf ? [i] : []));
      const edges = await extractRelations(
        deps.generateLLM,
        leafFlatIndices.map((i) => persisted[i]!.content),
      );
      for (const e of edges) {
        await deps.graph.addEdge(
          persisted[leafFlatIndices[e.from]!]!.id,
          persisted[leafFlatIndices[e.to]!]!.id,
          e.type,
        );
      }

      // 4. Generate — leaf chunks only
      progress.stage = "generating";
      progress.chunksTotal = leafFlatIndices.length;
      await emit();
      const candidates: Candidate[] = [];
      let generated = 0;
      for (let i = 0; i < flats.length; i++) {
        if (!flats[i]!.isLeaf) continue;
        const chunkRow = persisted[i]!;
        progress.chunksDone++;
        // Skip fact-poor chunks (headings, nav fragments). The generation prompt
        // would otherwise dutifully hallucinate 3–5 pairs from "Experience /
        // Full-time Remote" and pollute retrieval. Token gate is a cheap pre-filter
        // before the LLM call; the prompt's []-escape catches longer-but-empty chunks.
        if (estimateTokens(chunkRow.content) < opts.minGenTokens) {
          log?.info(
            { stage: "generate", documentId: doc.id, chunkId: chunkRow.id },
            "skip: below minGenTokens",
          );
          await emit();
          continue;
        }
        const pairs = await generatePairs(deps.generateLLM, chunkRow.content, opts.pairsPerChunk);
        if (pairs.length === 0) {
          log?.warn({ stage: "generate", documentId: doc.id, chunkId: chunkRow.id }, "no pairs");
          await emit();
          continue;
        }
        const embeds = await deps.embedder.embed(pairs.map((p) => `${p.q}: ${p.a}`));
        for (let j = 0; j < pairs.length; j++) {
          const p = pairs[j]!;
          const { id } = await deps.pairs.insertPair({ input: p.q, response: p.a, source, locale });
          await deps.pairs.setPairVector(id, {
            embedding: embeds[j]!,
            sourceChunk: chunkRow.id,
            auditStatus: "pending",
          });
          await deps.mapChunkToPair(chunkRow.id, id);
          candidates.push({ pairId: id, q: p.q, a: p.a, qaEmbedding: embeds[j]!, chunk: chunkRow });
          generated++;
        }
        progress.pairsGenerated = generated;
        await emit();
      }

      // 5. Audit (in-memory candidates — spec E5)
      progress.stage = "auditing";
      await emit();
      const counts = { pass: 0, fail: 0, rewrite: 0, flagged: 0 };
      const passed = new Set<number>();
      for (const c of candidates) {
        const decision = await auditPair(deps.auditLLM, c.chunk.content, c.q, c.a);
        if (decision.action === "pass") {
          await deps.setPairStatus(c.pairId, "pass");
          passed.add(c.pairId);
          counts.pass++;
        } else if (decision.action === "fail") {
          await deps.softDeletePair(c.pairId);
          counts.fail++;
        } else if (decision.action === "rewrite") {
          await deps.updatePairResponse(c.pairId, decision.response);
          const [emb] = await deps.embedder.embed([`${c.q}: ${decision.response}`]);
          // Only the vector changes; sourceChunk/audit_status are left as-is here
          // (setPairVector writes them only when provided) and status is set below.
          await deps.pairs.setPairVector(c.pairId, { embedding: emb! });
          await deps.setPairStatus(c.pairId, "pass");
          c.a = decision.response;
          c.qaEmbedding = emb!;
          passed.add(c.pairId);
          counts.rewrite++;
        } else {
          log?.warn({ stage: "audit", documentId: doc.id, pairId: c.pairId }, "skip");
        }
        progress.pairsAudited++;
        progress.pairsPassed = passed.size;
        await emit();
      }

      // 6. Reverse check (optional) — only passed pairs
      if (opts.reverseCheck) {
        for (const c of candidates) {
          if (!passed.has(c.pairId)) continue;
          const flag = await reverseCheck(
            deps.auditLLM,
            deps.embedder,
            c.a,
            c.qaEmbedding,
            opts.reverseCheckThreshold,
          );
          if (flag) {
            await deps.setPairStatus(c.pairId, "flagged");
            counts.flagged++;
          }
        }
      }

      progress.stage = "done";
      await emit();

      return {
        documentId: doc.id,
        chunkCount: persisted.length,
        relationCount: edges.length,
        pairs: { generated, ...counts },
      };
    },
  };
}
