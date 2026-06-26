import {
  Car,
  Clapperboard,
  CircleDollarSign,
  Ellipsis,
  HeartPulse,
  Home,
  Plane,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Swords,
  Utensils,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  car: Car,
  "shopping-bag": ShoppingBag,
  receipt: Receipt,
  clapperboard: Clapperboard,
  "heart-pulse": HeartPulse,
  plane: Plane,
  ellipsis: Ellipsis,
};

export function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon = CATEGORY_ICONS[name] ?? CircleDollarSign;
  return <Icon className={className} />;
}

export { Home, Plus, Settings, Swords, CircleDollarSign };
