export function money(cents: number, currency = "USD"): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const value = (abs / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${sign}${symbol}${value}`;
}

export function moneyShort(cents: number, currency = "USD"): string {
  const symbol = currency === "USD" ? "$" : `${currency} `;
  const whole = Math.round(cents / 100);
  return `${symbol}${whole.toLocaleString("en-US")}`;
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

export function currentYearMonth(timezone?: string): string {
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).formatToParts(
    new Date(),
  );
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  return `${y}-${m}`;
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
