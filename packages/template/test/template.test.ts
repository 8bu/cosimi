import { describe, expect, it } from "vitest";
import { renderTemplate } from "@cosimi/template";

describe("renderTemplate", () => {
  it("replaces a single placeholder", () => {
    expect(renderTemplate("mình tên {{ name }}", { name: "Bé Sim" })).toBe("mình tên Bé Sim");
  });

  it("is whitespace tolerant", () => {
    expect(renderTemplate("{{name}} / {{  name  }}", { name: "x" })).toBe("x / x");
  });

  it("is case-insensitive on keys (vars table is lowercase canonical)", () => {
    expect(renderTemplate("{{ NAME }} {{ Name }}", { name: "x" })).toBe("x x");
  });

  it("replaces multiple placeholders in a single pass", () => {
    expect(renderTemplate("{{ a }} and {{ b }}", { a: "1", b: "2" })).toBe("1 and 2");
  });

  it("leaves unknown placeholders literal so corpus typos surface", () => {
    expect(renderTemplate("hi {{ nme }}", { name: "Bé Sim" })).toBe("hi {{ nme }}");
  });

  it("returns the input unchanged when no placeholders match", () => {
    expect(renderTemplate("plain text, no placeholders", { name: "x" })).toBe(
      "plain text, no placeholders",
    );
  });

  it("does not chew on expression-like content (only identifier-shaped keys)", () => {
    // Spaces inside the braces are tolerated; punctuation/operators are not
    // identifier characters so the regex doesn't match.
    expect(renderTemplate("{{ a+b }} {{ 1 }} {{ name }}", { name: "ok" })).toBe(
      "{{ a+b }} {{ 1 }} ok",
    );
  });

  it("does not recursively expand a replacement that itself looks like a placeholder", () => {
    // Single .replace pass, not iterative — the replacement string is taken
    // verbatim and the regex doesn't re-scan it. Important so a malicious
    // config value can't infinitely loop or self-substitute.
    expect(renderTemplate("hi {{ name }}", { name: "{{ name }}" })).toBe("hi {{ name }}");
  });
});
