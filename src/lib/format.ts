/* ── Money ─────────────────────────────────────────────────────────────────
 * Amounts cross the wire as integer minor units. How many minor units make a major one is a
 * property of the currency and is NOT always 100 — ¥1000 is a thousand yen, not ten — so nothing
 * here divides by a hard-coded 100.
 *
 * Intl knows each currency's minor-unit count and its local symbol, which is why formatting goes
 * through it rather than a symbol lookup table: CA$ and $ both exist, and only Intl gets that right.
 * ────────────────────────────────────────────────────────────────────────── */

export const DEFAULT_CURRENCY = "USD";

/** Minor units per major unit, asked of Intl so it stays right for currencies we've never seen. */
export function minorUnits(currency: string): number {
  return currencyFormat(currency).resolvedOptions().maximumFractionDigits ?? 2;
}

/** Minor-unit integer → major-unit number. 4237 USD cents → 42.37; 4237 JPY → 4237. */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnits(currency);
}

/** Major-unit number → minor-unit integer. The inverse of `toMajor`, for parsing typed input. */
export function toMinor(major: number, currency: string): number {
  return Math.round(major * 10 ** minorUnits(currency));
}

// Intl.NumberFormat construction is not free and these are hit in list renders; one per currency.
const formatters = new Map<string, Intl.NumberFormat>();

/**
 * A currency formatter, or — for a code Intl doesn't know — a plain decimal one.
 *
 * The fallback deliberately does NOT reach for USD: rendering an unknown currency with a dollar
 * sign would state something false about the amount. A bare number the caller labels itself is the
 * safe failure.
 */
