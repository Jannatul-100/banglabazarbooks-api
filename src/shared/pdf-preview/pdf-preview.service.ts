import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sharp from 'sharp';
import { promisify } from 'util';
import { firstValueFrom } from 'rxjs';

const execFileAsync = promisify(execFile);

export interface PdfPreviewResult {
  images: string[];
  pageLimit: number;
  fileSize: number;
}

@Injectable()
export class PdfPreviewService {
  private readonly logger = new Logger(PdfPreviewService.name);
  private readonly previewScale = 1.4;
  private readonly webpQuality = 82;
  private readonly renderWidth = 1400;
  private popplerAvailable: boolean | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async generatePreviewImages(
    productId: string,
    pdfUrl: string,
    pageLimit = 0,
  ): Promise<PdfPreviewResult> {
    this.prepareCanvasEnvironment();

    const pdfBuffer = await this.resolvePdfBuffer(pdfUrl);
    const fileSize = pdfBuffer.length;
    const { pdfPath, isTempPdf } = await this.ensurePdfOnDisk(pdfUrl, pdfBuffer);
    const previewDir = this.getPreviewImagesDir();
    const publicBaseUrl = this.getPublicBaseUrl(pdfUrl);
    const fileServerUrl = this.getFileServerUrl();
    const useRemoteFileServer = !!fileServerUrl;

    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    this.cleanupOldPreviewImages(productId, previewDir);

    try {
      if (await this.isPopplerAvailable()) {
        return await this.generateWithPoppler(
          productId,
          pdfPath,
          pageLimit,
          fileSize,
          previewDir,
          publicBaseUrl,
          useRemoteFileServer,
          fileServerUrl,
        );
      }

      this.logger.warn(
        'Poppler not found. Install: sudo apt-get install -y poppler-utils. Falling back to pdfjs.',
      );
      return await this.generateWithPdfJs(
        productId,
        pdfBuffer,
        pageLimit,
        fileSize,
        previewDir,
        publicBaseUrl,
        useRemoteFileServer,
        fileServerUrl,
      );
    } finally {
      if (isTempPdf && fs.existsSync(pdfPath)) {
        try {
          fs.unlinkSync(pdfPath);
        } catch (error) {
          this.logger.warn(`Failed to delete temp PDF ${pdfPath}`);
        }
      }
    }
  }

  private async generateWithPoppler(
    productId: string,
    pdfPath: string,
    pageLimit: number,
    fileSize: number,
    previewDir: string,
    publicBaseUrl: string,
    useRemoteFileServer: boolean,
    fileServerUrl: string,
  ): Promise<PdfPreviewResult> {
    const totalPagesInPdf = await this.getPdfPageCount(pdfPath);
    const totalPages =
      pageLimit > 0
        ? Math.min(totalPagesInPdf, pageLimit)
        : totalPagesInPdf;
    const images: string[] = [];
    const popplerEnv = this.buildPopplerEnvironment();

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const tempPrefix = path.join(
        os.tmpdir(),
        `book-preview-${productId}-${pageNumber}-${Date.now()}`,
      );
      const pngPath = `${tempPrefix}.png`;

      await execFileAsync(
        'pdftocairo',
        [
          '-png',
          '-singlefile',
          '-f',
          String(pageNumber),
          '-l',
          String(pageNumber),
          '-scale-to-x',
          String(this.renderWidth),
          pdfPath,
          tempPrefix,
        ],
        {
          env: popplerEnv,
          timeout: 180000,
          maxBuffer: 20 * 1024 * 1024,
        },
      );

      if (!fs.existsSync(pngPath)) {
        throw new Error(`Poppler did not create preview PNG for page ${pageNumber}`);
      }

      const filename = `book-preview-${productId}-${pageNumber}.webp`;
      const outputPath = path.join(previewDir, filename);
      const webpBuffer = await sharp(pngPath)
        .webp({ quality: this.webpQuality, effort: 4 })
        .toBuffer();

      if (useRemoteFileServer && fileServerUrl) {
        await this.uploadPreviewToFileServer(
          fileServerUrl,
          filename,
          webpBuffer,
        );
      } else {
        await sharp(webpBuffer).toFile(outputPath);
      }

      try {
        fs.unlinkSync(pngPath);
      } catch (error) {
        this.logger.warn(`Failed to delete temp PNG ${pngPath}`);
      }

      if (pageNumber === 1) {
        this.logger.log(
          `Poppler saved preview page 1 for ${productId}: ${outputPath}`,
        );
      }

      images.push(`${publicBaseUrl}/upload/images/${filename}`);
    }

