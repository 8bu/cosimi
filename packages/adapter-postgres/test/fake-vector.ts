// Deterministic unit-ish 1024-dim vector from a seed. Used so repo NN tests
// store/query real vectors without invoking any embedding model. Distinct
// seeds give distinguishable directions; the same seed is reproducible.
export const DIM = 1024;

export function fakeVector(seed: number): number[] {
  let x = seed * 2654435761 + 1; // cheap LCG-ish, deterministic per seed
  // Array.from maps in index order, so the LCG advances deterministically.
  return Array.from({ length: DIM }, () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return (x / 0x7fffffff) * 2 - 1; // [-1, 1]
  });
}
