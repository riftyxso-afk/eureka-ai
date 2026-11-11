import Image from "next/image";
export function documentKind(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf") return "pdf";
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return "docx";
  if (["xls", "xlsx", "csv"].includes(extension)) return "xlsx";
  if (["ppt", "pptx"].includes(extension)) return "pptx";
  if (["mp3", "wav", "m4a", "ogg", "flac", "aac"].includes(extension)) return "audio";
  if (["mp4", "webm", "mov"].includes(extension)) return "video";
  return "txt";
}
export default function DocumentLogo({ name }: { name: string }) {
  return <Image src={`/brands/files/${documentKind(name)}.png`} alt="" aria-hidden="true" width={36} height={36} unoptimized style={{ flexShrink: 0, objectFit: "contain", background: "transparent" }} />;
}
