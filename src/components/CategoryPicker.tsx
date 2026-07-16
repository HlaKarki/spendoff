import type { Category } from "../lib/types";
import { cn } from "../lib/utils";
import { CategoryIcon } from "./icons";

interface CategoryPickerProps {
  categories?: readonly Category[];
  value: string | null;
  onChange: (categoryId: string) => void;
  className?: string;
  compact?: boolean;
  "aria-label"?: string;
}

const EMPTY_CATEGORIES: readonly Category[] = [];

/** The original five-column category control, shared across logging and editing flows. */
export function CategoryPicker({
  categories = EMPTY_CATEGORIES,
  value,
  onChange,
  className,
  compact = false,
  "aria-label": ariaLabel = "Choose a category",
}: CategoryPickerProps) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("grid grid-cols-5 gap-2", className)}>
      {categories.map((category) => {
        const active = value === category.id;
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border transition",
              compact ? "py-2" : "py-2.5",
              active
                ? "border-ink bg-ink text-paper"
                : "border-rule bg-paper text-muted hover:bg-paper-2 active:bg-paper-2",
            )}
          >
            <CategoryIcon name={category.icon} className={compact ? "size-4" : "size-5"} />
            <span className="text-[9px] font-semibold leading-none">{category.label}</span>
          </button>
        );
      })}
    </div>
  );
}
