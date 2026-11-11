export interface StoryScene { title: string; text: string; imagePrompt: string; image?: string }
export interface Storybook { id: string; title: string; scenes: StoryScene[] }

export function parseStorybook(raw: string): { title: string; scenes: StoryScene[] } {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const data = JSON.parse(clean);
  if (typeof data.title !== "string" || !data.title.trim() || !Array.isArray(data.scenes) || data.scenes.length !== 3) throw new Error("Invalid story structure");
  return {
    title: data.title.trim().slice(0, 150),
    scenes: data.scenes.map((scene: { title?: unknown; text?: unknown; imagePrompt?: unknown }) => {
      if (typeof scene.title !== "string" || typeof scene.text !== "string" || typeof scene.imagePrompt !== "string" || scene.text.trim().length < 30 || scene.text.length > 1400) throw new Error("Invalid story scene");
      return { title: scene.title.slice(0, 100), text: scene.text.trim(), imagePrompt: scene.imagePrompt.slice(0, 450) };
    }),
  };
}
