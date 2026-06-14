import type { ReactNode } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPresetDateFilter,
  ReportDateFilter,
  ReportDateMode,
  ReportPreset,
} from "@/lib/reporting";

interface DateFilterControlsProps {
  value: ReportDateFilter;
  onChange: (value: ReportDateFilter) => void;
}

const presets: { value: ReportPreset; label: string }[] = [
  { value: "today", label: "Aujourd'hui" },
  { value: "last7", label: "7 jours" },
  { value: "last30", label: "30 jours" },
  { value: "thisMonth", label: "Ce mois" },
];

export function DateFilterControls({ value, onChange }: DateFilterControlsProps) {
  const updateMode = (mode: ReportDateMode) => {
    if (mode === "single") {
      onChange({
        mode,
        startDate: value.startDate,
        endDate: value.startDate,
      });
      return;
    }

    onChange({
      mode,
      startDate: value.startDate,
      endDate: value.endDate,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <Select value={value.mode} onValueChange={(next) => updateMode(next as ReportDateMode)}>
          <SelectTrigger className="w-full lg:w-[180px]">
            <SelectValue placeholder="Mode de date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Jour unique</SelectItem>
            <SelectItem value="range">Periode</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-col sm:flex-row gap-3 min-w-0">
          <DateButton
            label={value.mode === "single" ? "Date" : "Date de debut"}
            text={format(dateOrFallback(value.startDate), "dd MMM yyyy", { locale: fr })}
          >
            <Calendar
              mode="single"
              selected={value.startDate}
              onSelect={(nextDate) => {
                if (!nextDate) return;
                onChange({
                  ...value,
                  startDate: nextDate,
                  endDate: value.mode === "single" ? nextDate : value.endDate,
                });
              }}
              initialFocus
            />
          </DateButton>

          {value.mode === "range" && (
            <DateButton
              label="Date de fin"
              text={format(dateOrFallback(value.endDate), "dd MMM yyyy", { locale: fr })}
            >
              <Calendar
                mode="single"
                selected={value.endDate}
                onSelect={(nextDate) => {
                  if (!nextDate) return;
                  onChange({
                    ...value,
                    endDate: nextDate,
                  });
                }}
                initialFocus
              />
            </DateButton>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange(getPresetDateFilter(preset.value))}
          >
            {preset.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface DateButtonProps {
  label: string;
  text: string;
  children: ReactNode;
}

function DateButton({ label, text, children }: DateButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full sm:w-[220px] justify-start font-normal overflow-hidden"
        >
          <CalendarIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">
            {label}: {text}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function dateOrFallback(date: Date | undefined) {
  return date ?? new Date();
}
