import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';

export interface ImageOptimizeOptions {
  quality: number;
  width: number | null;
  height: number | null;
}

export const DEFAULT_IMAGE_QUALITY = 85;
export const DEFAULT_MAX_WIDTH = 1920;

const OPTIMIZABLE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

export function shouldOptimizeImage(body?: Record<string, unknown>): boolean {
  if (!body?.['convert']) {
    return true;
  }

  return body['convert'].toString().toLowerCase() !== 'no';
}

export function parseOptimizeOptions(
  body?: Record<string, unknown>,
): ImageOptimizeOptions {
  return {
    quality: body?.['quality'] ? Number(body['quality']) : DEFAULT_IMAGE_QUALITY,
    width: body?.['width'] ? Number(body['width']) : DEFAULT_MAX_WIDTH,
    height: body?.['height'] ? Number(body['height']) : null,
  };
}

export function isOptimizableImage(filePath: string): boolean {
  return OPTIMIZABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function optimizeImageToWebp(
  sourcePath: string,
  options: ImageOptimizeOptions,
): Promise<{ outputPath: string; size: number; filename: string }> {
  const dir = path.dirname(sourcePath);
  const parsed = path.parse(sourcePath);
  const newFilename = `${parsed.name}.webp`;
  const outputPath = path.join(dir, newFilename);
  const samePath = path.resolve(sourcePath) === path.resolve(outputPath);

  const resizeOptions: sharp.ResizeOptions = {
    withoutEnlargement: true,
  };

  const pipeline = sharp(sourcePath).rotate();

  if (options.width || options.height) {
    pipeline.resize(options.width, options.height, resizeOptions);
  }

  const writeTarget = samePath
    ? path.join(dir, `${parsed.name}-opt-${Date.now()}.webp`)
    : outputPath;

  const result = await pipeline
    .webp({ effort: 4, quality: options.quality })
    .toFile(writeTarget);

  if (samePath) {
    fs.unlinkSync(sourcePath);
    fs.renameSync(writeTarget, outputPath);
  } else {
    fs.unlinkSync(sourcePath);
  }

  return {
    outputPath: outputPath.replace(/\\/g, '/'),
    size: result.size,
    filename: newFilename,
  };
}

export function parseResolutionParam(
  resolution?: string,
): { width: number; height: number } | null {
  if (!resolution || !/^\d+_\d+$/.test(resolution)) {
    return null;
  }

  const [width, height] = resolution.split('_').map(Number);
  if (!width || !height) {
    return null;
  }

  return { width, height };
}

export async function renderOptimizedImage(
  imagePath: string,
  resolution?: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const parsed = parseResolutionParam(resolution);
  if (!parsed || !isOptimizableImage(imagePath)) {
    return null;
  }

  const buffer = await sharp(imagePath)
    .rotate()
    .resize(parsed.width, parsed.height, {
      fit: 'cover',
      withoutEnlargement: true,
    })
    .webp({ effort: 4, quality: 82 })
    .toBuffer();

  return {
    buffer,
    contentType: 'image/webp',
  };
}
