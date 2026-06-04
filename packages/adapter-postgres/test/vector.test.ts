import { expect, it } from "vitest";
import { fromVector, toVector } from "../src/vector";

it("toVector serializes to pgvector literal form", () => {
  expect(toVector([0.1, 0.2, -0.3])).toBe("[0.1,0.2,-0.3]");
});

it("fromVector parses a pgvector literal", () => {
  expect(fromVector("[0.1,0.2,-0.3]")).toEqual([0.1, 0.2, -0.3]);
});

it("fromVector returns null for null", () => {
  expect(fromVector(null)).toBeNull();
});

it("round-trips", () => {
  const v = [1, 2, 3, 4.5];
  expect(fromVector(toVector(v))).toEqual(v);
});
