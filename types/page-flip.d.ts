declare module "page-flip" {
  export class PageFlip {
    constructor(element: HTMLElement, settings: {
      width: number; height: number; size?: "fixed" | "stretch";
      minWidth?: number; maxWidth?: number; minHeight?: number; maxHeight?: number;
      showCover?: boolean; drawShadow?: boolean; maxShadowOpacity?: number;
      flippingTime?: number; mobileScrollSupport?: boolean;
      disableFlipByClick?: boolean; useMouseEvents?: boolean;
    });
    loadFromHTML(elements: HTMLElement[]): void;
    on(event: "flip", callback: (event: { data: number }) => void): void;
    flip(page: number, corner?: "top" | "bottom"): void;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    destroy(): void;
  }
}
