import { afterEach, describe, expect, test, vi } from "vitest";
import {
  currentDayOfMonth,
  currentYearMonth,
  datetimeLocalInTz,
  datetimeLocalToUtc,
  dayInTz,
  formatTime,
  relativeDay,
  relativeDayKey,
} from "./format";

const TORONTO = "America/Toronto"; // UTC-5 / -4, DST
const TOKYO = "Asia/Tokyo"; // UTC+9, no DST

afterEach(() => {
  vi.useRealTimers();
});

/** Pin "now" so the today/yesterday helpers are testable. */
function at(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe("dayInTz — the same instant is a different day either side of UTC", () => {
  const instant = "2026-07-01T02:30:00.000Z";

  test("west of UTC it is still the previous day", () => {
    expect(dayInTz(instant, TORONTO)).toBe("2026-06-30");
  });

  test("east of UTC it is already the next", () => {
    expect(dayInTz(instant, TOKYO)).toBe("2026-07-01");
  });
});

describe("currentYearMonth / currentDayOfMonth follow the account zone, not the device", () => {
  // 02:30Z on Jul 1: still June 30th in Toronto, already July 1st in Tokyo. The month differs too,
  // which is what drives which month the app asks the server for.
  test("month boundary", () => {
    at("2026-07-01T02:30:00.000Z");
    expect(currentYearMonth(TORONTO)).toBe("2026-06");
    expect(currentYearMonth(TOKYO)).toBe("2026-07");
  });

  test("day of month", () => {
    at("2026-07-01T02:30:00.000Z");
    expect(currentDayOfMonth(TORONTO)).toBe(30);
    expect(currentDayOfMonth(TOKYO)).toBe(1);
  });
});

describe("formatTime renders in the account zone", () => {
  test("one instant, two zones", () => {
    const instant = "2026-07-01T02:30:00.000Z";
    expect(formatTime(instant, TORONTO)).toBe("10:30 PM");
    expect(formatTime(instant, TOKYO)).toBe("11:30 AM");
  });
});

describe("relativeDayKey", () => {
  test("today and yesterday are resolved in the given zone", () => {
    // 02:30Z Jul 1 = 22:30 Jun 30 in Toronto. So *there*, Jun 30 is today and Jun 29 is yesterday —
    // even though it is already Jul 1 in UTC.
    at("2026-07-01T02:30:00.000Z");
    expect(relativeDayKey("2026-06-30", TORONTO)).toBe("Today");
    expect(relativeDayKey("2026-06-29", TORONTO)).toBe("Yesterday");
    expect(relativeDayKey("2026-07-01", TOKYO)).toBe("Today");
  });

  test("within the last week it names the weekday", () => {
    at("2026-07-01T12:00:00.000Z");
    expect(relativeDayKey("2026-06-29", TORONTO)).toBe("Monday");
  });

  test("older than a week it gives a date", () => {
    at("2026-07-01T12:00:00.000Z");
    expect(relativeDayKey("2026-06-10", TORONTO)).toBe("Jun 10");
  });

  test("relativeDay agrees with relativeDayKey for the same instant", () => {
    at("2026-07-01T02:30:00.000Z");
    expect(relativeDay("2026-07-01T02:30:00.000Z", TORONTO)).toBe("Today");
  });
});

describe("datetime-local round-trip through the account zone", () => {
  test("an instant renders as the account's wall clock", () => {
    expect(datetimeLocalInTz("2026-07-01T02:30:00.000Z", TORONTO)).toBe("2026-06-30T22:30");
    expect(datetimeLocalInTz("2026-07-01T02:30:00.000Z", TOKYO)).toBe("2026-07-01T11:30");
  });

  test("and converts back to the same instant", () => {
    const instant = "2026-07-01T02:30:00.000Z";
    for (const tz of [TORONTO, TOKYO]) {
      expect(datetimeLocalToUtc(datetimeLocalInTz(instant, tz), tz)).toBe(instant);
    }
  });

  test("the same wall clock in two zones names two different instants", () => {
    expect(datetimeLocalToUtc("2026-07-01T09:00", TORONTO)).toBe("2026-07-01T13:00:00.000Z");
    expect(datetimeLocalToUtc("2026-07-01T09:00", TOKYO)).toBe("2026-07-01T00:00:00.000Z");
  });

  // Round-tripping across a DST boundary is where a single-offset conversion goes wrong: the offset
  // at the naive instant is not the offset at the real one.
  test("round-trips either side of spring forward", () => {
    for (const instant of ["2026-03-08T04:30:00.000Z", "2026-03-08T08:30:00.000Z"]) {
      expect(datetimeLocalToUtc(datetimeLocalInTz(instant, TORONTO), TORONTO)).toBe(instant);
    }
  });

  test("round-trips either side of fall back", () => {
    for (const instant of ["2026-11-01T03:30:00.000Z", "2026-11-01T09:30:00.000Z"]) {
      expect(datetimeLocalToUtc(datetimeLocalInTz(instant, TORONTO), TORONTO)).toBe(instant);
    }
  });
});
