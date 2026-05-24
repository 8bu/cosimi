# @simlm/ui-tokens

Pure-CSS design tokens shared by `apps/web` and (later) `apps/admin`.

This package ships **one file**: `theme.css`. It contains a Tailwind v4
`@theme { ... }` block (CSS variables for colors, radii, typography) and a
small set of base resets. There is no JS, no TypeScript, no build step —
consumers `@import` the file from their own `globals.css`:

```css
@import "tailwindcss";
@import "@simlm/ui-tokens/theme.css";
```

## Why CSS-only?

Tailwind v4 reads design tokens from CSS via `@theme`, not from a JS preset.
A pure-CSS workspace package is the lightest way to share tokens between
two SPAs without forcing a JS toolchain on either of them.

## Why no shadcn primitives here?

shadcn's design philosophy is **you own the code**. Components live in
`apps/<name>/src/components/ui/*` and stay editable per-app. Sharing them
across a workspace would freeze per-app customization. **Tokens are shared;
components are not.**

## Editing tokens

Changing a CSS variable here propagates to every consuming app the next
time Vite reloads. Add new tokens to the `@theme` block; Tailwind v4
exposes them as utilities automatically (e.g. `--color-teach` →
`bg-teach`, `text-teach`).
