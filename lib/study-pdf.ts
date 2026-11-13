import PDFDocument from "pdfkit";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { StudySource } from "./study-sources-types";

type Block = { type: string; value?: string; depth?: number; ordered?: boolean; children?: Block[] };
const plain = (node: Block): string => node.value ?? node.children?.map(plain).join("") ?? "";

/** Render a real, selectable-text PDF locally; never execute model-generated HTML. */
export async function createStudyPdf(title: string, markdown: string, sources: StudySource[]): Promise<Buffer> {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown.slice(0, 60000));
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: title, Author: "Eureka" } });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width - 96;
  const room = (height: number) => { if (doc.y + height > doc.page.height - 64) doc.addPage(); };
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#7047bd").text("EUREKA / BELAJAR");
  doc.moveDown().fontSize(23).fillColor("#25232b").text(title, { width });
  doc.moveDown(.7);
  function render(node: Block) {
    if (node.type === "heading") {
      room(70);
      doc.moveDown(.5).font("Helvetica-Bold").fontSize(node.depth === 1 ? 19 : node.depth === 2 ? 15 : 12).fillColor("#383044").text(plain(node), 48, doc.y, { width });
      doc.moveDown(.4);
    } else if (node.type === "table") {
      const rows = node.children?.map(row => row.children?.map(plain) ?? []) ?? [];
      if (!rows.length) return;
      room(70);
      doc.font("Helvetica").fontSize(9).fillColor("#25232b");
      doc.table({ position: { x: 48 }, maxWidth: width, columnStyles: Array(rows[0].length).fill(width / rows[0].length), defaultStyle: { padding: 7, border: .5, borderColor: "#ddd8e6" }, rowStyles: i => i === 0 ? { backgroundColor: "#f0ebf7" } : {}, data: rows });
      doc.x = 48;
      doc.moveDown(.7);
    } else if (node.type === "list") {
      node.children?.forEach((item, index) => {
        room(35);
        doc.font("Helvetica").fontSize(11).fillColor("#25232b").text(`${node.ordered ? `${index + 1}.` : "•"} ${plain(item)}`, 56, doc.y, { width: width - 8, lineGap: 4, paragraphGap: 7 });
      });
      doc.x = 48;
    } else if (node.type === "paragraph" || node.type === "code") {
      room(30);
      doc.font(node.type === "code" ? "Courier" : "Helvetica").fontSize(node.type === "code" ? 9 : 11).fillColor("#25232b").text(plain(node), 48, doc.y, { width, lineGap: 4, paragraphGap: 9 });
    } else node.children?.forEach(render);
  }
  try {
    const blocks = tree.children as Block[];
    blocks.forEach((block, index) => { if (!(index === 0 && block.type === "heading" && plain(block) === title)) render(block); });
    const references = sources.filter(source => /^https?:\/\//i.test(source.url)).slice(0, 12);
    if (references.length) {
      render({ type: "heading", depth: 2, value: "Sumber" });
      references.forEach((source, index) => render({ type: "paragraph", value: `${index + 1}. ${source.title}\n${source.url}` }));
    }
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#777777").text(`Eureka · ${i + 1} / ${range.count}`, 48, doc.page.height - 36, { lineBreak: false });
    }
    doc.end();
  } catch (error) { doc.destroy(error instanceof Error ? error : new Error("PDF gagal dibuat")); }
  return complete;
}
