declare module 'pdfjs-dist/legacy/build/pdf.js' {
  export function getDocument(options: Record<string, unknown>): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{
        getViewport(options: { scale: number }): { width: number; height: number };
        render(options: {
          canvasContext: CanvasRenderingContext2D;
          viewport: { width: number; height: number };
        }): { promise: Promise<void> };
      }>;
    }>;
  };
}

declare module 'canvas' {
  export function createCanvas(width: number, height: number): {
    getContext(type: '2d'): CanvasRenderingContext2D;
    toBuffer(mimeType: 'image/png'): Buffer;
  };
}
