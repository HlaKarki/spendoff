// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("renders minor units in the given currency", () => {
    render(<Money minor={4237} currency="USD" />);
    expect(screen.getByText("$42.37")).toBeDefined();
  });

  it("does not assume 100 minor units per major (JPY has none)", () => {
    render(<Money minor={1000} currency="JPY" />);
    expect(screen.getByText("¥1,000")).toBeDefined();
  });

  it("distinguishes same-symbol currencies via Intl", () => {
    render(<Money minor={123456} currency="CAD" />);
    expect(screen.getByText("CA$1,234.56")).toBeDefined();
  });

  it("falls back to USD when no currency is attached", () => {
    render(<Money minor={500} />);
    expect(screen.getByText("$5.00")).toBeDefined();
  });

  it("prints in register type: mono and tabular", () => {
    render(<Money minor={999} currency="USD" data-testid="m" />);
    const el = screen.getByText("$9.99");
    expect(el.className).toContain("font-mono");
    expect(el.className).toContain("tabular-nums");
  });
});
