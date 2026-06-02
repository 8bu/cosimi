import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import type { Source } from "@cosimi/core";
import { parse as parseYaml } from "yaml";
import { closeDb } from "#client";
import { createBatch, setBatchCount } from "#repositories/import_batches";
import { insertManyPairs } from "#repositories/pairs";
import { parseChatterbotYaml } from "#scripts/chatterbot";

type Pair = { input: string; response: string; topic?: string };

const VALID_SOURCES = new Set<Source>(["seed", "user", "chat", "llm"]);

// Format detection: extension first, then content sniff for chatterbot.
function detect(file: string, text: string): "json" | "jsonl" | "yaml-flat" | "yaml-chatterbot" {
  const ext = extname(file).toLowerCase();
  if (ext === ".json") return "json";
  if (ext === ".jsonl") return "jsonl";
  // .yaml or .yml — sniff top-level key
  if (/^conversations\s*:/m.test(text) || /^categories\s*:/m.test(text)) {
    return "yaml-chatterbot";
  }
  return "yaml-flat";
}

function parseJsonArray(text: string): Pair[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error("expected top-level JSON array");
  return data as Pair[];
}

function parseJsonl(text: string): Pair[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Pair);
}

function parseYamlFlat(text: string): Pair[] {
  const data = parseYaml(text);
  if (!Array.isArray(data)) throw new Error("expected top-level YAML list");
  return data as Pair[];
}

async function loadFile(file: string): Promise<{ pairs: Pair[]; defaultTopic?: string }> {
  const text = await readFile(file, "utf8");
  const fmt = detect(file, text);
  switch (fmt) {
    case "json":
      return { pairs: parseJsonArray(text) };
    case "jsonl":
      return { pairs: parseJsonl(text) };
    case "yaml-chatterbot": {
      const pairs = parseChatterbotYaml(text);
      const defaultTopic = pairs[0]?.topic;
      return { pairs, defaultTopic };
    }
    case "yaml-flat":
      return { pairs: parseYamlFlat(text) };
  }
}

async function seedFile(
  file: string,
  source: Source,
  topicOverride?: string,
  locale?: string,
): Promise<void> {
  const { pairs, defaultTopic } = await loadFile(file);
  const topicForBatch = topicOverride ?? defaultTopic;
  const batchId = await createBatch(source, topicForBatch, `seed from ${file}`);
  const rows = pairs.map((p) => ({
    input: p.input,
    response: p.response,
    source,
    topic: topicOverride ?? p.topic ?? defaultTopic ?? null,
    batch_id: batchId,
    locale,
  }));
  const count = await insertManyPairs(rows);
  await setBatchCount(batchId, count);
  console.log(
    `seeded ${count} pairs from ${file} under batch #${batchId} (locale=${locale ?? "und"})`,
  );
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      source: { type: "string", default: "seed" },
      topic: { type: "string" },
      // BCP-47 locale tag for every row in this run. Omitted → 'und'
      // (Postgres default at the schema level; see migration 010).
      locale: { type: "string" },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error(
      "usage: seed <file> [<file> ...] [--source=seed|user|chat|llm] [--topic=...] [--locale=vi|en|...]",
    );
    process.exit(2);
  }

  const source = values.source as Source;
  if (!VALID_SOURCES.has(source)) {
    console.error(`invalid --source=${source}; expected one of: ${[...VALID_SOURCES].join(",")}`);
    process.exit(2);
  }

  for (const file of positionals) {
    await seedFile(file, source, values.topic, values.locale);
  }
}

try {
  await main();
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
} finally {
  await closeDb();
}
