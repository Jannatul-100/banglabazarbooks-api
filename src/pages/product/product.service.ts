import {
  BadRequestException,
  CACHE_MANAGER,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { UtilsService } from '../../shared/utils/utils.service';
import { Product } from '../../interfaces/common/product.interface';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { ErrorCodes } from '../../enum/error-code.enum';
import { AdminRoles } from '../../enum/admin-roles.enum';
import { Admin } from '../../interfaces/admin/admin.interface';
import {
  AddProductDto,
  FilterAndPaginationProductDto,
  GetProductByIdsDto,
  OptionProductDto,
  UpdateProductDto,
} from '../../dto/product.dto';
import { Cache } from 'cache-manager';
import { Category } from '../../interfaces/common/category.interface';
import { Brand } from '../../interfaces/common/brand.interface';
import { Publisher } from '../../interfaces/common/publisher.interface';
import { SubCategory } from '../../interfaces/common/sub-category.interface';
import { Author } from '../../interfaces/common/author.interface';
import { Tag } from '../../interfaces/common/tag.interface';
import { ShopInformation } from '../../interfaces/common/shop-information.interface';
import { RedirectUrl } from '../../interfaces/common/redirect-url.interface';
import { PdfPreviewService } from '../../shared/pdf-preview/pdf-preview.service';
import { DiscountTypeEnum } from '../../enum/product.enum';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
const ObjectId = Types.ObjectId;

@Injectable()
export class ProductService {
  private logger = new Logger(ProductService.name);
  private readonly cacheProductPage = 'getAllProducts?page=1';
  private readonly cacheProductCount = 'getAllProducts?count';

  constructor(
    @InjectModel('Product') private readonly productModel: Model<Product>,
    @InjectModel('Category') private readonly categoryModel: Model<Category>,
    @InjectModel('SubCategory')
    private readonly subCategoryModel: Model<SubCategory>,
    @InjectModel('Brand') private readonly brandModel: Model<Brand>,
    @InjectModel('Publisher') private readonly publisherModel: Model<Publisher>,
    @InjectModel('Author') private readonly authorModel: Model<Author>,
    @InjectModel('Tags') private readonly tagModel: Model<Tag>,
    @InjectModel('RedirectUrl')
    private readonly redirectUrlModel: Model<RedirectUrl>,
    @InjectModel('ShopInformation')
    private readonly shopInformationModel: Model<ShopInformation>,
    private configService: ConfigService,
    private utilsService: UtilsService,
    private pdfPreviewService: PdfPreviewService,
    private httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) { }

  private isValidPdfUrl(url?: string | null): boolean {
    if (!url) {
      return false;
    }
    const value = String(url).trim();
    return /^(https?:\/\/|\/api\/|\/?upload\/files\/)/i.test(value);
  }

  private getPdfUrl(source?: {
    pdfUrl?: string;
    pdfFile?: string;
  }): string | null {
    const candidate = source?.pdfUrl || source?.pdfFile || null;
    if (!candidate || !this.isValidPdfUrl(candidate)) {
      return null;
    }
    return String(candidate).trim();
  }

  private syncPdfFields<T>(payload: T): T {
    const source = payload as { pdfUrl?: string; pdfFile?: string };
    const pdfUrl = this.getPdfUrl(source);
    if (pdfUrl) {
      source.pdfUrl = pdfUrl;
      source.pdfFile = pdfUrl;
    } else {
      delete source.pdfUrl;
      delete source.pdfFile;
    }
    return payload;
  }

  private bulkPreviewRunning = false;

  private async savePreviewForProduct(
    productId: string,
    pdfUrl: string,
    pageLimit = 0,
  ) {
    const preview = await this.pdfPreviewService.generatePreviewImages(
      productId,
      pdfUrl,
      pageLimit,
    );

    await this.productModel.findByIdAndUpdate(productId, {
      $set: {
        previewImages: preview.images,
        previewPageLimit: preview.pageLimit,
        pdfFileSize: preview.fileSize,
        pdfUrl,
        pdfFile: pdfUrl,
      },
    });
  }

  private queuePreviewGeneration(
    productId: string,
    pdfUrl: string,
    pageLimit = 0,
  ) {
    setImmediate(async () => {
      try {
        await this.savePreviewForProduct(productId, pdfUrl, pageLimit);

        await this.cacheManager.del(this.cacheProductPage);
        await this.cacheManager.del(this.cacheProductCount);
        this.logger.log(`Preview images generated for product ${productId}`);
      } catch (error) {
        this.logger.error(
          `Preview generation failed for product ${productId}: ${error?.message || error}`,
        );
      }
    });
  }

  private async runBulkPreviewGeneration(products: any[]) {
    let success = 0;
    let failed = 0;

    for (const product of products) {
      const productId = product._id.toString();
      const pdfUrl = this.getPdfUrl(product);

      if (!pdfUrl) {
        continue;
      }

      try {
        await this.savePreviewForProduct(productId, pdfUrl, 0);
        success++;
        this.logger.log(
          `Bulk preview ${success + failed}/${products.length}: saved ${productId}`,
        );
      } catch (error) {
        failed++;
        this.logger.error(
          `Bulk preview failed for ${productId}: ${error?.message || error}`,
        );
      }
    }

    this.bulkPreviewRunning = false;
    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);
    this.logger.log(
      `Bulk preview finished. Success: ${success}, Failed: ${failed}`,
    );
  }

  private getPreviewImagesDir(): string {
    const configured = this.configService.get<string>('previewImagesDir');
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    return path.join(process.cwd(), 'upload', 'images');
  }

  private hasPreviewFilesOnDisk(previewImages?: string[]): boolean {
    if (!previewImages?.length) {
      return false;
    }

    const previewDir = this.getPreviewImagesDir();
    return previewImages.every((imageUrl) => {
      const fileName = this.extractPreviewFileName(imageUrl);
      if (!fileName) {
        return false;
      }

      const filePath = path.join(previewDir, fileName);
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      return stats.isFile() && stats.size > 4096;
    });
  }

  private async filterProductsNeedingPreview(
    products: any[],
    onlyMissing: boolean,
  ): Promise<any[]> {
    const eligible: any[] = [];

    for (const product of products) {
      if (!this.getPdfUrl(product)) {
        continue;
      }

      if (!onlyMissing) {
        eligible.push(product);
        continue;
      }

      if (!product.previewImages?.length) {
        eligible.push(product);
        continue;
      }

      if (this.hasPreviewFilesOnDisk(product.previewImages)) {
        continue;
      }

      const remoteAvailable = await this.isPreviewAvailableRemotely(
        product.previewImages[0],
      );
      if (!remoteAvailable) {
        eligible.push(product);
      }
    }

    return eligible;
  }

  private async isPreviewAvailableRemotely(imageUrl: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.head(imageUrl, {
          timeout: 15000,
          validateStatus: (status) => status < 500,
        }),
      );

      if (response.status !== 200) {
        return false;
      }

      const contentType = String(response.headers['content-type'] || '');
      const contentLength = Number(response.headers['content-length'] || 0);
      return contentType.includes('webp') && contentLength > 4096;
    } catch (error) {
      return false;
    }
  }

  async generateAllBookPreviews(
    onlyMissing = true,
  ): Promise<ResponsePayload> {
    if (this.bulkPreviewRunning) {
      return {
        success: false,
        message: 'Book preview generation is already running. Please wait.',
      } as ResponsePayload;
    }

    const query: any = {
      $or: [
        { pdfFile: { $exists: true, $nin: [null, ''] } },
        { pdfUrl: { $exists: true, $nin: [null, ''] } },
      ],
    };

    let products;
    try {
      products = await this.productModel
        .find(query)
        .select('_id pdfFile pdfUrl previewImages previewPageLimit name')
        .lean();
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }

    const eligible = await this.filterProductsNeedingPreview(
      products,
      onlyMissing,
    );

    if (!eligible.length) {
      return {
        success: true,
        message: onlyMissing
          ? 'All books with PDF already have preview image files on this server.'
          : 'No books with PDF were found.',
        data: { total: 0, queued: 0 },
      } as ResponsePayload;
    }

    this.bulkPreviewRunning = true;
    this.logger.log(
      `Starting preview generation for ${eligible.length} book(s). Output dir: ${this.getPreviewImagesDir()}`,
    );
    setImmediate(() => this.runBulkPreviewGeneration(eligible));

    return {
      success: true,
      message: `Preview generation started for ${eligible.length} book(s). Images will be saved under ${this.getPreviewImagesDir()}. This runs in the background and may take a long time for large catalogs.`,
      data: {
        total: eligible.length,
        queued: eligible.length,
      },
    } as ResponsePayload;
  }

  async regenerateAllBookPreviews(): Promise<ResponsePayload> {
    if (this.bulkPreviewRunning) {
      return {
        success: false,
        message: 'Book preview generation is already running. Please wait.',
      } as ResponsePayload;
    }

    const deletedFiles = this.deleteAllBookPreviewFiles();
    let clearedProducts = 0;

    try {
      const result = await this.productModel.updateMany(
        {
          $or: [
            { pdfFile: { $exists: true, $nin: [null, ''] } },
            { pdfUrl: { $exists: true, $nin: [null, ''] } },
          ],
        },
        {
          $set: {
            previewImages: [],
            previewPageLimit: 0,
            pdfFileSize: 0,
          },
        },
      );
      clearedProducts = result.modifiedCount || 0;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }

    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);

    this.logger.log(
      `Regenerate all previews: deleted ${deletedFiles} file(s), cleared ${clearedProducts} product record(s)`,
    );

    return this.generateAllBookPreviews(false);
  }

  private deleteAllBookPreviewFiles(): number {
    const dirs = new Set<string>([
      this.getPreviewImagesDir(),
      path.join(process.cwd(), 'upload', 'images'),
    ]);
    let deleted = 0;

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        continue;
      }

      for (const file of fs.readdirSync(dir)) {
        if (!file.startsWith('book-preview-') || !file.endsWith('.webp')) {
          continue;
        }

        try {
          fs.unlinkSync(path.join(dir, file));
          deleted++;
        } catch (error) {
          this.logger.warn(`Failed to delete preview file ${file}: ${error?.message || error}`);
        }
      }
    }

    return deleted;
  }

  private derivePreviewApiBase(pdfUrl?: string): string {
    if (pdfUrl) {
      try {
        const parsed = new URL(pdfUrl.trim());
        const apiIndex = parsed.pathname.indexOf('/api');
        if (apiIndex >= 0) {
          return `${parsed.origin}${parsed.pathname.substring(0, apiIndex + 4)}`;
        }
        return `${parsed.origin}/api`;
      } catch (error) {
        // fall through to configured/default base
      }
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

  private extractPreviewFileName(imageUrl: string): string | null {
    return imageUrl.split('/upload/images/')[1]?.split('?')[0] || null;
  }

  async fixPreviewImageUrls(): Promise<ResponsePayload> {
    let products;

    try {
      products = await this.productModel
        .find({
          previewImages: { $exists: true, $not: { $size: 0 } },
        })
        .select('_id pdfFile pdfUrl previewImages')
        .lean();
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }

    let updated = 0;

    for (const product of products) {
      const pdfUrl = this.getPdfUrl(product);
      if (!pdfUrl || !product.previewImages?.length) {
        continue;
      }

      const apiBase = this.derivePreviewApiBase(pdfUrl);
      const fixedImages = product.previewImages.map((imageUrl: string) => {
        const fileName = this.extractPreviewFileName(imageUrl);
        if (!fileName) {
          return imageUrl;
        }

        return `${apiBase.replace(/\/$/, '')}/upload/images/${fileName}`;
      });

      const changed = fixedImages.some(
        (url, index) => url !== product.previewImages[index],
      );

      if (!changed) {
        continue;
      }

      await this.productModel.updateOne(
        { _id: product._id },
        { $set: { previewImages: fixedImages } },
      );
      updated++;
    }

    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);

    return {
      success: true,
      message: `Updated preview image URLs for ${updated} book(s).`,
      data: { updated },
    } as ResponsePayload;
  }

  /**
   * addProduct
   * insertManyProduct
   */
  async addProduct(
    addProductDto: AddProductDto,
    admin?: Admin,
  ): Promise<ResponsePayload> {
    const { nameEn, name, quantity } = addProductDto;

    const isPublisher = admin?.role === AdminRoles.PUBLISHER;
    if (isPublisher) {
      if (!admin.publisher?._id) {
        throw new BadRequestException('No publisher assigned to this account.');
      }
      addProductDto.publisher = admin.publisher;
      addProductDto.status = 'draft';
      (addProductDto as any).approvalStatus = 'pending';
      (addProductDto as any).isPublisherProduct = true;
    } else {
      (addProductDto as any).approvalStatus = 'approved';
    }

    if (addProductDto.slug) {
      let baseSlug = addProductDto.slug;
      let currentSlug = baseSlug;
      let existingSlug = await this.productModel.findOne({ slug: currentSlug });
      
      if (existingSlug && addProductDto.publisher?.slug) {
        baseSlug = `${addProductDto.slug}-${addProductDto.publisher.slug}`;
        currentSlug = baseSlug;
        existingSlug = await this.productModel.findOne({ slug: currentSlug });
      }

      let counter = 1;
      while (existingSlug) {
        currentSlug = `${baseSlug}-${counter}`;
        existingSlug = await this.productModel.findOne({ slug: currentSlug });
        counter++;
      }
      addProductDto.slug = currentSlug;
    }

    const defaultData = {
      quantity: quantity ? quantity : 0,
    };

    const mData = this.syncPdfFields({ ...addProductDto, ...defaultData });
    console.log("addProduct mData.subCategory:", JSON.stringify(mData.subCategory));
    const newData = new this.productModel(mData);
    try {
      const saveData = await newData.save();
      const data = {
        _id: saveData._id,
      };

      const pdfUrl = this.getPdfUrl(saveData);
      if (pdfUrl) {
        this.queuePreviewGeneration(saveData._id.toString(), pdfUrl, 0);
      }

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      const message = isPublisher
        ? 'Book submitted successfully and is pending approval from Admin.'
        : 'Data Added Success';

      return {
        success: true,
        message,
        data,
      } as ResponsePayload;
    } catch (error) {
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        let field = 'Field';
        if (error.keyValue) {
           field = Object.keys(error.keyValue)[0];
        }
        throw new ConflictException(`${field} Must be Unique`);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async cloneSingleProduct(id: string): Promise<ResponsePayload> {
    try {
      const data = await this.productModel.findById(id);
      const jData = JSON.stringify(data);
      const product = JSON.parse(jData);

      product.name = `${product.name}(Clone-${this.utilsService.getRandomInt(
        0,
        100,
      )})`;
      product.slug = this.utilsService.transformToSlug(product.name, true);
      product.sku = `${product.sku}-${this.utilsService.getRandomInt(0, 100)}`;
      product.quantity = 0;
      delete product._id;
      delete product.createdAt;
      delete product.updatedAt;

      const newData = new this.productModel(product);
      const saveData = await newData.save();

      const response = {
        _id: saveData._id,
      };

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      return {
        success: true,
        message: 'Data Clone Success',
        data: response,
      } as ResponsePayload;
    } catch (error) {
      console.log(error);
      // console.log(error);
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        let field = 'Field';
        if (error.keyValue) {
           field = Object.keys(error.keyValue)[0];
        }
        throw new ConflictException(`${field} Must be Unique`);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async insertManyProduct(
    addProductsDto: AddProductDto[],
    optionProductDto: OptionProductDto,
  ): Promise<ResponsePayload> {
    const { deleteMany } = optionProductDto;
    if (deleteMany) {
      await this.productModel.deleteMany({});
    }
    const mData = addProductsDto.map((m) => {
      return {
        ...m,
        ...{
          slug: this.utilsService.transformToSlug(m.name),
        },
      };
    });
    try {
      const saveData = await this.productModel.insertMany(mData);

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      return {
        success: true,
        message: `${saveData && saveData.length ? saveData.length : 0
          }  Data Added Success`,
      } as ResponsePayload;
    } catch (error) {
      console.log(error);
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        let field = 'Field';
        if (error.keyValue) {
           field = Object.keys(error.keyValue)[0];
        }
        throw new ConflictException(`${field} Must be Unique`);
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  private normalizeHeader(value: string): string {
    return (value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
  }

  private toNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private toBoolean(value: any): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', 'yes', '1'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', '0'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  private parseList(value: any): string[] {
    if (!value) {
      return [];
    }
    return String(value)
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseBilingualList(
    bnValue: any,
    enValue?: any,
  ): { name: string; nameEn: string }[] {
    const bnItems = this.parseList(bnValue);
    const enItems = enValue ? this.parseList(enValue) : [];

    if (!bnItems.length && !enItems.length) {
      return [];
    }

    if (bnItems.some((item) => item.includes(':'))) {
      return bnItems.map((item) => {
        const [name, nameEn] = item.split(':').map((part) => part.trim());
        const resolvedName = name || nameEn;
        return {
          name: resolvedName,
          nameEn: nameEn || resolvedName,
        };
      });
    }

    const max = Math.max(bnItems.length, enItems.length);
    const pairs: { name: string; nameEn: string }[] = [];
    for (let i = 0; i < max; i++) {
      const name = (bnItems[i] || enItems[i] || '').trim();
      if (!name) {
        continue;
      }
      const nameEn = (enItems[i] || bnItems[i] || name).trim();
      pairs.push({ name, nameEn });
    }
    return pairs;
  }

  private pickValue(row: Record<string, any>, keys: string[]): any {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return undefined;
  }

  private resolveBulkPricing(row: Record<string, any>): {
    salePrice: number;
    discountType?: number;
    discountAmount?: number;
  } {
    const regularPrice = this.toNumber(
      this.pickValue(row, ['regular_price', 'regularprice', 'mrp', 'list_price']),
    );
    const sellingPrice = this.toNumber(
      this.pickValue(row, ['sale_price', 'saleprice', 'selling_price', 'final_price']),
    );
    const explicitDiscountType = this.toNumber(
      this.pickValue(row, ['discount_type', 'discounttype']),
    );
    const explicitDiscountAmount = this.toNumber(
      this.pickValue(row, [
        'discount_amount',
        'discountamount',
        'discount_percent',
        'discount_percentage',
        'cash_discount',
        'cash_discount_amount',
      ]),
    );

    if (regularPrice !== undefined && sellingPrice !== undefined) {
      if (regularPrice > sellingPrice) {
        const discountPercent =
          explicitDiscountAmount ??
          Math.round(((regularPrice - sellingPrice) / regularPrice) * 100);

        return {
          salePrice: regularPrice,
          discountType: explicitDiscountType ?? DiscountTypeEnum.PERCENTAGE,
          discountAmount: discountPercent,
        };
      }

      const pricing: {
        salePrice: number;
        discountType?: number;
        discountAmount?: number;
      } = { salePrice: regularPrice };

      if (explicitDiscountType !== undefined) {
        pricing.discountType = explicitDiscountType;
      }
      if (explicitDiscountAmount !== undefined) {
        pricing.discountAmount = explicitDiscountAmount;
      }
      return pricing;
    }

    if (regularPrice !== undefined) {
      const pricing: {
        salePrice: number;
        discountType?: number;
        discountAmount?: number;
      } = { salePrice: regularPrice };

      if (explicitDiscountType !== undefined) {
        pricing.discountType = explicitDiscountType;
      }
      if (explicitDiscountAmount !== undefined) {
        pricing.discountAmount = explicitDiscountAmount;
      }
      return pricing;
    }

    const pricing: {
      salePrice: number;
      discountType?: number;
      discountAmount?: number;
    } = { salePrice: sellingPrice ?? 0 };

    if (explicitDiscountType !== undefined) {
      pricing.discountType = explicitDiscountType;
    }
    if (explicitDiscountAmount !== undefined) {
      pricing.discountAmount = explicitDiscountAmount;
    }
    return pricing;
  }

  private normalizeBulkStatus(value: any): string {
    const raw = String(value || 'draft').trim().toLowerCase();
    if (!raw) {
      return 'draft';
    }
    if (['publish', 'published', 'active', 'live', 'yes', '1', 'true'].includes(raw)) {
      return 'publish';
    }
    if (['draft', 'unpublished', 'inactive', 'no', '0', 'false'].includes(raw)) {
      return 'draft';
    }
    return raw;
  }

  private async resolveCategory(nameBn?: string, nameEn?: string) {
    const bn = nameBn?.trim();
    const en = nameEn?.trim();
    if (!bn && !en) {
      return null;
    }

    const searchValues = [bn, en].filter(Boolean);
    const existing = await this.categoryModel
      .findOne({
        $or: [
          { slug: { $in: searchValues } },
          { name: { $in: searchValues } },
          { nameEn: { $in: searchValues } },
        ],
      })
      .select('_id name nameEn slug')
      .lean();
    if (existing) {
      return existing;
    }

    const slug = this.utilsService.transformToSlug(en || bn, true);
    try {
      const created = await this.categoryModel.create({
        name: bn || en,
        nameEn: en || bn,
        slug,
        status: 'publish',
      });
      return {
        _id: created._id,
        name: created.name,
        nameEn: created.nameEn,
        slug: created.slug,
      };
    } catch (error) {
      return this.categoryModel
        .findOne({ slug })
        .select('_id name nameEn slug')
        .lean();
    }
  }

  private async resolveSubCategory(
    nameBn?: string,
    nameEn?: string,
    categoryId?: string,
  ) {
    const bn = nameBn?.trim();
    const en = nameEn?.trim();
    if (!bn && !en) {
      return null;
    }

    const searchValues = [bn, en].filter(Boolean);
    const existing = await this.subCategoryModel
      .findOne({
        $or: [
          { slug: { $in: searchValues } },
          { name: { $in: searchValues } },
          { nameEn: { $in: searchValues } },
        ],
      })
      .select('_id name nameEn slug')
      .lean();
    if (existing) {
      return existing;
    }
    if (!categoryId) {
      return null;
    }

    const slug = this.utilsService.transformToSlug(en || bn, true);
    try {
      const created = await this.subCategoryModel.create({
        name: bn || en,
        nameEn: en || bn,
        slug,
        category: new ObjectId(categoryId),
        status: 'publish',
      });
      return {
        _id: created._id,
        name: created.name,
        nameEn: created.nameEn,
        slug: created.slug,
      };
    } catch (error) {
      return this.subCategoryModel
        .findOne({ slug })
        .select('_id name nameEn slug')
        .lean();
    }
  }

  private async resolvePublisher(nameBn?: string, nameEn?: string) {
    const bn = nameBn?.trim();
    const en = nameEn?.trim();
    if (!bn && !en) {
      return null;
    }

    const searchValues = [bn, en].filter(Boolean);
    const existing = await this.publisherModel
      .findOne({
        $or: [
          { slug: { $in: searchValues } },
          { name: { $in: searchValues } },
          { nameEn: { $in: searchValues } },
        ],
      })
      .select('_id name nameEn slug')
      .lean();
    if (existing) {
      return existing;
    }

    const slug = this.utilsService.transformToSlug(en || bn, true);
    try {
      const created = await this.publisherModel.create({
        name: bn || en,
        nameEn: en || bn,
        slug,
      });
      return {
        _id: created._id,
        name: created.name,
        nameEn: created.nameEn,
        slug: created.slug,
      };
    } catch (error) {
      return this.publisherModel.findOne({ slug }).select('_id name nameEn slug').lean();
    }
  }

  private async resolveAuthorList(
    values: { name: string; nameEn: string }[],
  ) {
    if (!values.length) {
      return [];
    }
    const authorList: { _id: any; name: string; nameEn?: string; slug: string }[] = [];

    for (const value of values) {
      const bn = value.name?.trim();
      const en = value.nameEn?.trim();
      if (!bn && !en) {
        continue;
      }

      const searchValues = [bn, en].filter(Boolean);
      let author = await this.authorModel
        .findOne({
          $or: [
            { slug: { $in: searchValues } },
            { name: { $in: searchValues } },
            { nameEn: { $in: searchValues } },
          ],
        })
        .select('_id name nameEn slug')
        .lean();

      if (!author) {
        const slug = this.utilsService.transformToSlug(en || bn, true);
        try {
          const created = await this.authorModel.create({
            name: bn || en,
            nameEn: en || bn,
            slug,
          });
          author = {
            _id: created._id,
            name: created.name,
            nameEn: created.nameEn,
            slug: created.slug,
          };
        } catch (error) {
          author = await this.authorModel
            .findOne({ slug })
            .select('_id name nameEn slug')
            .lean();
        }
      }

      if (author) {
        authorList.push({
          _id: author._id,
          name: author.name,
          nameEn: author.nameEn,
          slug: author.slug,
        });
      }
    }

    return authorList;
  }

  private async resolveTagList(values: string[]) {
    if (!values.length) {
      return [];
    }
    const tagList: { _id: any; name: string; slug: string }[] = [];
    for (const value of values) {
      const q = value.trim();
      if (!q) {
        continue;
      }
      let tag = await this.tagModel
        .findOne({
          $or: [{ slug: q }, { name: q }],
        })
        .select('_id name slug')
        .lean();

      if (!tag) {
        const slug = this.utilsService.transformToSlug(q, true);
        try {
          const created = await this.tagModel.create({
            name: q,
            slug,
            status: 'publish',
          });
          tag = {
            _id: created._id,
            name: created.name,
            slug: created.slug,
          };
        } catch (error) {
          tag = await this.tagModel.findOne({ slug }).select('_id name slug').lean();
        }
      }

      if (tag) {
        tagList.push({
          _id: tag._id,
          name: tag.name,
          slug: tag.slug,
        });
      }
    }

    return tagList;
  }

  async bulkImportProducts(
    rows: Record<string, any>[],
    overwrite = false,
  ): Promise<ResponsePayload> {
    if (!Array.isArray(rows) || !rows.length) {
      throw new BadRequestException('rows array is required');
    }

    const summary = {
      totalRows: rows.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      missingAuthors: 0,
      statusNormalized: 0,
      errors: [] as { row: number; message: string }[],
    };

    for (let i = 0; i < rows.length; i++) {
      const sourceRow = rows[i] || {};
      const row: Record<string, any> = {};
      Object.keys(sourceRow).forEach((key) => {
        row[this.normalizeHeader(key)] = sourceRow[key];
      });
      const rowNo = i + 2;

      try {
        const name = String(this.pickValue(row, ['name']) || '').trim();
        const nameEn = String(this.pickValue(row, ['name_en', 'nameen']) || name).trim();
        if (!name) {
          summary.skipped++;
          summary.errors.push({ row: rowNo, message: 'Missing name' });
          continue;
        }
        const id = this.pickValue(row, ['id', '_id']);
        const sku = this.pickValue(row, ['sku']);
        const rawSlug = this.pickValue(row, ['slug']);
        const slug = rawSlug
          ? this.utilsService.transformToSlug(String(rawSlug), false)
          : this.utilsService.transformToSlug(String(nameEn || name), true);

        const categoryBn = this.pickValue(row, [
          'category',
          'category_bn',
          'category_name',
        ]);
        const categoryEn = this.pickValue(row, [
          'category_en',
          'category_name_en',
        ]);
        const category = await this.resolveCategory(
          categoryBn ? String(categoryBn) : undefined,
          categoryEn ? String(categoryEn) : undefined,
        );
        if (!category) {
          summary.skipped++;
          summary.errors.push({ row: rowNo, message: 'Missing category (Bangla or English)' });
          continue;
        }

        const subCategoryBn = this.pickValue(row, [
          'sub_category',
          'subcategory',
          'sub_category_bn',
          'sub_category_name',
        ]);
        const subCategoryEn = this.pickValue(row, [
          'sub_category_en',
          'subcategory_en',
          'sub_category_name_en',
        ]);
        const publisherBn = this.pickValue(row, [
          'publisher',
          'publisher_bn',
          'publisher_name',
        ]);
        const publisherEn = this.pickValue(row, [
          'publisher_en',
          'publisher_name_en',
        ]);
        const authorPairs = this.parseBilingualList(
          this.pickValue(row, ['authors', 'author', 'authors_bn', 'author_bn', 'author_name']),
          this.pickValue(row, ['authors_en', 'author_en', 'author_name_en']),
        );
        if (!authorPairs.length) {
          summary.missingAuthors++;
        }
        const translatorBn = this.parseList(
          this.pickValue(row, [
            'translator',
            'translators',
            'translator_name',
            'translator_names',
            'translator_bn',
          ]),
        );
        const translatorEn = this.parseList(
          this.pickValue(row, [
            'translator_en',
            'translators_en',
            'translator_name_en',
            'translator_names_en',
          ]),
        );
        const rawTags = this.pickValue(row, ['tags', 'tag_slugs']);
        const tagValues = rawTags !== undefined ? this.parseList(rawTags) : undefined;
        const rawImages = this.pickValue(row, ['images', 'image_urls']);
        const imageValues = rawImages !== undefined ? this.parseList(rawImages) : undefined;

        const [subCategory, publisher, authors, tags] = await Promise.all([
          this.resolveSubCategory(
            subCategoryBn ? String(subCategoryBn) : undefined,
            subCategoryEn ? String(subCategoryEn) : undefined,
            String(category._id),
          ),
          this.resolvePublisher(
            publisherBn ? String(publisherBn) : undefined,
            publisherEn ? String(publisherEn) : undefined,
          ),
          this.resolveAuthorList(authorPairs),
          this.resolveTagList(tagValues || []),
        ]);

        let existing = null;
        if (id) {
          try {
            existing = await this.productModel.findOne({ _id: new ObjectId(String(id).trim()) });
            fs.appendFileSync('bulk-import-log.txt', `Found existing via ID: ${existing ? 'YES' : 'NO'} for row ${rowNo}\n`);
          } catch (e) {
            fs.appendFileSync('bulk-import-log.txt', `Error finding by ID for row ${rowNo}: ${e.message}\n`);
          }
        }
        if (!existing && sku) {
          existing = await this.productModel.findOne({ sku: String(sku).trim() });
        }
        if (!existing && rawSlug) {
          existing = await this.productModel.findOne({ slug });
        }
        if (!existing && !sku && !rawSlug) {
          const qName: any = {
            name: name.trim()
          };
          
          if (overwrite) {
            // 1. Try to match by Name + Price + Publisher
            let qExact = { ...qName };
            if (row.regular_price !== undefined && row.regular_price !== '') qExact['regularPrice'] = Number(row.regular_price);
            if (row.sale_price !== undefined && row.sale_price !== '') qExact['salePrice'] = Number(row.sale_price);
            if (publisher && publisher._id) {
               qExact['publisher._id'] = publisher._id;
            }
            
            const exactMatches = await this.productModel.find(qExact);
            if (exactMatches.length === 1) {
              existing = exactMatches[0];
            } else if (exactMatches.length > 1) {
              // Try with just Name + Publisher as fallback
              const pubMatches = await this.productModel.find({ ...qName, 'publisher._id': publisher._id });
              if (pubMatches.length === 1) {
                 existing = pubMatches[0];
              } else {
                 fs.appendFileSync('bulk-import-log.txt', `Skipping row ${rowNo}: Found ${exactMatches.length} books with exact Name+Price+Publisher. Must use _id.\n`);
                 summary.skipped++;
                 summary.errors.push({ row: rowNo, message: `Ambiguous match. Multiple books found for ${name}. Must use _id.` });
                 continue;
              }
            }

            // 2. Fallback: match by Name + Publisher only
            if (!existing && publisher && publisher._id) {
              const pubMatches = await this.productModel.find({ ...qName, 'publisher._id': publisher._id });
              if (pubMatches.length === 1) {
                existing = pubMatches[0];
              }
            }

            // 3. Fallback: match by Name only, BUT strictly check for duplicates to prevent cross-updating
            if (!existing) {
              const duplicates = await this.productModel.find(qName);
              if (duplicates.length === 1) {
                existing = duplicates[0];
              } else if (duplicates.length > 1) {
                fs.appendFileSync('bulk-import-log.txt', `Skipping row ${rowNo}: Found ${duplicates.length} books named '${name}'. Please use _id.\n`);
                summary.skipped++;
                summary.errors.push({ row: rowNo, message: `Multiple books found with name ${name}. Must use _id to overwrite.` });
                continue;
              }
            }
          } else {
             // Create mode: prevent duplicate names for same author
             const authorIds = authors.map((a: any) => a._id);
             if (authorIds.length > 0) {
                qName['author._id'] = { $in: authorIds };
             }
             existing = await this.productModel.findOne(qName);
          }
        }

        if (existing && !overwrite) {
          summary.skipped++;
          continue;
        }

        const pricing = this.resolveBulkPricing(row);
        const rawStatus = this.pickValue(row, ['status']);
        const status = this.normalizeBulkStatus(rawStatus);
        if (
          rawStatus &&
          String(rawStatus).trim().toLowerCase() !== status
        ) {
          summary.statusNormalized++;
        }

        const payload: Record<string, any> = {
          name: name.trim(),
          nameEn: nameEn.trim(),
          tagline: this.pickValue(row, ['tagline', 'tagline_bn']),
          taglineEn: this.pickValue(row, ['tagline_en']),
          edition: this.pickValue(row, ['edition', 'edition_bn']),
          editionEn: this.pickValue(row, ['edition_en']),
          currentVersion: this.pickValue(row, ['current_version', 'version']),
          currentVersionEn: this.pickValue(row, ['current_version_en', 'version_en']),
          sku: sku ? String(sku).trim() : undefined,
          salePrice: pricing.salePrice,
          discountType: pricing.discountType,
          discountAmount: pricing.discountAmount,
          costPrice: this.toNumber(this.pickValue(row, ['cost_price', 'costprice'])),
          dollarPrice: this.toNumber(this.pickValue(row, ['dollar_price'])),
          quantity: this.toNumber(this.pickValue(row, ['quantity'])) ?? 0,
          trackQuantity:
            this.toBoolean(
              this.pickValue(row, ['track_quantity', 'trackquantity']),
            ) ?? true,
          status,
          freeDelivery: this.toBoolean(this.pickValue(row, ['free_delivery'])) ?? false,
          language: this.pickValue(row, ['language']),
          country: this.pickValue(row, ['country']),
          isbn: this.pickValue(row, ['isbn']),
          unit: this.pickValue(row, ['unit']),
          totalPages: this.toNumber(this.pickValue(row, ['total_pages', 'totalpages'])),
          pdfUrl: (() => {
            const raw = this.pickValue(row, ['pdf_url']);
            return this.isValidPdfUrl(raw) ? String(raw).trim() : undefined;
          })(),
          description: this.pickValue(row, ['description']),
          shortDescription: this.pickValue(row, ['short_description']),
          seoTitle: this.pickValue(row, ['seo_title']),
          seoDescription: this.pickValue(row, ['seo_description']),
          seoKeywords: this.pickValue(row, ['seo_keywords']),
          images: imageValues && imageValues.length > 0 ? imageValues : undefined,
          category: category
            ? {
                _id: category._id,
                name: category.name,
                nameEn: category.nameEn,
                slug: category.slug,
              }
            : undefined,
          subCategory: subCategory
            ? {
                _id: subCategory._id,
                name: subCategory.name,
                nameEn: subCategory.nameEn,
                slug: subCategory.slug,
              }
            : undefined,
          publisher: publisher
            ? {
                _id: publisher._id,
                name: publisher.name,
                nameEn: publisher.nameEn,
                slug: publisher.slug,
              }
            : undefined,
          author: authors.length ? authors : undefined,
          translatorName: translatorBn.length ? translatorBn : undefined,
          translatorNameEn: translatorEn.length ? translatorEn : undefined,
          tags,
        };

        if (!existing || rawSlug) {
          payload.slug = slug;
        }

        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });

        if (existing && overwrite) {
          fs.appendFileSync('bulk-import-log.txt', `Attempting update for ${existing._id} with author: ${JSON.stringify(payload.author)}\n`);
          await this.productModel.updateOne({ _id: existing._id }, { $set: payload });
          summary.updated++;
          fs.appendFileSync('bulk-import-log.txt', `Successfully updated ${existing._id}\n`);
        } else if (!existing) {
          const newProduct = new this.productModel(payload);
          await newProduct.save();
          summary.created++;
          fs.appendFileSync('bulk-import-log.txt', `Created new product ${newProduct._id}\n`);
        } else {
          summary.skipped++;
          fs.appendFileSync('bulk-import-log.txt', `Skipped existing product ${existing._id} (overwrite=false)\n`);
        }
      } catch (error) {
        console.error(error);
        fs.appendFileSync('bulk-import-log.txt', `Crashed for row ${rowNo}: ${error.message}\n`);
        summary.failed++;
        summary.errors.push({
          row: rowNo,
          message: error?.message || 'Unknown error',
        });
      }
    }

    fs.appendFileSync('bulk-import-log.txt', `Finished! Result: ${JSON.stringify(summary)}\n------------------\n`);

    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);

    return {
      success: summary.failed === 0,
      message: 'Bulk product import completed',
      data: summary,
    } as ResponsePayload;
  }

  async getAllProductForUi(payload: Record<string, any>): Promise<ResponsePayload> {
    try {
      const { status, page = 1, limit = 12 } = payload;
      const tagName = payload['tags.name'];
      const tagSlug = payload['tags.slug'];
      const tagId = payload['tags._id'];
      const mFilter: Record<string, any> = {};

      if (status) {
        mFilter.status = status;
      }

      const tagConditions: any[] = [];
      if (tagId && ObjectId.isValid(tagId)) {
        tagConditions.push({ 'tags._id': new ObjectId(tagId) });
      }
      if (tagSlug) {
        tagConditions.push({ 'tags.slug': tagSlug });
        tagConditions.push({ 'tags.name': tagSlug });
        if (ObjectId.isValid(tagSlug)) {
          tagConditions.push({ 'tags._id': new ObjectId(tagSlug) });
        }
        try {
          const foundTag = await this.tagModel.findOne({
            $or: [{ slug: tagSlug }, { name: tagSlug }]
          }).lean();
          if (foundTag) {
            tagConditions.push({ 'tags._id': foundTag._id });
            if (foundTag.slug) tagConditions.push({ 'tags.slug': foundTag.slug });
            if (foundTag.name) tagConditions.push({ 'tags.name': foundTag.name });
          }
        } catch (e) {}
      }
      if (tagName) {
        tagConditions.push({ 'tags.name': tagName });
      }

      if (tagConditions.length > 0) {
        mFilter.$or = tagConditions;
      }

      const sortQuery: Record<string, number> = { createdAt: -1 };
      const skip = (Number(page) - 1) * Number(limit);

      const data = await this.productModel
        .find(mFilter)
        .select(
          'name nameEn seoKeyword seoTitle seoDescription author discountType slug discountAmount tags quantity regularPrice salePrice ratingTotal images ratingCount category freeDelivery offerDiscountAmount offerDiscountType isTag tagImage totalSold',
        )
        .skip(Number(skip))
        .limit(Number(limit))
        .sort(sortQuery);

      const totalCount = await this.productModel.countDocuments(mFilter);

      return {
        success: true,
        message: 'Success! Data fetch successfully.',
        data,
        count: totalCount,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  private getAdminFromRequest(req: any): any {
    try {
      const adminObj = req?.admin || req?.user;

      const rawHeader =
        req?.headers?.administrator ||
        req?.headers?.authorization ||
        req?.headers?.['administrator'] ||
        req?.headers?.['authorization'];

      let jwtPayload: any = null;
      if (rawHeader && typeof rawHeader === 'string') {
        const token = rawHeader.startsWith('Bearer ')
          ? rawHeader.split(' ')[1]
          : rawHeader;
        const parts = token.split('.');
        if (parts.length === 3) {
          const decoded = Buffer.from(parts[1], 'base64').toString('utf8');
          jwtPayload = JSON.parse(decoded);
        }
      }

      if (adminObj) {
        return {
          ...jwtPayload,
          ...adminObj,
          publisher: adminObj.publisher || jwtPayload?.publisher,
        };
      }

      if (jwtPayload) {
        return jwtPayload;
      }
    } catch (e) {}
    return null;
  }

  /**
   * getAllProducts
   * getProductById
   */
  async getAllProducts(
    filterProductDto: FilterAndPaginationProductDto,
    searchQuery?: string,
    req?: any,
  ): Promise<ResponsePayload> {
    const { filter } = filterProductDto;
    const { pagination } = filterProductDto;
    const { sort } = filterProductDto;
    const { select } = filterProductDto;
    const { filterGroup } = filterProductDto;

    // Modify Id as Object ID
    if (filter && filter['category._id']) {
      const catId = filter['category._id'];
      if (typeof catId === 'string' && ObjectId.isValid(catId)) {
        filter['category._id'] = { $in: [new ObjectId(catId), catId] };
      } else if (ObjectId.isValid(catId)) {
        filter['category._id'] = { $in: [new ObjectId(catId), catId.toString()] };
      }
    }

    if (filter && filter['subCategory._id']) {
      filter['subCategory._id'] = new ObjectId(filter['subCategory._id']);
    }

    if (filter && filter['brand._id']) {
      filter['brand._id'] = new ObjectId(filter['brand._id']);
    }
    if (filter && filter['publisher._id']) {
      const pubId = filter['publisher._id'];
      if (typeof pubId === 'string' && ObjectId.isValid(pubId)) {
        filter['publisher._id'] = { $in: [new ObjectId(pubId), pubId] };
      } else if (ObjectId.isValid(pubId)) {
        filter['publisher._id'] = { $in: [new ObjectId(pubId), pubId.toString()] };
      }
    }

    if (filter && filter['tags._id']) {
      filter['tags._id'] = new ObjectId(filter['tags._id']);
    }

    if (filter && filter['author._id']) {
      const authorId = filter['author._id'];
      if (typeof authorId === 'string' && ObjectId.isValid(authorId)) {
        filter['author._id'] = { $in: [new ObjectId(authorId), authorId] };
      } else if (ObjectId.isValid(authorId)) {
        filter['author._id'] = { $in: [new ObjectId(authorId), authorId.toString()] };
      }
    }

    if (filter && filter['translator._id']) {
      const translatorId = filter['translator._id'];
      if (typeof translatorId === 'string' && ObjectId.isValid(translatorId)) {
        filter['translator._id'] = { $in: [new ObjectId(translatorId), translatorId] };
      } else if (ObjectId.isValid(translatorId)) {
        filter['translator._id'] = { $in: [new ObjectId(translatorId), translatorId.toString()] };
      }
    }

    if (filter && filter['createdAt']) {
      filter['createdAt']['$gte'] = new Date(filter['createdAt']['$gte']);
      filter['createdAt']['$lte'] = new Date(filter['createdAt']['$lte']);
    }

    // Aggregate Stages
    const aggregateStages = [];
    const aggregateCategoryGroupStages = [];
    const aggregateBrandGroupStages = [];
    const aggregatePublisherGroupStages = [];
    const aggregateSubCategoryGroupStages = [];

    // Essential Variables
    let mFilter: Record<string, any> = {};
    let mSort = {};
    let mSelect = {};
    let mPagination = {};

    // Match
    if (filter) {
      mFilter = { ...mFilter, ...filter };
    }

    const callerAdmin = this.getAdminFromRequest(req);
    if (callerAdmin?.role === AdminRoles.PUBLISHER && callerAdmin?.publisher?._id) {
      const pubId = callerAdmin.publisher._id;
      const pubObjId = ObjectId.isValid(pubId) ? new ObjectId(pubId) : null;
      mFilter['publisher._id'] = pubObjId
        ? { $in: [pubObjId, pubId.toString()] }
        : pubId;
    }

    if (mFilter['tags.slug']) {
      const tagVal = mFilter['tags.slug'];
      delete mFilter['tags.slug'];
      const tagConds: any[] = [
        { 'tags.slug': tagVal },
        { 'tags.name': tagVal },
      ];
      if (ObjectId.isValid(tagVal)) {
        tagConds.push({ 'tags._id': new ObjectId(tagVal) });
      }
      try {
        const foundTag = await this.tagModel.findOne({
          $or: [{ slug: tagVal }, { name: tagVal }]
        }).lean();
        if (foundTag) {
          tagConds.push({ 'tags._id': foundTag._id });
          if (foundTag.slug) tagConds.push({ 'tags.slug': foundTag.slug });
          if (foundTag.name) tagConds.push({ 'tags.name': foundTag.name });
        }
      } catch (e) {}

      if (!mFilter.$or) {
        mFilter.$or = tagConds;
      } else {
        if (!mFilter.$and) mFilter.$and = [];
        mFilter.$and.push({ $or: tagConds });
      }
    }

    // if (searchQuery) {
    //   mFilter = {
    //     $and: [
    //       mFilter,
    //       {
    //         $or: [
    //           {
    //             // name: new RegExp(
    //             //   this.utilsService.transformRegexString(searchQuery),
    //             //   'i',
    //             // ),
    //             name: this.utilsService.createRegexFromString(searchQuery),
    //
    //           },
    //           // { slug: new RegExp(searchQuery, 'i') },
    //           // { 'category.slug': new RegExp(searchQuery, 'i') },
    //           // { 'category.name': new RegExp(searchQuery, 'i') },
    //         ],
    //       },
    //     ],
    //   };
    //   // mFilter = { ...mFilter, ...{ name: new RegExp(searchQuery, 'i') } };
    // }
    if (searchQuery && typeof searchQuery === 'string') {
      const cleanQuery = searchQuery.trim();
      if (cleanQuery) {
        const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escaped, 'i');
        const tokens = cleanQuery.split(/\s+/).filter(Boolean);
        const multiWordRegex = tokens.length > 1
          ? new RegExp(tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*'), 'i')
          : null;

        const orConditions: any[] = [
          { name: searchRegex },
          { nameEn: searchRegex },
          { slug: searchRegex },
          { sku: searchRegex },
          { isbn: searchRegex },
          { 'author.name': searchRegex },
          { 'author.nameEn': searchRegex },
          { 'author.slug': searchRegex },
          { 'publisher.name': searchRegex },
          { 'publisher.nameEn': searchRegex },
          { 'publisher.slug': searchRegex },
          { 'category.name': searchRegex },
          { 'category.nameEn': searchRegex },
          { 'category.slug': searchRegex },
          { 'subCategory.name': searchRegex },
          { 'subCategory.nameEn': searchRegex },
          { translatorName: searchRegex },
          { translatorNameEn: searchRegex },
          { 'translator.name': searchRegex },
          { 'translator.nameEn': searchRegex },
          { 'translator.slug': searchRegex },
          { 'editor.name': searchRegex },
          { 'editor.nameEn': searchRegex },
          { editorName: searchRegex },
          { editorNameEn: searchRegex },
          { 'tags.name': searchRegex },
          { 'tags.nameEn': searchRegex },
        ];

        if (multiWordRegex) {
          orConditions.push({ name: multiWordRegex });
          orConditions.push({ nameEn: multiWordRegex });
          orConditions.push({ 'author.name': multiWordRegex });
          orConditions.push({ 'author.nameEn': multiWordRegex });
        }

        mFilter = {
          $and: [
            mFilter,
            {
              $or: orConditions,
            },
          ],
        };
      }
    }
    // Sort
    if (sort) {
      mSort = sort;
    } else {
      mSort = { createdAt: -1 };
    }

    // Select
    if (select) {
      mSelect = { ...select };
    } else {
      mSelect = { name: 1 };
    }

    // GROUPING FOR FILTER PRODUCTS
    let groupCategory;
    let groupBrand;
    let groupSubCategory;
    let groupPublisher;

    if (filterGroup && filterGroup.isGroup) {
      if (filterGroup.category) {
        groupCategory = {
          $group: {
            _id: { category: '$category._id' },
            name: { $first: '$category.name' },
            slug: { $first: '$category.slug' },
            total: { $sum: 1 },
          },
        };
      }

      if (filterGroup.brand) {
        groupBrand = {
          $group: {
            _id: { brand: '$brand._id' },
            name: { $first: '$brand.name' },
            slug: { $first: '$brand.slug' },
            total: { $sum: 1 },
          },
        };
      }

      if (filterGroup.subCategory) {
        groupSubCategory = {
          $group: {
            _id: { subCategory: '$subCategory._id' },
            name: { $first: '$subCategory.name' },
            slug: { $first: '$subCategory.slug' },
            total: { $sum: 1 },
          },
        };
      }

      if (filterGroup.publisher) {
        groupPublisher = {
          $group: {
            _id: { publisher: '$publisher._id' },
            name: { $first: '$publisher.name' },
            slug: { $first: '$publisher.slug' },
            total: { $sum: 1 },
          },
        };
      }
    }

    // Finalize
    if (Object.keys(mFilter).length) {
      // Main
      aggregateStages.push({ $match: mFilter });

      // Category Groups
      if (groupCategory) {
        // aggregateCategoryGroupStages.push({ $match: mFilter });
        aggregateCategoryGroupStages.push(groupCategory);
      }

      // Sub Category Groups
      if (groupSubCategory) {
        // aggregateSubCategoryGroupStages.push({ $match: mFilter });
        aggregateSubCategoryGroupStages.push(groupSubCategory);
      }

      // Brand Groups
      if (groupBrand) {
        // aggregateBrandGroupStages.push({ $match: mFilter });
        aggregateBrandGroupStages.push(groupBrand);
      }
      // Publisher Groups
      if (groupPublisher) {
        // aggregatePublisherGroupStages.push({ $match: mFilter });
        aggregatePublisherGroupStages.push(groupPublisher);
      }
    } else {
      if (groupCategory) {
        aggregateCategoryGroupStages.push(groupCategory);
      }
      if (groupSubCategory) {
        aggregateSubCategoryGroupStages.push(groupSubCategory);
      }
      if (groupBrand) {
        aggregateBrandGroupStages.push(groupBrand);
      }
      if (groupPublisher) {
        aggregatePublisherGroupStages.push(groupPublisher);
      }
    }

    if (Object.keys(mSort).length) {
      aggregateStages.push({ $sort: mSort });
    }

    if (!pagination) {
      aggregateStages.push({ $project: mSelect });
    }

    // Pagination
    if (pagination) {
      if (Object.keys(mSelect).length) {
        mPagination = {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              {
                $skip: pagination.pageSize * pagination.currentPage,
              } /* IF PAGE START FROM 0 OR (pagination.currentPage - 1) IF PAGE 1*/,
              { $limit: pagination.pageSize },
              { $project: mSelect },
            ],
          },
        };
      } else {
        mPagination = {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              {
                $skip: pagination.pageSize * pagination.currentPage,
              } /* IF PAGE START FROM 0 OR (pagination.currentPage - 1) IF PAGE 1*/,
              { $limit: pagination.pageSize },
            ],
          },
        };
      }

      aggregateStages.push(mPagination);

      aggregateStages.push({
        $project: {
          data: 1,
          count: { $arrayElemAt: ['$metadata.total', 0] },
        },
      });
    }

    try {
      // Main
      const dataAggregates = await this.productModel.aggregate(aggregateStages);

      // GROUP FILTER PRODUCTS DATA
      let categoryAggregates;
      let subCategoryAggregates;
      let brandAggregates;
      let publisherAggregates;
      // Category
      if (filterGroup && filterGroup.isGroup && filterGroup.category) {
        categoryAggregates = await this.productModel.aggregate(
          aggregateCategoryGroupStages,
        );
      }

      // Sub Category
      if (filterGroup && filterGroup.isGroup && filterGroup.subCategory) {
        subCategoryAggregates = await this.productModel.aggregate(
          aggregateSubCategoryGroupStages,
        );
      }

      // Brand
      if (filterGroup && filterGroup.isGroup && filterGroup.brand) {
        brandAggregates = await this.productModel.aggregate(
          aggregateBrandGroupStages,
        );
      }

      // Publisher
      if (filterGroup && filterGroup.isGroup && filterGroup.publisher) {
        publisherAggregates = await this.productModel.aggregate(
          aggregatePublisherGroupStages,
        );
      }

      // Main Filter Data
      let allFilterGroups;
      if (filterGroup && filterGroup.isGroup) {
        allFilterGroups = {
          categories:
            categoryAggregates && categoryAggregates.length
              ? categoryAggregates
              : [],
          subCategories:
            subCategoryAggregates && subCategoryAggregates.length
              ? subCategoryAggregates
              : [],
          brands:
            brandAggregates && brandAggregates.length ? brandAggregates : [],
          publishers:
            publisherAggregates && publisherAggregates.length
              ? publisherAggregates
              : [],
        };
      } else {
        allFilterGroups = null;
      }

      if (pagination) {
        if (
          pagination.currentPage < 1 &&
          filter == null &&
          !callerAdmin &&
          JSON.stringify(sort) == JSON.stringify({ createdAt: -1 })
        ) {
          await this.cacheManager.set(
            this.cacheProductPage,
            dataAggregates[0].data,
          );
          await this.cacheManager.set(
            this.cacheProductCount,
            dataAggregates[0].count,
          );
          this.logger.log('Cache Added');
        }

        return {
          ...{ ...dataAggregates[0] },
          ...{
            success: true,
            message: 'Success',
            filterGroup: allFilterGroups,
          },
        } as ResponsePayload;
      } else {
        return {
          data: dataAggregates,
          success: true,
          message: 'Success',
          count: dataAggregates.length,
          filterGroup: allFilterGroups,
        } as ResponsePayload;
      }
    } catch (err) {
      // console.log('errr>>>>', err);
      this.logger.error(err);
      if (err.code && err.code.toString() === ErrorCodes.PROJECTION_MISMATCH) {
        throw new BadRequestException('Error! Projection mismatch');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async getProductById(id: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.productModel
        .findById(id)
        .select(select)
        .populate('tags');

      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateSpecificProduct(
    productId: string,
  ): Promise<{ updated: boolean }> {
    // Define the specific updates
    const updates = {
      ratingCount: 5, // New value for ratingCount
      ratingTotal: 1, // New value for ratingTotal
      reviewTotal: 1, // New value for reviewTotal
    };
    // Update the product by ID
    const result = await this.productModel.findByIdAndUpdate(
      productId,
      updates,
    );

    // Check if the product was found and updated
    if (!result) {
      throw new Error(`Product with ID ${productId} not found or not updated`);
    }

    return { updated: true };
  }

  async getProductBySlug(
    slug: string,
    select: string,
  ): Promise<ResponsePayload> {
    try {
      let data;
      let productById;
      // console.log('slug', slug);
      // const data = await this.productModel
      //   .findOne({ slug: slug })
      //   .select(select)
      //   .populate('tags');

      // Check if the slug is a valid MongoDB ObjectId
      if (Types.ObjectId.isValid(slug)) {
        // If it's an ObjectId, search by _id
        productById = await this.productModel
          .findById(slug)
          .select(select)
          .populate('tags');
      } else {
        // Otherwise, search by slug
        data = await this.productModel
          .findOne({ slug: slug })
          .select(select)
          .populate('tags');
      }
      let fShopInfo;
      if (!productById && !data) {
        // const url = `https://www.banglabazarbooks.com/product-details/${slug}`;
        fShopInfo = await this.redirectUrlModel.findOne({
          $or: [
            { fromUrl: slug },
            { fromUrl: `/${slug}` },
            { fromUrl: `product-details/${slug}` },
            { fromUrl: `/product-details/${slug}` },
            { fromUrl: new RegExp(slug + '$', 'i') }
          ]
        });
      }
      // console.log('fShopInfo',slug);
      // console.log('fShopInfo',fShopInfo);
      // Check if the found product needs redirection
      if (productById) {
        return {
          success: false,
          message: 'Redirect',
          redirectTo: `/product-details/${productById?.slug}`,
        };
      }

      if (!data && !productById) {
        if (fShopInfo?.toUrl) {
          return {
            success: false,
            message: 'Redirect',
            redirectTo: fShopInfo?.toUrl,
          };
        } else {
          return {
            success: false,
            message: 'Product not found',
            redirectTo: `/product-list`,
          };
        }
      }

      // this.updateSpecificProduct('65db41b467e6bde2558cf9a2');
      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }


  async getProductByIds(
    getProductByIdsDto: GetProductByIdsDto,
    select: string,
  ): Promise<ResponsePayload> {
    try {
      const mIds = getProductByIdsDto.ids.map((m) => new ObjectId(m));
      const data = await this.productModel.find({ _id: { $in: mIds } });
      // .select(select ? select : '');
      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * updateProductById
   * updateMultipleProductById
   */
  async updateProductById(
    id: string,
    updateProductDto: UpdateProductDto,
    admin?: Admin,
  ): Promise<ResponsePayload> {
    const { nameEn } = updateProductDto;
    let data;
    try {
      data = await this.productModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }

    const isPublisher = admin?.role === AdminRoles.PUBLISHER;
    if (isPublisher) {
      if (
        !admin.publisher?._id ||
        data.publisher?._id?.toString() !== admin.publisher._id.toString()
      ) {
        throw new UnauthorizedException(
          'You can only edit books belonging to your publication.',
        );
      }
    }

    try {
      const finalData: any = this.syncPdfFields({ ...updateProductDto });

      let isPricePending = false;
      if (isPublisher) {
        // Publishers cannot directly publish or change approvalStatus or reassign publisher
        delete finalData.status;
        delete finalData.approvalStatus;
        delete finalData.publisher;

        // Check if price is changed on an approved / published product
        const isLive = data.status === 'publish' || data.approvalStatus === 'approved';
        const hasPriceChange =
          (updateProductDto.regularPrice !== undefined &&
            updateProductDto.regularPrice !== data.regularPrice) ||
          (updateProductDto.salePrice !== undefined &&
            updateProductDto.salePrice !== data.salePrice) ||
          (updateProductDto.costPrice !== undefined &&
            updateProductDto.costPrice !== data.costPrice);

        if (isLive && hasPriceChange) {
          // Do NOT update live prices directly
          delete finalData.regularPrice;
          delete finalData.salePrice;
          delete finalData.costPrice;

          finalData.pendingPriceUpdate = {
            regularPrice:
              updateProductDto.regularPrice !== undefined
                ? updateProductDto.regularPrice
                : data.regularPrice,
            salePrice:
              updateProductDto.salePrice !== undefined
                ? updateProductDto.salePrice
                : data.salePrice,
            costPrice:
              updateProductDto.costPrice !== undefined
                ? updateProductDto.costPrice
                : data.costPrice,
            requestedAt: new Date(),
            status: 'pending',
          };
          isPricePending = true;
        }
      }

      // Check Slug
      if (nameEn && data.nameEn !== nameEn) {
        finalData.slug = this.utilsService.transformToSlug(nameEn, true);
        finalData.quantity = finalData.quantity ? finalData.quantity : 0;
      }
      const requestedSlug = finalData.slug || updateProductDto.slug;
      if (requestedSlug) {
        let baseSlug = requestedSlug;
        let currentSlug = baseSlug;
        let existingSlug = await this.productModel.findOne({ slug: currentSlug, _id: { $ne: id } });
        
        if (existingSlug) {
          const pubSlug = finalData.publisher?.slug || data.publisher?.slug;
          if (pubSlug) {
            baseSlug = `${requestedSlug}-${pubSlug}`;
            currentSlug = baseSlug;
            existingSlug = await this.productModel.findOne({ slug: currentSlug, _id: { $ne: id } });
          }
        }

        let counter = 1;
        while (existingSlug) {
          currentSlug = `${baseSlug}-${counter}`;
          existingSlug = await this.productModel.findOne({ slug: currentSlug, _id: { $ne: id } });
          counter++;
        }
        finalData.slug = currentSlug;
      }

      const previousPdfUrl = this.getPdfUrl(data);
      const nextPdfUrl = this.getPdfUrl(finalData) || previousPdfUrl;

      await this.productModel.findByIdAndUpdate(id, {
        $set: finalData,
      });

      if (
        nextPdfUrl &&
        (nextPdfUrl !== previousPdfUrl || !data.previewImages?.length)
      ) {
        this.queuePreviewGeneration(id, nextPdfUrl, 0);
      }

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      const message = isPricePending
        ? 'Price update requested and submitted for Admin approval.'
        : 'Success';

      return {
        success: true,
        message,
      } as ResponsePayload;
    } catch (err) {
      if (err.code && err.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        let field = 'Field';
        if (err.keyValue) {
           field = Object.keys(err.keyValue)[0];
        }
        throw new ConflictException(`${field} Must be Unique`);
      } else {
        throw new InternalServerErrorException(err?.message || err);
      }
    }
  }

  async bulkAddTagsToProducts(
    ids: string[],
    tagIds: string[],
  ): Promise<ResponsePayload> {
    if (!Array.isArray(ids) || !ids.length) {
      throw new BadRequestException('ids array is required');
    }
    if (!Array.isArray(tagIds) || !tagIds.length) {
      throw new BadRequestException('tagIds array is required');
    }

    const tags = await this.tagModel
      .find({ _id: { $in: tagIds.map((id) => new ObjectId(id)) } })
      .select('_id name slug')
      .lean();

    if (!tags.length) {
      throw new NotFoundException('No tags found');
    }

    const tagPayload = tags.map((tag) => ({
      _id: tag._id,
      name: tag.name,
      slug: tag.slug,
    }));

    const products = await this.productModel
      .find({ _id: { $in: ids.map((id) => new ObjectId(id)) } })
      .select('_id tags');

    let updated = 0;
    for (const product of products) {
      const existing = Array.isArray(product.tags) ? product.tags : [];
      const merged: any[] = [...existing];

      for (const tag of tagPayload) {
        const exists = merged.some(
          (item) => String(item?._id) === String(tag._id),
        );
        if (!exists) {
          merged.push(tag);
        }
      }

      if (merged.length !== existing.length) {
        await this.productModel.updateOne(
          { _id: product._id },
          { $set: { tags: merged } },
        );
        updated++;
      }
    }

    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);

    return {
      success: true,
      message: `Tags applied to ${updated} product(s)`,
      data: { updated, tags: tagPayload },
    } as ResponsePayload;
  }

  async updateMultipleProductById(
    ids: string[],
    updateProductDto: UpdateProductDto,
  ): Promise<ResponsePayload> {
    const mIds = ids.map((m) => new ObjectId(m));

    // Delete No Multiple Action Data
    if (updateProductDto.slug) {
      delete updateProductDto.slug;
    }
    if (updateProductDto.ids) {
      delete updateProductDto.ids;
    }

    try {
      await this.productModel.updateMany(
        { _id: { $in: mIds } },
        { $set: updateProductDto },
      );

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * deleteProductById
   * deleteMultipleProductById
   */
  async deleteProductById(id: string): Promise<ResponsePayload> {
    let data;
    try {
      data = await this.productModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }
    try {
      await this.productModel.findByIdAndDelete(id);

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      return {
        success: true,
        message: 'Success Delete',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async deleteMultipleProductById(ids: string[]): Promise<ResponsePayload> {
    try {
      await this.productModel.deleteMany({ _id: ids });

      // Cache Removed
      await this.cacheManager.del(this.cacheProductPage);
      await this.cacheManager.del(this.cacheProductCount);
      this.logger.log('Cache Removed');

      return {
        success: true,
        message: 'Success Delete',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async setProductQtyNotNull(): Promise<ResponsePayload> {
    try {
      const data1 = await this.productModel.countDocuments({});

      const data2 = await this.productModel.countDocuments({
        quantity: { $exists: true },
      });

      const data3 = await this.productModel.countDocuments({
        quantity: { $exists: false },
      });

      const data4 = await this.productModel.countDocuments({
        quantity: { $eq: null },
      });

      await this.productModel.updateMany(
        { quantity: { $eq: null } },
        {
          $set: { quantity: 0 },
        },
      );

      return {
        success: true,
        message: 'Success',
        data: {
          all: data1,
          exists: data2,
          existsNot: data3,
          nullData: data4,
        },
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async setProductImageHttpToHttps(): Promise<ResponsePayload> {
    try {
      const data1 = await this.productModel.find({});

      const mData1 = JSON.parse(JSON.stringify(data1));

      for (const product of mData1) {
        if (product.images && product.images.length) {
          const mImages = product.images.map((m) => {
            return m.replace('http://', 'https://');
          });
          await this.productModel.findByIdAndUpdate(product._id, {
            $set: {
              images: mImages,
            },
          });
        }
      }

      return {
        success: true,
        message: 'Success',
        data: null,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async getRelatedProductsByMultiCategoryId(dto: {
    ids: string[];
    limit: number;
  }): Promise<ResponsePayload> {
    try {
      // console.log('dto', dto);
      const mIds = dto.ids.map((m) => new ObjectId(m));

      const data = await this.productModel.aggregate([
        {
          $match: { 'category._id': { $in: mIds } },
        },
        { $sample: { size: dto.limit } },
        {
          $project: {
            name: 1,
            nameEn: 1,
            slug: 1,
            images: 1,
            salePrice: 1,
            quantity: 1,
            author: 1,
            discountAmount: 1,
            discountType: 1,
          },
        },
      ]);

      // const data = await this.productModel.find({ 'category._id': { $in: mIds }}).limit(dto.limit).select('name slug')

      return {
        success: true,
        message: 'Success',
        data: data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async findAllPublished(): Promise<Product[]> {
    return this.productModel.find({ status: 'publish' }).select('slug updatedAt').exec();
  }

  async approveProduct(id: string): Promise<ResponsePayload> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.productModel.findByIdAndUpdate(id, {
      $set: {
        approvalStatus: 'approved',
        status: 'publish',
      },
    });
    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);
    return {
      success: true,
      message: 'Product approved and published successfully.',
    } as ResponsePayload;
  }

  async rejectProduct(id: string, reason?: string): Promise<ResponsePayload> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.productModel.findByIdAndUpdate(id, {
      $set: {
        approvalStatus: 'rejected',
        status: 'draft',
      },
    });
    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);
    return {
      success: true,
      message: 'Product approval rejected.',
    } as ResponsePayload;
  }

  async approvePriceUpdate(id: string): Promise<ResponsePayload> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (
      !product.pendingPriceUpdate ||
      product.pendingPriceUpdate.status !== 'pending'
    ) {
      throw new BadRequestException(
        'No pending price update found for this product.',
      );
    }

    const updates: Record<string, any> = {
      regularPrice: product.pendingPriceUpdate.regularPrice,
      salePrice: product.pendingPriceUpdate.salePrice,
      pendingPriceUpdate: null,
    };
    if (product.pendingPriceUpdate.costPrice !== undefined) {
      updates.costPrice = product.pendingPriceUpdate.costPrice;
    }

    await this.productModel.findByIdAndUpdate(id, {
      $set: updates,
    });
    await this.cacheManager.del(this.cacheProductPage);
    await this.cacheManager.del(this.cacheProductCount);
    return {
      success: true,
      message: 'Price update approved and applied successfully.',
    } as ResponsePayload;
  }

  async rejectPriceUpdate(id: string): Promise<ResponsePayload> {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    await this.productModel.findByIdAndUpdate(id, {
      $set: {
        pendingPriceUpdate: null,
      },
    });
    return {
      success: true,
      message: 'Price update request rejected.',
    } as ResponsePayload;
  }

  async getPendingApprovals(
    filterProductDto: FilterAndPaginationProductDto,
    req?: any,
  ): Promise<ResponsePayload> {
    const callerAdmin = this.getAdminFromRequest(req);
    const query: Record<string, any> = {
      $or: [
        { approvalStatus: 'pending' },
        { 'pendingPriceUpdate.status': 'pending' },
      ],
    };

    if (callerAdmin?.role === AdminRoles.PUBLISHER && callerAdmin?.publisher?._id) {
      const pubId = callerAdmin.publisher._id;
      const pubObjId = ObjectId.isValid(pubId) ? new ObjectId(pubId) : null;
      query['publisher._id'] = pubObjId
        ? { $in: [pubObjId, pubId.toString()] }
        : pubId;
    }

    const pagination = filterProductDto?.pagination;
    const pageSize = pagination?.pageSize || 20;
    const currentPage = pagination?.currentPage || 0;

    const data = await this.productModel
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(pageSize * currentPage)
      .limit(pageSize);

    const count = await this.productModel.countDocuments(query);

    return {
      success: true,
      data,
      count,
      message: 'Success',
    } as ResponsePayload;
  }
}
