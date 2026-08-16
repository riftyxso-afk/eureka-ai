/**
 * Pemetaan emoji → ikon lucide.
 *
 * Dipakai untuk menampilkan ikon sebagai pengganti emoji pada UI dan pada
 * data (ikon subjek, misi, onboarding, rekomendasi AI) — nilai data di
 * database TIDAK diubah, hanya dirender lewat pemetaan ini. Emoji yang
 * tidak dikenal memakai ikon cadangan (BookOpen).
 *
 * Kunci disimpan TANPA variation selector (U+FE0F); input dinormalisasi
 * dulu sebelum lookup.
 */
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Construction,
  CreditCard,
  Crown,
  Dna,
  Eye,
  FileText,
  Flame,
  FlaskConical,
  FolderOpen,
  Gem,
  Gift,
  GraduationCap,
  Hand,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Layers,
  Lightbulb,
  Medal,
  MessageSquare,
  Moon,
  Palette,
  PartyPopper,
  PenLine,
  Rocket,
  ScrollText,
  Search,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  TrendingUp,
  Trophy,
  User,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const EMOJI_ICON_MAP: Record<string, LucideIcon> = {
  // Subjek & materi
  "🧮": Calculator,
  "⚡": Zap,
  "🧪": FlaskConical,
  "🧬": Dna,
  "📊": BarChart3,
  "📜": ScrollText,
  "📖": BookOpen,
  "📚": BookOpen,
  "📝": FileText,
  "📋": ClipboardList,
  // Fitur & aksi
  "🧠": Brain,
  "🤯": Brain,
  "🎯": Target,
  "✍": PenLine,
  "🃏": Layers,
  "🗓": CalendarDays,
  "⏰": Clock,
  "🏆": Trophy,
  "🏅": Medal,
  "🔥": Flame,
  "⭐": Star,
  "🎁": Gift,
  "🎉": PartyPopper,
  "🎊": PartyPopper,
  "👑": Crown,
  "💎": Gem,
  "✨": Sparkles,
  "🚀": Rocket,
  "👋": Hand,
  "🤖": Bot,
  "🎓": GraduationCap,
  "🧑‍🎓": GraduationCap,
  "👤": User,
  "👁": Eye,
  "🚧": Construction,
  "💬": MessageSquare,
  "💡": Lightbulb,
  "💳": CreditCard,
  "🔍": Search,
  "🧐": Search,
  "🖼": ImageIcon,
  "🎨": Palette,
  "🏷": Tag,
  "🗂": FolderOpen,
  "♾": InfinityIcon,
  "🌙": Moon,
  "🌤": Sun,
  "☀": Sun,
  "🌅": Sun,
  "✅": CheckCircle2,
  "⚠": AlertTriangle,
  "🔧": Wrench,
  "📈": TrendingUp,
};

export const DEFAULT_ICON: LucideIcon = BookOpen;

/** Ubah emoji data → komponen ikon lucide (fallback: BookOpen). */
export function emojiToIcon(emoji?: string | null): LucideIcon {
  if (!emoji) return DEFAULT_ICON;
  const key = emoji.replace(/\uFE0F/g, "");
  return EMOJI_ICON_MAP[key] ?? DEFAULT_ICON;
}
