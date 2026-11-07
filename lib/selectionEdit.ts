/** AI previews are plain text. JSON editor nodes keep generated HTML inert. */
export function plainSelectionText(text: string) {
  return text.replace(/&(?:#x20|#32|nbsp);/gi, " ").replace(/\\([*_.`#])/g, "$1")
    .replace(/\[([^\]\n]+)\]\(https?:\/\/[^\s)]+\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}[ \t]+/gm, "").replace(/^(\s*)[*+-][ \t]+/gm, "$1• ")
    .replace(/\*+|`+/g, "").replace(/(^|\W)_{1,3}([^_\n]+)_{1,3}(?=\W|$)/g, "$1$2");
}

export function selectionReplacement(text: string) {
  const inline = (line: string) => line.split("\n").flatMap((value, index) => [
    ...(index ? [{ type: "hardBreak" }] : []), ...(value ? [{ type: "text", text: value }] : []),
  ]);
  const paragraphs = text.trim().split(/\n\s*\n/);
  return paragraphs.length === 1 ? inline(paragraphs[0]) : paragraphs.map(value => ({ type: "paragraph", content: inline(value) }));
}
