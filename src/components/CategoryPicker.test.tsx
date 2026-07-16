// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Category } from "../lib/types";
import { CategoryPicker } from "./CategoryPicker";

const categories: Category[] = [
  { id: "food", label: "Food", icon: "utensils", sort_order: 1 },
  { id: "entertainment", label: "Entertainment", icon: "clapperboard", sort_order: 6 },
  { id: "drinks", label: "Drinks", icon: "cup-soda", sort_order: 9 },
];

afterEach(cleanup);

describe("CategoryPicker", () => {
  it("renders every server-provided category with a readable accessible name", () => {
    render(<CategoryPicker categories={categories} value={null} onChange={() => undefined} />);

    expect(screen.getByRole("group", { name: "Choose a category" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Entertainment" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Drinks" })).toBeDefined();
  });

  it("exposes selection and reports the stable category id", () => {
    const onChange = vi.fn();
    render(<CategoryPicker categories={categories} value="food" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Food" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Drinks" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Drinks" }));
    expect(onChange).toHaveBeenCalledWith("drinks");
  });

  it("uses the narrow-phone four-column layout before expanding to five", () => {
    render(<CategoryPicker categories={categories} value={null} onChange={() => undefined} />);
    const group = screen.getByRole("group", { name: "Choose a category" });

    expect(group.className).toContain("grid-cols-4");
    expect(group.className).toContain("sm:grid-cols-5");
    expect(screen.getByText("Entertainment").className).toContain("text-[11px]");
    expect(screen.getByText("Entertainment").className).toContain("break-words");
  });
});
