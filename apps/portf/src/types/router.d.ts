/**
 * TanStack Router `history.state` typing.
 *
 * Reading `useLocation({ select: (loc) => loc.state.initialPrompt })` would
 * otherwise return `unknown`; the augmentation gives it `string | undefined`
 * across the portf app.
 *
 * Any new route that stashes typed state on `history.state` extends this
 * interface - DO NOT cast at the call site.
 */
declare module "@tanstack/react-router" {
  interface HistoryState {
    initialPrompt?: string;
  }
}

export {};
