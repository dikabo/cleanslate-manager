import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  endOfDay,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";

export type ReportDateMode = "single" | "range";
export type ChartGranularity = "hour" | "day" | "month";
export type ReportPreset = "today" | "last7" | "last30" | "thisMonth";

export interface ReportDateFilter {
  mode: ReportDateMode;
  startDate: Date;
  endDate: Date;
}

export function getPresetDateFilter(preset: ReportPreset): ReportDateFilter {
  const now = new Date();

  switch (preset) {
    case "today":
      return {
        mode: "single",
        startDate: now,
        endDate: now,
      };
    case "last7":
      return {
        mode: "range",
        startDate: subDays(now, 6),
        endDate: now,
      };
    case "last30":
      return {
        mode: "range",
        startDate: subDays(now, 29),
        endDate: now,
      };
    case "thisMonth":
    default:
      return {
        mode: "range",
        startDate: startOfMonth(now),
        endDate: now,
      };
  }
}

export function normalizeReportDateFilter(filter: ReportDateFilter) {
  const start = startOfDay(filter.startDate);
  const end = endOfDay(filter.endDate);

  if (start.getTime() <= end.getTime()) {
    return {
      startDate: start,
      endDate: end,
    };
  }

  return {
    startDate: startOfDay(filter.endDate),
    endDate: endOfDay(filter.startDate),
  };
}

export function getReportGranularity(filter: ReportDateFilter): ChartGranularity {
  const { startDate, endDate } = normalizeReportDateFilter(filter);
  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (isSameDay(startDate, endDate)) {
    return "hour";
  }

  if (diffDays <= 62) {
    return "day";
  }

  return "month";
}

export function getChartBuckets(filter: ReportDateFilter, granularity: ChartGranularity) {
  const { startDate, endDate } = normalizeReportDateFilter(filter);

  if (granularity === "hour") {
    return eachHourOfInterval({ start: startDate, end: endDate }).map((date) => ({
      key: format(date, "yyyy-MM-dd HH"),
      label: format(date, "HH'h'", { locale: fr }),
      date,
    }));
  }

  if (granularity === "day") {
    return eachDayOfInterval({ start: startDate, end: endDate }).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "dd MMM", { locale: fr }),
      date,
    }));
  }

  return eachMonthOfInterval({ start: startDate, end: endDate }).map((date) => ({
    key: format(date, "yyyy-MM"),
    label: format(date, "MMM yy", { locale: fr }),
    date,
  }));
}

export function formatBucketKey(value: string, granularity: ChartGranularity) {
  if (granularity === "hour") {
    return format(new Date(value), "yyyy-MM-dd HH");
  }

  if (granularity === "day") {
    return format(new Date(value), "yyyy-MM-dd");
  }

  return format(new Date(value), "yyyy-MM");
}

export function formatReportDateLabel(filter: ReportDateFilter) {
  const { startDate, endDate } = normalizeReportDateFilter(filter);

  if (isSameDay(startDate, endDate)) {
    return format(startDate, "dd MMMM yyyy", { locale: fr });
  }

  return `${format(startDate, "dd MMM yyyy", { locale: fr })} - ${format(endDate, "dd MMM yyyy", {
    locale: fr,
  })}`;
}

export function getRangeForQuery(filter: ReportDateFilter) {
  const { startDate, endDate } = normalizeReportDateFilter(filter);

  return {
    startDate,
    endDate,
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}

export function getPeriodComparisonLabel(filter: ReportDateFilter) {
  const granularity = getReportGranularity(filter);

  if (granularity === "hour") return "par heure";
  if (granularity === "day") return "par jour";
  return "par mois";
}

export function getDefaultExportFilename(prefix: string) {
  return `${prefix}_${format(new Date(), "yyyyMMdd")}.csv`;
}

export function getSignedPaymentAmount(payment: { amount?: number | null; payment_type?: string | null }) {
  const amount = payment.amount || 0;
  return payment.payment_type === "refund" ? -amount : amount;
}
