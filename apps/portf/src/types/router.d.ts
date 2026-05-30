/**
 * TanStack Router `history.state` typing.
 *
 * Reading `useLocation({ select: (loc) => loc.state.initialPrompt })` would
 * otherwise return `unknown`; the augmentation gives it `string | undefined`
 * across the portf app.
 *
 * Any new route that stashes typed state on `history.state` extends this
 * interface - DO NOT cast at the call site.
 *
 * The side-effect import marks this file as a module (required for
 * `declare module` augmentation) without tripping unicorn's empty-export rule.
 */
import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface HistoryState {
    initialPrompt?: string;
  }
}
