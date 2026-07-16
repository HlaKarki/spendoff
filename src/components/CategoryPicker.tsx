import type { Category } from "../lib/types";
import { cn } from "../lib/utils";
import { CategoryIcon } from "./icons";

interface CategoryPickerProps {
  categories?: readonly Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  className?: string;
  "aria-label"?: string;
}

const EMPTY_CATEGORIES: readonly Category[] = [];

/**
 * The one category-selection surface used across logging and editing flows.
 * Four columns give long labels room on phones; five keeps the picker compact
 * once a small-tablet viewport can comfortably fit them.
 */
export function CategoryPicker({
  categories = EMPTY_CATEGORIES,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "Choose a category",
}: CategoryPickerProps) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("grid grid-cols-4 gap-2 sm:grid-cols-5", className)}>
      {categories.map((category) => {
        const active = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-2.5 text-center transition",
              active
                ? "border-ink bg-ink text-paper"
                : "border-rule bg-paper text-muted hover:bg-paper-2 active:bg-paper-2",
            )}
          >
            <CategoryIcon name={category.icon} className="size-5 shrink-0" />
            <span className="min-w-0 text-[11px] font-semibold leading-tight break-words">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
