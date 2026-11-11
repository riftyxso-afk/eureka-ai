import { strToU8, zipSync } from "fflate";
import type { StudySource } from "@/lib/study-sources-types";

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const packageRel = "http://schemas.openxmlformats.org/package/2006/relationships";

function escapeXml(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] || character);
}

function runs(value: string) {
  const text = value.replace(/\[([^\]]+)\]\((?:https?:\/\/)[^\s)]+\)/g, "$1");
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).filter(Boolean).map(part => {
    const bold = part.startsWith("**") && part.endsWith("**");
    const inlineCode = part.startsWith("`") && part.endsWith("`");
    const label = bold ? part.slice(2, -2) : inlineCode ? part.slice(1, -1) : part;
    return `<w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(label)}</w:t></w:r>`;
  }).join("");
}

function paragraph(text: string, style = "Normal") {
  return `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${runs(text)}</w:p>`;
}

function documentBody(markdown: string) {
  const lines = markdown.trim().split(/\r?\n/);
  const output: string[] = [];
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").slice(0, 8);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^(?:-{3,}|\*{3,})$/.test(line)) continue;
    if (line.includes("|") && /^\s*\|?\s*:?-{2,}:?\s*\|/.test(lines[i + 1] || "")) {
      const header = cells(line);
      const rows = [header];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
      i--;
      output.push(`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:color="D5CDE2"/><w:left w:val="single" w:color="D5CDE2"/><w:bottom w:val="single" w:color="D5CDE2"/><w:right w:val="single" w:color="D5CDE2"/><w:insideH w:val="single" w:color="D5CDE2"/><w:insideV w:val="single" w:color="D5CDE2"/></w:tblBorders></w:tblPr><w:tblGrid>${header.map(() => `<w:gridCol w:w="${Math.floor(9400 / header.length)}"/>`).join("")}</w:tblGrid>${rows.map((row, index) => `<w:tr>${header.map((_, col) => `<w:tc><w:tcPr>${index === 0 ? '<w:shd w:fill="EEE8F7"/>' : ""}</w:tcPr>${paragraph((row[col] || "").trim())}</w:tc>`).join("")}</w:tr>`).join("")}</w:tbl>`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) output.push(paragraph(heading[2], heading[1].length <= 2 ? "Heading1" : "Heading2"));
    else if (!line.startsWith("```")) output.push(paragraph(line.replace(/^[-*+]\s+/, "• ").replace(/^>\s?/, "")));
  }
  return output.join("");
}

export function createStudyDocx(title: string, markdown: string, sources: StudySource[]) {
  const references = sources.flatMap(source => {
    try {
      const url = new URL(source.url);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? [{ ...source, url: url.href }] : [];
    } catch { return []; }
  });
  const body = paragraph(title, "Title") + documentBody(markdown.replace(/^\s*#\s+[^\r\n]+[\r\n]+/, ""))
    + (references.length ? paragraph("Sumber", "Heading1") + references.map((source, index) =>
      `<w:p><w:hyperlink r:id="source${index + 1}"><w:r><w:rPr><w:color w:val="6542B2"/><w:u w:val="single"/></w:rPr><w:t>${escapeXml(`${index + 1}. ${source.title}`)}</w:t></w:r></w:hyperlink></w:p>`).join("") : "");
  const files: Record<string, string> = {
    "[Content_Types].xml": `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    "_rels/.rels": `<Relationships xmlns="${packageRel}"><Relationship Id="doc" Type="${rel}/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<Relationships xmlns="${packageRel}"><Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/>${references.map((source, i) => `<Relationship Id="source${i + 1}" Type="${rel}/hyperlink" Target="${escapeXml(source.url)}" TargetMode="External"/>`).join("")}</Relationships>`,
    "word/document.xml": `<w:document xmlns:w="${word}" xmlns:r="${rel}"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1240" w:right="1240" w:bottom="1240" w:left="1240" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    "word/styles.xml": `<w:styles xmlns:w="${word}">
      <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="135" w:line="292" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="23"/><w:color w:val="262031"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:after="325"/></w:pPr><w:rPr><w:b/><w:color w:val="46317C"/><w:sz w:val="48"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="250" w:after="100"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="46317C"/><w:sz w:val="32"/></w:rPr></w:style>
      <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="175" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="27"/></w:rPr></w:style>
    </w:styles>`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, xml]) => [name, strToU8(xmlHeader + xml)])));
}

export function downloadStudyDocx(title: string, markdown: string, sources: StudySource[]) {
  const data = createStudyDocx(title, markdown, sources);
  const bytes = new Uint8Array(data);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = (title.replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 75) || "Dokumen Eureka") + ".docx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
