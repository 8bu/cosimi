import { parse as parseYaml } from "yaml";

interface ChatterbotFile {
  categories: string[];
  conversations: string[][];
}

/**
 * Chatterbot-corpus YAML format:
 *
 *   categories:
 *   - greetings
 *   conversations:
 *   - - Hello
 *     - Hi
 *   - - Hi, How is it going?
 *     - Good
 *   - - Top of the morning to you!
 *     - And the rest of the day to you.
 *
 * Each conversation is a thread of ordered utterances. A 2-turn thread
 * yields one (input, response) pair. A 3+ turn thread is flattened with
 * a sliding window: (t0, t1), (t1, t2), ...
 *
 * The file's first category becomes the `topic` for every pair.
 */
export function parseChatterbotYaml(
  text: string,
): Array<{ input: string; response: string; topic: string }> {
  const doc = parseYaml(text) as ChatterbotFile;
  const topic = doc.categories?.[0] ?? "general";
  const pairs: Array<{ input: string; response: string; topic: string }> = [];
  for (const thread of doc.conversations ?? []) {
    for (let i = 0; i < thread.length - 1; i++) {
      pairs.push({ input: thread[i]!, response: thread[i + 1]!, topic });
    }
  }
  return pairs;
}
