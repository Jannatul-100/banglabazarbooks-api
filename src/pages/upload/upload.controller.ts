import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import {
  allFileFilter,
  editFileName,
  getUploadFilePath,
  getUploadPath,
  imageFileFilter,
} from './file-upload.utils';
import {
  isOptimizableImage,
  optimizeImageToWebp,
  parseOptimizeOptions,
  renderOptimizedImage,
  shouldOptimizeImage,
} from './image-optimize.utils';
import { UploadService } from './upload.service';
import {
  FileUploadResponse,
  ImageUploadResponse,
  ResponsePayload,
} from '../../interfaces/core/response-payload.interface';
import * as path from 'path';
import * as fs from 'fs';

@Controller('upload')
export class UploadController {
  private logger = new Logger(UploadController.name);

  constructor(
    private configService: ConfigService,
    private uploadService: UploadService,
  ) {}

  private getBaseUrl(req: any): string {
    const isProduction = this.configService.get<boolean>('productionBuild');
    return (
      req.protocol + `${isProduction ? 's' : ''}://` + req.get('host') + '/api'
    );
  }

  private async processUploadedImage(
    file: Express.Multer.File,
    body: Record<string, unknown> | undefined,
    baseurl: string,
  ): Promise<{ originalname: string; filename: string; url: string; size?: number }> {
    if (
      shouldOptimizeImage(body) &&
      isOptimizableImage(file.path)
    ) {
      const options = parseOptimizeOptions(body);
      const optimized = await optimizeImageToWebp(file.path, options);
      const relativePath = optimized.outputPath.replace(/^\.\//, '');

      return {
        originalname: file.originalname,
        filename: optimized.filename,
        url: `${baseurl}/${relativePath}`,
        size: optimized.size,
      };
    }

    return {
      originalname: file.originalname,
      filename: file.filename,
      url: `${baseurl}/${file.path}`,
      size: file.size,
    };
  }

  /**
   * SINGLE IMAGE
   * SINGLE IMAGE WITH WEBP CONTROL
   * MULTIPLE IMAGE
   * GET IMAGE
   * DELETE SINGLE IMAGE
   * DELETE MULTIPLE IMAGE
   */
  @Post('single-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: getUploadPath,
        filename: editFileName,
      }),
      limits: {
        fileSize: 10 * 1000 * 1000,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadSingleImage(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Body() body,
  ) {
    const baseurl = this.getBaseUrl(req);
    return this.processUploadedImage(file, body, baseurl);
  }

  @Version('2')
  @Post('single-image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: getUploadPath,
        filename: editFileName,
      }),
      limits: {
        fileSize: 10 * 1000 * 1000,
      },
      fileFilter: imageFileFilter,
    }),
  )
  async uploadSingleImageV2(
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
    @Body() body,
  ) {
    const baseurl = this.getBaseUrl(req);
    return this.processUploadedImage(file, body, baseurl);
  }

  @Post('multiple-image')
  @UseInterceptors(
    FilesInterceptor('imageMulti', 50, {
      storage: diskStorage({
        destination: getUploadPath,
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async uploadMultipleImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
    @Body() body,
  ): Promise<ImageUploadResponse[]> {
    const baseurl = this.getBaseUrl(req);
    const response: ImageUploadResponse[] = [];

    for (const file of files) {
      const processed = await this.processUploadedImage(file, body, baseurl);
      response.push({
        size: this.uploadService.bytesToKb(processed.size ?? file.size),
        name: path.parse(processed.filename).name,
        url: processed.url,
      } as ImageUploadResponse);
    }

    return response;
  }

  @Version('2')
  @Post('multiple-image')
  @UseInterceptors(
    FilesInterceptor('imageMulti', 50, {
      storage: diskStorage({
        destination: getUploadPath,
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  async uploadMultipleImagesV2(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
    @Body() body,
  ): Promise<ImageUploadResponse[]> {
    return this.uploadMultipleImages(files, req, body);
  }

  @Post('save-book-preview')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async saveBookPreview(
    @UploadedFile() file: Express.Multer.File,
    @Body('secret') secret: string,
    @Body('filename') filename: string,
    @Req() req,
  ) {
    const expectedSecret = this.configService.get<string>('previewUploadSecret');
    if (!secret || secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid preview upload secret');
    }

    const safeName = path.basename(filename || '');
    if (!/^book-preview-[a-f0-9]+-\d+\.webp$/i.test(safeName)) {
      throw new BadRequestException('Invalid preview filename');
    }

    const previewDir = path.join(process.cwd(), 'upload', 'images');
    if (!fs.existsSync(previewDir)) {
      fs.mkdirSync(previewDir, { recursive: true });
    }

    fs.writeFileSync(path.join(previewDir, safeName), file.buffer);

    const baseurl = this.getBaseUrl(req);

    return {
      success: true,
      filename: safeName,
      url: `${baseurl}/upload/images/${safeName}`,
    };
  }

  @Get('images/:imageName')
  async seeUploadedFile(
    @Param('imageName') image: string,
    @Query('resolution') resolution: string,
    @Res() res,
  ) {
    const safeName = path.basename(image);
    const imagePath = path.join(process.cwd(), 'upload', 'images', safeName);
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, message: 'Image not found' });
    }

    try {
      const rendered = await renderOptimizedImage(imagePath, resolution);
      if (rendered) {
        res.setHeader('Content-Type', rendered.contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(rendered.buffer);
      }
    } catch (error) {
      this.logger.warn(`Failed to render ${safeName} at ${resolution}: ${error.message}`);
    }

    const ext = path.extname(safeName).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.webp': 'image/webp',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
    };

    if (contentTypes[ext]) {
      res.setHeader('Content-Type', contentTypes[ext]);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    return res.sendFile(safeName, { root: './upload/images' });
  }

  @Post('delete-single-image')
  deleteSingleFile(
    @Body('url') url: string,
    @Req() req,
  ): Promise<ResponsePayload> {
    const baseurl = this.getBaseUrl(req);
    const path = `.${url.replace(baseurl, '')}`;
    return this.uploadService.deleteSingleFile(path);
  }

  @Post('delete-multiple-image')
  deleteMultipleFile(
    @Body('url') url: string[],
    @Req() req,
  ): Promise<ResponsePayload> {
    const baseurl = this.getBaseUrl(req);
    return this.uploadService.deleteMultipleFile(baseurl, url);
  }

  /**
   * File CONTROL METHODS
   * uploadMultipleFiles()
   * seeUploadedFile()
   * deleteMultipleFile()
   */

  @Post('multiple-file')
  @UseInterceptors(
    FilesInterceptor('fileMulti', 50, {
      storage: diskStorage({
        destination: getUploadFilePath,
        filename: editFileName,
      }),
      fileFilter: allFileFilter,
    }),
  )
  async uploadMultipleFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ): Promise<FileUploadResponse[]> {
    const baseurl = this.getBaseUrl(req);
    const response: FileUploadResponse[] = [];
    files.forEach((file) => {
      const fileResponse = {
        extension: file.filename.split('.')[1]?.toLowerCase(),
        size: this.uploadService.bytesToKb(file.size),
        name: file.filename.split('.')[0],
        url: `${baseurl}/${file.path}`,
      } as FileUploadResponse;
      response.push(fileResponse);
    });
    return response;
  }

  @Get('files/:name')
  async seeUploadedFilePdf(@Param('name') file: string, @Res() res: any) {
    const filePath = path.join(process.cwd(), 'upload/files', file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(file, { root: './upload/files' });
  }

  @Post('delete-multiple-file')
  deleteMultipleFilePdf(
    @Body('url') url: string[],
    @Req() req: any,
  ): Promise<ResponsePayload> {
    const baseurl = this.getBaseUrl(req);
    return this.uploadService.deleteMultipleFilePdf(baseurl, url);
  }
}
