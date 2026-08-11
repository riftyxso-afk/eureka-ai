import Link from "next/link";
import { FileText } from "lucide-react";

interface NoteItemProps {
  id: string;
  title: string;
  subject: string;
  updatedAt: string;
}

export const NoteItem = ({ id, title, subject, updatedAt }: NoteItemProps) => {
  return (
    <Link href={`/dashboard/note/${id}`} className="block h-full">
      <div className="card-clay flex aspect-square flex-col justify-between !p-4 transition-all duration-75 hover:-translate-y-0.5 hover:shadow-[0_10px_0_#C1B4A4] active:translate-y-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-clay-md bg-clay-beige shadow-clay-inset">
            <FileText size={18} className="text-clay-primary" />
          </div>
          <span className="shrink-0 text-xs font-bold text-clay-muted">
            {updatedAt}
          </span>
        </div>
        <div>
          <p className="line-clamp-3 text-sm font-extrabold leading-snug text-clay-dark">
            {title}
          </p>
          <p className="mt-1.5 text-xs font-bold text-clay-muted">{subject}</p>
        </div>
      </div>
    </Link>
  );
};
