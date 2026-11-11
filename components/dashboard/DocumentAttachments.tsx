"use client";

import { X } from "lucide-react";
import DocumentLogo from "@/components/ui/DocumentLogo";

function fileKind(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "pdf") return { logo: "pdf", label: "PDF" };
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return { logo: "docx", label: extension.toUpperCase() };
  if (["xls", "xlsx", "csv"].includes(extension)) return { logo: "xlsx", label: extension.toUpperCase() };
  if (["ppt", "pptx"].includes(extension)) return { logo: "pptx", label: extension.toUpperCase() };
  if (["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(extension)) return { logo: "audio", label: extension.toUpperCase() };
  if (["mp4", "webm", "mov"].includes(extension)) return { logo: "video", label: extension.toUpperCase() };
  return { logo: "txt", label: extension.toUpperCase() || "FILE" };
}

export default function DocumentAttachments({ files, onRemove }: { files: readonly File[]; onRemove: (index: number) => void }) {
  return <section className="dv2-attachments" aria-label="Lampiran materi">
    <ul>{files.map((file, index) => {
      const kind = fileKind(file.name);
      return <li key={`${file.name}-${index}`}>
        <span className="dv2-attachment-logo" aria-hidden="true"><DocumentLogo name={file.name} /></span>
        <span className="dv2-attachment-info"><strong title={file.name}>{file.name}</strong><small>{kind.label}<span aria-hidden="true"> · </span>{file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`}</small></span>
        <button type="button" onClick={() => onRemove(index)} aria-label={`Hapus lampiran ${file.name}`} title="Hapus lampiran"><X size={14} /></button>
      </li>;
    })}</ul>
    <p>{files.length}/5 file terlampir · maksimal 4 MB per file</p>
  </section>;
}
