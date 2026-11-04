/** Recognize explicit, short arrow chains, not prose or mathematical implications. */
export function causalChainSteps(text: string): string[] | null {
  if (!text.includes("→") && !text.includes("->")) return null;
  const steps = text.trim().split(/\s*(?:→|->)\s*/).map((step) => step.trim());
  if (steps.length < 3 || steps.length > 12) return null;
  if (steps.some((step) => !step || step.length > 100 || /[\n|=$<>]/.test(step))) return null;
  return steps;
}

/** Decode only text-labelled LaTeX chains; mathematical expressions stay with KaTeX. */
export function latexTimelineText(value: string): string | null {
  if (!/\\(?:longrightarrow|rightarrow|to)\b/.test(value) || !/\\text\{/.test(value)) return null;
  const decoded = value
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:longrightarrow|rightarrow|to)\b/g, "→")
    .replace(/\\pm(?=\s*\d)/g, "±")
    .replace(/\{([-–])\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (/[\\{}^_=<>$]/.test(decoded)) return null;
  return decoded;
}

/** Join explicitly continued math blocks before turning text-only chains into prose nodes. */
export function remarkTextTimelines() {
  return (tree: MarkdownNode) => {
    function visit(parent: MarkdownNode) {
      if (!parent.children) return;
      const output: MarkdownNode[] = [];
      for (let index = 0; index < parent.children.length; index++) {
        const child = parent.children[index];
        if (child.type === "math" || child.type === "inlineMath") {
          let text = latexTimelineText(child.value ?? "");
          if (text) {
            let end = index;
            while (end + 1 < parent.children.length) {
              let nextIndex = index + 1;
              const separator = parent.children[nextIndex];
              if (separator.type === "text" && !separator.value?.trim()) nextIndex++;
              const next = parent.children[nextIndex];
              const continuation = next && next.type === child.type ? latexTimelineText(next.value ?? "") : null;
              if (!continuation?.startsWith("→")) break;
              text += " " + continuation;
              end = nextIndex;
            }
            const steps = causalChainSteps(text.replace(/^\s*→\s*/, ""));
            if (steps) {
              const plain: MarkdownNode = { type: "text", value: steps.join(" → ") };
              output.push(child.type === "math" ? { type: "paragraph", children: [plain] } : plain);
              index = end;
              continue;
            }
          }
        }
        visit(child);
        output.push(child);
      }
      parent.children = output;
    }
    visit(tree);
  };
}

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

/** Allow only explicit line-break tags. Other HTML remains inert markdown data. */
export function remarkAnswerLineBreaks() {
  return (tree: MarkdownNode) => {
    function visit(node: MarkdownNode) {
      if (!node.children) return;
      node.children = node.children.map((child) => {
        if (child.type === "html" && /^<br\s*\/?\s*>$/i.test(child.value?.trim() ?? "")) {
          return { type: "break" };
        }
        visit(child);
        return child;
      });
    }
    visit(tree);
  };
}
