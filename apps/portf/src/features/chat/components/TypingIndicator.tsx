/**
 * Three dots with staggered blink. Animation defined in
 * `apps/portf/src/styles/layout.css` (`.typing-indicator` + keyframes).
 * Rendered inside a bot bubble while text is still empty and status is
 * 'streaming'.
 */
export function TypingIndicator() {
  return (
    <span className="typing-indicator" aria-label="typing">
      <span />
      <span />
      <span />
    </span>
  );
}
