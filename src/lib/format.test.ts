import { afterEach, describe, expect, test, vi } from "vitest";
import {
  currentDayOfMonth,
  currentYearMonth,
  datetimeLocalInTz,
  datetimeLocalToUtc,
  dayInTz,
  formatTime,
  loggableDayRange,
  monthDays,
  relativeDay,
  relativeDayKey,
  shiftDay,
  spentAtForDay,
  todayInTz,
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

describe("shiftDay", () => {
  test("walks whole calendar days, across months and years", () => {
    expect(shiftDay("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-02-28", 1)).toBe("2026-03-01"); // 2026 is not a leap year
  });

  // A DST day is 23 or 25 hours long; stepping in local time would land back on the same date.
  test("a spring-forward day is still one day", () => {
    expect(shiftDay("2026-03-08", -1)).toBe("2026-03-07");
    expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09");
  });
});

describe("loggableDayRange — the current month, resolved in the account zone", () => {
  test("spans the whole month, so a day ahead is offerable and a closed month is not", () => {
    at("2026-07-12T12:00:00.000Z");
    expect(loggableDayRange(TORONTO)).toEqual({ min: "2026-07-01", max: "2026-07-31" });
  });

  test("month lengths come from the calendar, not a guess", () => {
    at("2026-02-10T12:00:00.000Z");
    expect(loggableDayRange(TORONTO).max).toBe("2026-02-28");
    at("2026-06-10T12:00:00.000Z");
    expect(loggableDayRange(TORONTO).max).toBe("2026-06-30");
  });

  // 02:30Z Jul 1 is still June in Toronto but already July in Tokyo — the two accounts are allowed
  // to log into different months at the very same instant.
  test("the zone decides which month is open", () => {
    at("2026-07-01T02:30:00.000Z");
    expect(loggableDayRange(TORONTO)).toEqual({ min: "2026-06-01", max: "2026-06-30" });
    expect(loggableDayRange(TOKYO)).toEqual({ min: "2026-07-01", max: "2026-07-31" });
  });

  test("on the 1st, yesterday falls outside the range — it belongs to a locked month", () => {
    at("2026-07-01T12:00:00.000Z");
    const today = todayInTz(TORONTO);
    expect(shiftDay(today, -1) >= loggableDayRange(TORONTO).min).toBe(false);
  });
});

describe("monthDays — the day strip", () => {
  const none = new Set<string>();

  test("the current month stops at today", () => {
    at("2026-07-12T12:00:00.000Z");
    const days = monthDays("2026-07", TORONTO, none);
    expect(days.at(0)).toBe("2026-07-01");
    expect(days.at(-1)).toBe("2026-07-12");
  });

  test("a past month runs to its end", () => {
    at("2026-07-12T12:00:00.000Z");
    expect(monthDays("2026-06", TORONTO, none).at(-1)).toBe("2026-06-30");
  });

  // Without this, a spend logged for a day ahead has no chip — invisible, and impossible to edit.
  test("but it stretches to reach spend booked ahead", () => {
    at("2026-07-12T12:00:00.000Z");
    const days = monthDays("2026-07", TORONTO, new Set(["2026-07-11", "2026-07-20"]));
    expect(days.at(-1)).toBe("2026-07-20");
  });

  test("never past the end of the month", () => {
    at("2026-07-12T12:00:00.000Z");
    expect(monthDays("2026-07", TORONTO, new Set(["2026-07-31"])).at(-1)).toBe("2026-07-31");
  });

  test("spend in other months doesn't stretch it", () => {
    at("2026-07-12T12:00:00.000Z");
    expect(monthDays("2026-07", TORONTO, new Set(["2026-08-20", "2026-06-30"])).at(-1)).toBe("2026-07-12");
  });
});

describe("spentAtForDay", () => {
  test("today keeps the real clock time", () => {
    at("2026-07-12T15:04:05.000Z");
    expect(spentAtForDay("2026-07-12", TORONTO)).toBe("2026-07-12T15:04:05.000Z");
  });

  test("a past day lands at noon in the account's zone, not the device's", () => {
    at("2026-07-12T15:04:05.000Z");
    // Noon in Toronto (UTC-4 in July) is 16:00Z; noon in Tokyo (UTC+9) is 03:00Z.
    expect(spentAtForDay("2026-07-03", TORONTO)).toBe("2026-07-03T16:00:00.000Z");
    expect(spentAtForDay("2026-07-03", TOKYO)).toBe("2026-07-03T03:00:00.000Z");
  });

  test("a future day within the month is stamped the same way", () => {
    at("2026-07-12T15:04:05.000Z");
    expect(spentAtForDay("2026-07-20", TORONTO)).toBe("2026-07-20T16:00:00.000Z");
  });

  // The point of noon: whatever the zone or the DST shift, the instant reads back as the day picked.
  test("every day of a month round-trips to the day the user picked", () => {
    at("2026-03-15T12:00:00.000Z");
    for (const tz of [TORONTO, TOKYO, "Pacific/Kiritimati", "Pacific/Midway"]) {
      for (let d = 1; d <= 31; d++) {
        const day = `2026-03-${String(d).padStart(2, "0")}`;
        expect(dayInTz(spentAtForDay(day, tz), tz)).toBe(day);
      }
    }
  });

  test("including the day the clocks change", () => {
    at("2026-03-15T12:00:00.000Z");
    // Spring forward (Mar 8) and fall back (Nov 1) in Toronto.
    expect(dayInTz(spentAtForDay("2026-03-08", TORONTO), TORONTO)).toBe("2026-03-08");
    expect(spentAtForDay("2026-03-08", TORONTO)).toBe("2026-03-08T16:00:00.000Z"); // EDT, UTC-4
    expect(spentAtForDay("2026-03-07", TORONTO)).toBe("2026-03-07T17:00:00.000Z"); // EST, UTC-5
    expect(dayInTz(spentAtForDay("2026-11-01", TORONTO), TORONTO)).toBe("2026-11-01");
  });

  test("a backdated entry buckets into the month it was spent, whatever month it is logged in", () => {
    at("2026-07-01T12:00:00.000Z");
    // Same guard the backend applies (year_month = the month of spent_at, in the user's zone).
    expect(dayInTz(spentAtForDay("2026-07-01", TORONTO), TORONTO).slice(0, 7)).toBe("2026-07");
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
