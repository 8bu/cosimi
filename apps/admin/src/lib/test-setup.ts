// Adds @testing-library/jest-dom matchers (toBeInTheDocument,
// toHaveTextContent, etc.) to vitest's `expect`. Imported as a side-
// effect; the matchers register globally.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 3 does NOT auto-unmount @testing-library renders between tests
// (unlike jest-dom + react-testing-library's classic auto-wire). Without
// this, prior-test markup leaks into jsdom and the next test's
// getByRole / findByText finds two matches and bails. One unified
// afterEach in the shared setup is cheaper than per-file boilerplate.
afterEach(() => {
  cleanup();
});
