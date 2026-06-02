import { FC, SVGProps, RefAttributes } from "react";

export interface LucideProps extends Partial<SVGProps<SVGSVGElement>> {
  size?: string | number;
  strokeWidth?: string | number;
  absoluteStrokeWidth?: boolean;
}

export type LucideIcon = FC<LucideProps & RefAttributes<SVGSVGElement>>;

declare module "lucide-react" {
  export type { LucideProps, LucideIcon };
  export const ArrowLeft: LucideIcon;
  export const BarChart3: LucideIcon;
  export const BedDouble: LucideIcon;
  export const Bell: LucideIcon;
  export const Boxes: LucideIcon;
  export const Building2: LucideIcon;
  export const CalendarClock: LucideIcon;
  export const Camera: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const ChevronLeft: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronUp: LucideIcon;
  export const Circle: LucideIcon;
  export const Clock3: LucideIcon;
  export const CreditCard: LucideIcon;
  export const Download: LucideIcon;
  export const Eye: LucideIcon;
  export const EyeOff: LucideIcon;
  export const Flame: LucideIcon;
  export const FolderTree: LucideIcon;
  export const ForkKnife: LucideIcon;
  export const Hotel: LucideIcon;
  export const ImageOff: LucideIcon;
  export const ImageUp: LucideIcon;
  export const Images: LucideIcon;
  export const Layers: LucideIcon;
  export const Package: LucideIcon;
  export const PenSquare: LucideIcon;
  export const PlusCircle: LucideIcon;
  export const QrCode: LucideIcon;
  export const Rocket: LucideIcon;
  export const ScanLine: LucideIcon;
  export const Search: LucideIcon;
  export const SearchX: LucideIcon;
  export const Settings2: LucideIcon;
  export const Share2: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const ShoppingCart: LucideIcon;
  export const SlidersHorizontal: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Star: LucideIcon;
  export const Store: LucideIcon;
  export const Trash2: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Truck: LucideIcon;
  export const User: LucideIcon;
  export const Users: LucideIcon;
  export const UtensilsCrossed: LucideIcon;
  export const X: LucideIcon;
  export const Zap: LucideIcon;
}
