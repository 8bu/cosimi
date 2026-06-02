// Phase 15: web tests now mix DOM (ThemeToggle render) with pure-JS
// (sse-parser, store reducer). The DOM-touching tests need jsdom +
// @testing-library/jest-dom matchers; the others don't care which
// environment is active. One shared setup keeps the matcher
// registration out of per-file boilerplate.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 3 doesn't auto-unmount renders between tests — without this
// the prior test's markup leaks into jsdom and the next test's
// getByRole / findByText finds two matches (same trap apps/admin's
// test-setup.ts documents).
afterEach(() => {
  cleanup();
});
