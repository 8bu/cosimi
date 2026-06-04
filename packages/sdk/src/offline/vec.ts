/** Cosine similarity in [-1, 1]. Returns 0 if either vector has zero magnitude. */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    ma += a[i]! * a[i]!;
    mb += b[i]! * b[i]!;
  }
  if (ma === 0 || mb === 0) return 0;
  return dot / (Math.sqrt(ma) * Math.sqrt(mb));
}
