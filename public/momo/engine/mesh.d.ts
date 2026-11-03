export interface MomoRenderer {
  canvas: HTMLCanvasElement;
  gl?: WebGL2RenderingContext;
  preload(): unknown;
  isReady(outfit?: number): boolean;
  draw(target: HTMLCanvasElement | null, pixels: number, state: Record<string, unknown>): HTMLCanvasElement | null;
}
export function createRenderer(options?: { base?: string }): MomoRenderer;
export const OUTFITS: Record<string, number>;
export const FACE: Record<string, number>;
