import { describe, expect, it } from "vitest";
import { splitSentences, htmlToText } from "./text";

describe("splitSentences", () => {
  it("splits on . ! ? keeping no empties", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
  });

  it("splits Vietnamese sentences", () => {
    expect(splitSentences("Tôi khỏe. Bạn thì sao?")).toEqual(["Tôi khỏe.", "Bạn thì sao?"]);
  });

  it("treats a blank line as a hard boundary", () => {
    expect(splitSentences("Line one\n\nLine two")).toEqual(["Line one", "Line two"]);
  });

  it("returns a single element when there is no terminator", () => {
    expect(splitSentences("no end here")).toEqual(["no end here"]);
  });

  it("returns [] for empty/whitespace input", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("htmlToText", () => {
  it("strips tags and decodes basic entities", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
  });

  it("drops script/style bodies", () => {
    expect(htmlToText("a<script>var x=1;</script>b<style>.c{}</style>d")).toBe("abd");
  });

  it("collapses whitespace", () => {
    expect(htmlToText("<div>a\n   b\t c</div>")).toBe("a b c");
  });
});
