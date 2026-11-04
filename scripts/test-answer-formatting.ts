import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { causalChainSteps, remarkAnswerLineBreaks, remarkTextTimelines } from "../lib/assistant/answerFormatting";

const example = "kamu ada\n→\ncucu ada\n→\ncucu ke masa lalu\n→\nkamu hilang\n→\ncucu tidak ada\n→\nkamu tidak hilang\n→\n…";
assert.equal(causalChainSteps(example)?.length, 7);
assert.equal(causalChainSteps(example.replace(/\n/g, ""))?.length, 7);
assert.equal(causalChainSteps("$x → y → z$"), null);
assert.equal(causalChainSteps("Kalimat biasa tanpa panah"), null);
assert.equal(causalChainSteps("a → b"), null);
assert.equal(causalChainSteps("a → → c"), null);

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkAnswerLineBreaks);
const source = '| Bagian | Isi |\n| --- | --- |\n| Proses | 1. Input materi.<br>2. Eureka mengolah.<BR />3. Hasil di canvas. |\n\nTeks<br/>baris baru\n\n`<br>`\n\n```html\n<br>\n```\n\n<script>alert(1)</script>';
const tree = processor.runSync(processor.parse(source));
const json = JSON.stringify(tree);
assert.equal((json.match(/"type":"break"/g) ?? []).length, 3);
assert.ok(json.includes('"type":"inlineCode","value":"<br>"'));
assert.ok(json.includes('"type":"code"'));
assert.ok(json.includes('<script>alert(1)</script>'));

const timelineSource = String.raw`4. Garis Waktu Gabungan
$$\text{Dwapara Yuga (mitos)} \longrightarrow \text{Inti lisan } (\pm800\text{ SM}) \longrightarrow \text{PGW } (1200{-}800\text{ SM})$$ $$\longrightarrow \text{Bharata } (\pm400\text{ SM}) \longrightarrow \text{Mahabharata } (\pm400\text{ M}) \longrightarrow \text{Kali Yuga}$$`;
const timelineProcessor = unified().use(remarkParse).use(remarkMath).use(remarkTextTimelines);
type TestNode = { type: string; value?: string; children: TestNode[] };
const timeline = timelineProcessor.runSync(timelineProcessor.parse(timelineSource)) as TestNode;
assert.equal(timeline.children.length, 1);
assert.equal(timeline.children[0].type, "list");
const timelineText = JSON.stringify(timeline).match(/"value":"([^"]*Dwapara[^"]*)"/)?.[1] ?? "";
assert.equal(causalChainSteps(timelineText)?.length, 6);
assert.ok(timelineText.includes("Dwapara Yuga (mitos)"));
assert.ok(timelineText.includes("PGW (1200-800 SM)"));
assert.ok(timelineText.includes("Kali Yuga"));

const equation = timelineProcessor.runSync(timelineProcessor.parse(String.raw`$x \rightarrow y \rightarrow z$`)) as TestNode;
assert.equal(equation.children[0].children?.[0].type, "inlineMath");
console.log("PASS: 7-node arrow chains, conservative math/prose fallback, br/table breaks, code literals and inert HTML preservation");
