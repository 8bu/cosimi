import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeToggle } from "./ThemeToggle";
import { useTheme } from "@/store/theme";
import { applyTheme } from "@/lib/theme";

// The store's initial value is computed at module-init time. To get a
// predictable starting state per test, reset both the DOM attribute and
// the store via setTheme('light'). resetTheme() clears localStorage so
// the next module load (if it ever happens in a test) starts fresh too.
function resetTheme() {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  useTheme.setState({ theme: "light" });
  applyTheme("light");
  // applyTheme writes to localStorage; clear again so getStoredTheme()
  // returns null in tests that care.
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
}

describe("<ThemeToggle>", () => {
  beforeEach(() => resetTheme());
  afterEach(() => resetTheme());

  it("flips data-theme on the document element when clicked", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    // Initial render: light state, button advertises switching to dark.
    const btn = screen.getByRole("button", { name: /switch to dark theme/i });
    await user.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    // After click the label flips.
    expect(screen.getByRole("button", { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it("persists the choice to localStorage", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(localStorage.getItem("simlm.theme")).toBe("dark");
  });

  it("round-trips light → dark → light", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    await user.click(button);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await user.click(screen.getByRole("button"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
