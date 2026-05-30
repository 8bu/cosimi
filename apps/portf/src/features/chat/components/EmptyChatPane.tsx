/**
 * Placeholder rendered inside ChatPane when `byThread[threadId]` is empty
 * (e.g., fresh `+ new chat` click, bare /chat deep link). Hardcoded
 * English; Phase H replaces with i18n.
 */
export function EmptyChatPane() {
  return (
    <div className="empty-chat">
      <p>Ask me anything about my work, stack, or career.</p>
    </div>
  );
}