    return {
      images,
      pageLimit: totalPages,
      fileSize,
    };
  }

  private async generateWithPdfJs(
    productId: string,
    pdfBuffer: Buffer,
    pageLimit: number,
    fileSize: number,
    previewDir: string,
    publicBaseUrl: string,
    useRemoteFileServer: boolean,
    fileServerUrl: string,
  ): Promise<PdfPreviewResult> {
    const { pdfjsLib, pdfjsRoot } = await this.loadPdfJsLib();
    const { createCanvas } = this.loadCanvasLib();
    this.configurePdfJs(pdfjsLib, pdfjsRoot);

    const loadingTask = pdfjsLib.getDocument(
      this.buildDocumentOptions(pdfjsRoot, pdfBuffer),
    );
    const pdfDocument = await loadingTask.promise;
    const totalPages =
      pageLimit > 0
        ? Math.min(pdfDocument.numPages, pageLimit)
        : pdfDocument.numPages;

    const images: string[] = [];

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const viewport = page.getViewport({ scale: this.previewScale });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;

      const pngBuffer = canvas.toBuffer('image/png');
      const filename = `book-preview-${productId}-${pageNumber}.webp`;
      const outputPath = path.join(previewDir, filename);
      const webpBuffer = await sharp(pngBuffer)
        .webp({ quality: this.webpQuality, effort: 4 })
        .toBuffer();

      if (useRemoteFileServer && fileServerUrl) {
        await this.uploadPreviewToFileServer(
          fileServerUrl,
          filename,
          webpBuffer,
        );
      } else {
        await sharp(webpBuffer).toFile(outputPath);
      }

      if (pageNumber === 1) {
        this.logger.log(
          `Saved preview page 1 for ${productId}: ${outputPath}`,
        );
      }

      images.push(`${publicBaseUrl}/upload/images/${filename}`);
    }

    return {
      images,
      pageLimit: totalPages,
      fileSize,
    };
  }

  private async isPopplerAvailable(): Promise<boolean> {
    if (this.popplerAvailable !== null) {
      return this.popplerAvailable;
    }

    try {
      await execFileAsync('pdftocairo', ['-v']);
      this.popplerAvailable = true;
    } catch (error) {
      this.popplerAvailable = false;
    }

    return this.popplerAvailable;
  }

  private async getPdfPageCount(pdfPath: string): Promise<number> {
    const { stdout } = await execFileAsync('pdfinfo', [pdfPath], {
      timeout: 60000,
      maxBuffer: 1024 * 1024,
    });
    const match = stdout.match(/Pages:\s+(\d+)/i);
    if (!match?.[1]) {
      throw new Error(`Could not read page count from PDF: ${pdfPath}`);
    }

    return parseInt(match[1], 10);
  }

  private buildPopplerEnvironment(): NodeJS.ProcessEnv {
    const bundledFontsDir = path.join(process.cwd(), 'assets', 'fonts');
    const env = { ...process.env };

    if (fs.existsSync(path.join(bundledFontsDir, 'fonts.conf'))) {
      env.FONTCONFIG_PATH = bundledFontsDir;
    }

    return env;
  }

  private async ensurePdfOnDisk(
    pdfUrl: string,
    pdfBuffer: Buffer,
  ): Promise<{ pdfPath: string; isTempPdf: boolean }> {
    const localPath = this.resolveLocalPdfPath(pdfUrl);
    if (localPath && fs.existsSync(localPath)) {
      return { pdfPath: localPath, isTempPdf: false };
    }

    const tempDir = path.join(os.tmpdir(), 'guardian-pdf-preview');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `preview-${Date.now()}.pdf`);
    fs.writeFileSync(tempPath, new Uint8Array(pdfBuffer));
    return { pdfPath: tempPath, isTempPdf: true };
  }

  private getPdfFilesDirs(): string[] {
    const dirs = new Set<string>([path.join(process.cwd(), 'upload', 'files')]);
    const configured = this.configService.get<string>('pdfFilesDir');

    if (configured) {
      dirs.add(configured.replace(/\/$/, ''));
    }

    if (this.configService.get<boolean>('productionBuild')) {
      dirs.add('/home/ubuntu/WEB_APP/banglabazarbooks.com/FTP/upload/files');
    }

    return [...dirs];
  }

  private async loadPdfJsLib(): Promise<{ pdfjsLib: any; pdfjsRoot: string }> {
    let pdfjsRoot: string;

    try {
      pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
    } catch (error) {
      throw new Error(
        'pdfjs-dist is not installed on the API server. Run: npm install pdfjs-dist@3.11.174 canvas@^3.2.3',
      );
    }

    const candidates = [
      path.join(pdfjsRoot, 'legacy/build/pdf.js'),
      path.join(pdfjsRoot, 'legacy/build/pdf.mjs'),
      path.join(pdfjsRoot, 'build/pdf.js'),
      path.join(pdfjsRoot, 'build/pdf.mjs'),
    ];

    for (const candidate of candidates) {
      if (!fs.existsSync(candidate)) {
        continue;
      }

      if (candidate.endsWith('.mjs')) {
        const moduleRef = await import(candidate);
        return {
          pdfjsLib: moduleRef.default ?? moduleRef,
          pdfjsRoot,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return {
        pdfjsLib: require(candidate),
        pdfjsRoot,
      };
    }

    throw new Error(
      `Could not find pdfjs-dist build file under ${pdfjsRoot}. Reinstall with: npm install pdfjs-dist@3.11.174`,
    );
  }

  private configurePdfJs(pdfjsLib: any, pdfjsRoot: string) {
    const workerCandidates = [
      path.join(pdfjsRoot, 'legacy/build/pdf.worker.js'),
      path.join(pdfjsRoot, 'legacy/build/pdf.worker.mjs'),
      path.join(pdfjsRoot, 'build/pdf.worker.js'),
    ];

    for (const workerPath of workerCandidates) {
      if (fs.existsSync(workerPath)) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
        break;
      }
    }

    if (
      typeof pdfjsLib.setVerbosityLevel === 'function' &&
      pdfjsLib.VerbosityLevel
    ) {
      pdfjsLib.setVerbosityLevel(pdfjsLib.VerbosityLevel.ERRORS);
    }
  }

  private buildDocumentOptions(pdfjsRoot: string, pdfBuffer: Buffer) {
    const standardFontsDir = path.join(pdfjsRoot, 'standard_fonts');
    const cmapsDir = path.join(pdfjsRoot, 'cmaps');
    const options: Record<string, unknown> = {
      data: new Uint8Array(pdfBuffer),
      isEvalSupported: false,
      // Use fonts embedded in the publisher PDF (SolaimanLipi etc.).
      // useSystemFonts causes Times_path_* warnings and missing glyphs on Node.
      disableFontFace: false,
      useSystemFonts: false,
    };

    if (fs.existsSync(standardFontsDir)) {
      options.standardFontDataUrl = `${standardFontsDir}${path.sep}`;
    }

    if (fs.existsSync(cmapsDir)) {
      options.cMapUrl = `${cmapsDir}${path.sep}`;
      options.cMapPacked = true;
    }

    return options;
  }

  private prepareCanvasEnvironment() {
    const bundledFontsDir = path.join(process.cwd(), 'assets', 'fonts');
    const bundledFontConfig = path.join(bundledFontsDir, 'fonts.conf');

    if (fs.existsSync(bundledFontConfig)) {
      process.env.FONTCONFIG_PATH = bundledFontsDir;
    } else if (!process.env.FONTCONFIG_FILE && !process.env.FONTCONFIG_PATH) {
      const fontConfigFile = '/etc/fonts/fonts.conf';
      if (fs.existsSync(fontConfigFile)) {
        process.env.FONTCONFIG_FILE = fontConfigFile;
      }
    }

    this.registerPreviewFonts(bundledFontsDir);
  }

  private registerPreviewFonts(bundledFontsDir: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { registerFont } = require('canvas');
      const registered = new Set<string>();

      const registerFile = (filePath: string, families: string[]) => {
        if (!filePath || !fs.existsSync(filePath)) {
          return;
        }

        for (const family of families) {
          const key = `${filePath}:${family}`;
          if (registered.has(key)) {
            continue;
          }

          registerFont(filePath, { family });
          registered.add(key);
        }
      };

      const aliasMap: Record<string, string[]> = {
        solaiman: ['SolaimanLipi', 'Solaiman Lipi', 'SolaimanLipi-Bold'],
        sutonny: ['SutonnyMJ', 'SutonnyMJ-Bold', 'SutonnyMJ-Regular'],
        nikosh: ['Nikosh', 'NikoshBAN', 'NikoshBAN-Regular'],
        kalpurush: ['Kalpurush', 'Kalpurush ANSI'],
        notosansbengali: ['Noto Sans Bengali', 'NotoSansBengali'],
        notoserifbengali: ['Noto Serif Bengali', 'NotoSerifBengali'],
      };

      if (fs.existsSync(bundledFontsDir)) {
        for (const file of fs.readdirSync(bundledFontsDir)) {
          if (!/\.(ttf|otf)$/i.test(file)) {
            continue;
          }

          const fullPath = path.join(bundledFontsDir, file);
          const baseName = path.parse(file).name;
          const families = new Set<string>([baseName]);
          const lower = file.toLowerCase();

          for (const [needle, aliases] of Object.entries(aliasMap)) {
            if (lower.includes(needle)) {
              aliases.forEach((alias) => families.add(alias));
            }
          }

          registerFile(fullPath, [...families]);
        }
      }

      const systemFontCandidates: Array<[string, string[]]> = [
        [
          '/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf',
          ['Noto Sans Bengali', 'NotoSansBengali', 'SolaimanLipi', 'Nikosh'],
        ],
        [
          '/usr/share/fonts/truetype/noto/NotoSerifBengali-Regular.ttf',
          ['Noto Serif Bengali', 'NotoSerifBengali'],
        ],
        [
          '/usr/share/fonts/opentype/noto/NotoSansBengali-Regular.ttf',
          ['Noto Sans Bengali', 'NotoSansBengali', 'SolaimanLipi', 'Nikosh'],
        ],
        [
          '/usr/share/fonts/truetype/freefont/FreeSerif.ttf',
          ['FreeSerif', 'Times New Roman', 'Times-Roman', 'Times', 'TimesNewRomanPSMT'],
        ],
        [
          '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
          ['Liberation Serif', 'Times New Roman', 'Times-Roman', 'Times'],
        ],
        [
          '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
          ['DejaVu Serif', 'Times New Roman', 'Times-Roman', 'Times'],
        ],
      ];

      for (const [filePath, families] of systemFontCandidates) {
        registerFile(filePath, families);
      }
    } catch (error) {
      this.logger.warn(
        `Preview font registration skipped: ${error?.message || error}`,
      );
    }
  }

  private loadCanvasLib(): { createCanvas: typeof import('canvas').createCanvas } {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('canvas');
    } catch (error) {
      throw new Error(
        'canvas is not installed on the API server. Run: npm install canvas@^3.2.3',
      );
    }
  }

  private getPreviewImagesDir(): string {
    const configured = this.configService.get<string>('previewImagesDir');
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return path.join(process.cwd(), 'upload', 'images');
  }

  private cleanupOldPreviewImages(productId: string, previewDir: string) {
    if (!fs.existsSync(previewDir)) {
      return;
    }

    const prefix = `book-preview-${productId}-`;
    fs.readdirSync(previewDir)
      .filter((file) => file.startsWith(prefix))
      .forEach((file) => {
        try {
          fs.unlinkSync(path.join(previewDir, file));
        } catch (error) {
          this.logger.warn(`Failed to delete old preview image ${file}`);
        }
      });
  }

  private async cleanupOldPreviewImagesRemote(
    productId: string,
    fileServerUrl: string,
  ) {
    const prefix = `book-preview-${productId}-`;
    const previewDir = this.getPreviewImagesDir();

    if (fs.existsSync(previewDir)) {
      this.cleanupOldPreviewImages(productId, previewDir);
    }

    this.logger.log(
      `Remote preview cleanup for ${productId} on ${fileServerUrl} (old pages will be overwritten)`,
    );
  }

  private async uploadPreviewToFileServer(
    fileServerUrl: string,
    filename: string,
    webpBuffer: Buffer,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FormData = require('form-data');
    const form = new FormData();
    form.append(
      'secret',
      this.configService.get<string>('previewUploadSecret'),
    );
    form.append('filename', filename);
    form.append('image', webpBuffer, {
      filename,
      contentType: 'image/webp',
    });

    await firstValueFrom(
      this.httpService.post(
        `${fileServerUrl.replace(/\/$/, '')}/upload/save-book-preview`,
        form,
        {
          headers: form.getHeaders(),
          timeout: 120000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        },
      ),
    );
  }

  private getFileServerUrl(): string {
    const configured = this.configService.get<string>('fileServerUrl');
    return configured ? configured.replace(/\/$/, '') : '';
  }

  private async resolvePdfBuffer(pdfUrl: string): Promise<Buffer> {
    const localPath = this.resolveLocalPdfPath(pdfUrl);
    if (localPath && fs.existsSync(localPath)) {
      return fs.readFileSync(localPath);
    }

    const requestUrl = this.encodePdfUrl(pdfUrl);

    const response = await firstValueFrom(
      this.httpService.get(requestUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
      }),
    );

    return Buffer.from(response.data);
  }

  private encodePdfUrl(pdfUrl: string): string {
    const trimmed = pdfUrl?.trim();
    if (!trimmed) {
      throw new Error('PDF URL is empty');
    }

    try {
      const parsed = new URL(trimmed);
      parsed.pathname = parsed.pathname
        .split('/')
        .map((segment) => {
          if (!segment) {
            return segment;
          }

          try {
            return encodeURIComponent(decodeURIComponent(segment));
          } catch (error) {
            return encodeURIComponent(segment);
          }
        })
        .join('/');

      return parsed.toString();
    } catch (error) {
      throw new Error(`Invalid PDF URL: ${trimmed}`);
    }
  }

  private resolveLocalPdfPath(pdfUrl: string): string | null {
    const match = pdfUrl.match(/\/upload\/files\/([^/?#]+)/i);
    if (!match?.[1]) {
      return null;
    }

    const rawSegment = match[1];
    const fileNames = new Set<string>([
      decodeURIComponent(rawSegment),
      rawSegment,
    ]);

    for (const dir of this.getPdfFilesDirs()) {
      for (const fileName of fileNames) {
        const candidate = path.join(dir, fileName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  private getPublicBaseUrl(pdfUrl?: string): string {
    const derivedFromPdf = this.deriveApiBaseFromUrl(pdfUrl);
    if (derivedFromPdf) {
      return derivedFromPdf;
    }

    const configured = this.configService.get<string>('publicBaseUrl');
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    if (this.configService.get<boolean>('productionBuild')) {
      return 'https://ftp.banglabazarbooks.com/api';
    }

    const port = this.configService.get<number>('port') || 3000;
    return `http://localhost:${port}/api`;
  }

  private deriveApiBaseFromUrl(sourceUrl?: string): string | null {
    if (!sourceUrl) {
      return null;
    }

    try {
      const parsed = new URL(sourceUrl.trim());
      const apiIndex = parsed.pathname.indexOf('/api');
      if (apiIndex >= 0) {
        return `${parsed.origin}${parsed.pathname.substring(0, apiIndex + 4)}`;
      }

      return `${parsed.origin}/api`;
    } catch (error) {
      return null;
    }
  }
}