function currencyFormat(currency: string, fractionDigits?: number): Intl.NumberFormat {
  const key = `${currency}:${fractionDigits ?? "auto"}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    const digits =
      fractionDigits === undefined
        ? {}
        : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits };
    try {
      fmt = new Intl.NumberFormat("en-US", { style: "currency", currency, ...digits });
    } catch {
      fmt = new Intl.NumberFormat("en-US", digits);
    }
    formatters.set(key, fmt);
  }
  return fmt;
}

function isKnown(currency: string): boolean {
  return currencyFormat(currency).resolvedOptions().style === "currency";
}

/** "$42.37" / "CA$42.37" / "¥4,237" — an integer minor-unit amount, rendered in its currency. */
export function money(minor: number, currency = DEFAULT_CURRENCY): string {
  const text = currencyFormat(currency).format(toMajor(minor, currency));
  return isKnown(currency) ? text : `${currency} ${text}`;
}

/** As `money`, but without the fractional part — for axis labels and other tight spots. */
export function moneyShort(minor: number, currency = DEFAULT_CURRENCY): string {
  const text = currencyFormat(currency, 0).format(toMajor(minor, currency));
  return isKnown(currency) ? text : `${currency} ${text}`;
}

/**
 * The currency to render an amount in when none is attached to it.
 *
 * The account's base currency is the truth, but it arrives with `useMe`, so until that resolves USD
 * is the stated default rather than a guess that would flicker. Mirrors `resolveTimezone` — prefer
 * `useBaseCurrency()` in components, and pass a battle's own currency for anything battle-scoped.
 */
export function resolveCurrency(currency?: string): string {
  return currency || DEFAULT_CURRENCY;
}

// The currency each region actually spends. Only regions whose currency the backend can price are
// worth listing — a guess we can't fetch a rate for is worse than the default.
const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  GB: "GBP",
  AU: "AUD",
  NZ: "NZD",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  PL: "PLN",
  CZ: "CZK",
  SG: "SGD",
  HK: "HKD",
  IN: "INR",
  MX: "MXN",
  BR: "BRL",
  ZA: "ZAR",
  CN: "CNY",
  TH: "THB",
  MY: "MYR",
  PH: "PHP",
  ID: "IDR",
  TR: "TRY",
  IL: "ILS",
  JP: "JPY",
  KR: "KRW",
  IS: "ISK",
  // Eurozone
  AT: "EUR",
  BE: "EUR",
  CY: "EUR",
  DE: "EUR",
  EE: "EUR",
  ES: "EUR",
  FI: "EUR",
  FR: "EUR",
  GR: "EUR",
  HR: "EUR",
  IE: "EUR",
  IT: "EUR",
  LT: "EUR",
  LU: "EUR",
  LV: "EUR",
  MT: "EUR",
  NL: "EUR",
  PT: "EUR",
  SI: "EUR",
  SK: "EUR",
};

/**
 * The currency this device most likely spends in, from its locale's region ("en-CA" → CAD).
 *
 * A suggestion offered at signup, exactly as `browserTimezone()` is — a Canadian shouldn't have to
 * find Settings before a single number in the app is right. It is never applied to an existing
 * account: a returning user's stored choice is the truth, however they came by it. There is no
 * browser API for "my currency", so region is the closest honest proxy, and USD is the fallback
 * when the locale names no region we recognise.
 */
export function browserCurrency(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    return (region && REGION_CURRENCY[region]) || DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function formatMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function formatMonthShort(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The zone to render dates in. The account's zone is the truth, but it arrives with `useMe`, so
 * until that resolves the device's zone is the best guess available. Every date helper funnels
 * through here so that fallback is one deliberate decision rather than repeated by accident.
 * Prefer `useTimezone()` in components — it feeds this from the account.
 */
export function resolveTimezone(timezone?: string): string {
  return timezone || browserTimezone();
}

export function currentYearMonth(timezone?: string): string {
  const tz = resolveTimezone(timezone);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(
    new Date(),
  );
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

/** Today's day-of-month (1-31) in the given timezone — matches how the backend materializes recurring rules. */
export function currentDayOfMonth(timezone?: string): number {
  const tz = resolveTimezone(timezone);
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: tz, day: "2-digit" }).format(new Date()));
}

/** Today's calendar day ("YYYY-MM-DD") in the given timezone. */
export function todayInTz(timezone?: string): string {
  return dayInTz(new Date().toISOString(), timezone);
}

/** Shift a plain calendar day by whole days. Parsed as UTC, so a DST day is still one day long. */
export function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/**
 * The days an expense may be logged into: the current month in the account's zone, start to end.
 *
 * Earlier months are out because the backend locks a month once it rolls over — editing or deleting
 * a row there answers 409 `month_closed`, and a closed month's result is already settled. Logging
 * into one would plant a row the user can't take back, and could rewrite a decided winner.
 *
 * Later months are out because standings, budgets and the month close are all per-month: spend
 * booked into a month that hasn't started would sit invisible until it did. Within *this* month,
 * though, a future day is allowed — it counts toward the month you're already competing in.
 */
export function loggableDayRange(timezone?: string): { min: string; max: string } {
  const ym = currentYearMonth(timezone);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { min: `${ym}-01`, max: `${ym}-${String(last).padStart(2, "0")}` };
}

/**
 * The days of `yearMonth`, oldest→newest, for the day strip. The current month stops at today —
 * except where spend is already booked ahead (`daysWithSpend`), which the log screen allows within
 * the month: a day with no chip is a day whose entries can't be opened or edited.
 */
export function monthDays(yearMonth: string, timezone: string | undefined, daysWithSpend: Set<string>): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let cap = last;
  if (yearMonth === currentYearMonth(timezone)) {
    const logged = [...daysWithSpend].filter((d) => d.startsWith(`${yearMonth}-`)).map((d) => Number(d.slice(8, 10)));
    cap = Math.min(last, Math.max(currentDayOfMonth(timezone), ...logged));
  }
  return Array.from({ length: cap }, (_, i) => `${yearMonth}-${String(i + 1).padStart(2, "0")}`);
}

/**
 * The instant to stamp on an expense logged for `day`.
 *
 * Today keeps the real clock time. Any other day has no known time, so it lands at noon in the
 * account's zone — the same convention the backend's recurring materializer uses, and far enough
 * from either boundary that no DST shift can drag it onto a neighbouring day.
 */
export function spentAtForDay(day: string, timezone?: string): string {
  const now = new Date().toISOString();
  return day === dayInTz(now, timezone) ? now : datetimeLocalToUtc(`${day}T12:00`, timezone);
}

/** Calendar day ("YYYY-MM-DD") that an instant falls on in `timezone`. Mirrors the backend's dayInTz. */
export function dayInTz(iso: string, timezone?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** Clock time for an instant, in the account's zone rather than the device's. */
export function formatTime(iso: string, timezone?: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: resolveTimezone(timezone),
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * "Today" / "Yesterday" / weekday for a plain calendar day ("YYYY-MM-DD"), relative to today in
 * `timezone`. Takes a day rather than an instant because that's what the day-switcher deals in —
 * turning it back into an instant first is what forced the old `${day}T12:00:00` noon hack.
 */
export function relativeDayKey(day: string, timezone?: string): string {
  const today = dayInTz(new Date().toISOString(), timezone);
  // Both are plain dates: parse as UTC so the difference is a whole number of days no matter what
  // DST did in between.
  const diff = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";

  const d = new Date(`${day}T00:00:00Z`);
  if (diff > 0 && diff < 7) return d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long" });
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
}

export function relativeDay(iso: string, timezone?: string): string {
  return relativeDayKey(dayInTz(iso, timezone), timezone);
}

/** Milliseconds `timeZone` is ahead of UTC at `date`. Mirrors the backend's tzOffsetMs. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - date.getTime()
  );
}

/** An instant -> the "YYYY-MM-DDTHH:mm" an <input type="datetime-local"> wants, read in `timezone`. */
export function datetimeLocalInTz(iso: string, timezone?: string): string {
  const tz = resolveTimezone(timezone);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * The inverse: a wall-clock "YYYY-MM-DDTHH:mm" typed in `timezone` -> the UTC instant it names.
 * Resolved in two passes, since the offset at the naive instant isn't necessarily the offset at the
 * real one — they differ across a DST transition.
 */
export function datetimeLocalToUtc(local: string, timezone?: string): string {
  const tz = resolveTimezone(timezone);
  const [date, time] = local.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  const guess = naive - tzOffsetMs(new Date(naive), tz);
  return new Date(naive - tzOffsetMs(new Date(guess), tz)).toISOString();
}
