import { describe, expect, test } from "vitest";
import { minorUnits, money, moneyShort, resolveCurrency, toMajor, toMinor } from "./format";

describe("minorUnits", () => {
  test("is read per currency, not assumed to be 2", () => {
    expect(minorUnits("USD")).toBe(2);
    expect(minorUnits("CAD")).toBe(2);
    expect(minorUnits("JPY")).toBe(0); // ¥1000 is a thousand yen, not ten
    expect(minorUnits("KRW")).toBe(0);
  });
});

describe("toMajor / toMinor", () => {
  test("scale by the currency's own minor units", () => {
    expect(toMajor(4237, "USD")).toBe(42.37);
    expect(toMajor(4237, "JPY")).toBe(4237); // no fractional yen to divide out

    expect(toMinor(42.37, "USD")).toBe(4237);
    expect(toMinor(4237, "JPY")).toBe(4237);
  });

  test("round-trip a typed amount without drifting", () => {
    // The edit fields seed from toMajor and save through toMinor; a cent lost in that loop would be
    // a cent silently rewritten every time someone opened an expense and saved it unchanged.
    for (const cents of [1, 99, 100, 4237, 999_999]) {
      expect(toMinor(toMajor(cents, "USD"), "USD")).toBe(cents);
    }
  });

  test("toMinor returns whole minor units even for a fractional input", () => {
    expect(toMinor(10.005, "USD")).toBe(1001);
    expect(toMinor(10.004, "USD")).toBe(1000);
    expect(Number.isInteger(toMinor(1234.567, "JPY"))).toBe(true);
  });
});

describe("money", () => {
  test("renders an integer minor-unit amount in its currency", () => {
    expect(money(4237, "USD")).toBe("$42.37");
    expect(money(0, "USD")).toBe("$0.00");
  });

  test("distinguishes currencies that share a symbol", () => {
    // The whole point of going through Intl: $ and CA$ are not the same claim about an amount.
    expect(money(4237, "CAD")).not.toBe(money(4237, "USD"));
    expect(money(4237, "CAD")).toContain("42.37");
  });

  test("does not divide a zero-decimal currency by 100", () => {
    // The old formatter rendered this as "¥42.37" — off by two orders of magnitude.
    expect(money(4237, "JPY")).toBe("¥4,237");
  });

  test("groups thousands", () => {
    expect(money(123_456_789, "USD")).toBe("$1,234,567.89");
  });

  test("renders negatives (a member over budget)", () => {
    expect(money(-4237, "USD")).toBe("-$42.37");
  });

  test("defaults to USD when no currency is given", () => {
    expect(money(4237)).toBe("$42.37");
  });

  test("an unknown currency is labelled with its code, never with a dollar sign", () => {
    // Falling back to USD here would state something false about the amount.
    const out = money(4237, "ZZZ");
    expect(out).toContain("ZZZ");
    expect(out).not.toContain("$");
  });
});

describe("moneyShort", () => {
  test("drops the fractional part", () => {
    expect(moneyShort(123_456, "USD")).toBe("$1,235");
    expect(moneyShort(4237, "JPY")).toBe("¥4,237");
  });
});

describe("resolveCurrency", () => {
  test("falls back to USD only while the account's own is still loading", () => {
    expect(resolveCurrency("CAD")).toBe("CAD");
    expect(resolveCurrency(undefined)).toBe("USD");
    expect(resolveCurrency("")).toBe("USD");
  });
});
