/**
 * Essay artifact action slot. Operator does not support RSS, and essays
 * have no per-item CTA yet, so this returns null. The per-kind component
 * is kept (rather than removing the dispatch in `ArtifactPane.actionFor()`)
 * so future essay-level actions have a documented home.
 */
export function EssayAction() {
  return null;
}
