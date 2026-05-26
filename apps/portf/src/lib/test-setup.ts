import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest 3 doesn't auto-unmount renders between tests (same trap apps/web
// and apps/admin document). cleanup() in afterEach is mandatory.
afterEach(() => {
  cleanup();
});
