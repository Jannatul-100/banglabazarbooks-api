import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { UtilsService } from '../../../shared/utils/utils.service';
import { Translator } from '../../../interfaces/common/translator.interface';
import { Product } from '../../../interfaces/common/product.interface';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import { ErrorCodes } from '../../../enum/error-code.enum';
import {
  AddTranslatorDto,
  FilterAndPaginationTranslatorDto,
  OptionTranslatorDto,
  UpdateTranslatorDto,
} from '../../../dto/translator.dto';

const ObjectId = Types.ObjectId;

@Injectable()
export class TranslatorService {
  private logger = new Logger(TranslatorService.name);

  constructor(
    @InjectModel('Translator') private readonly translatorModel: Model<Translator>,
    @InjectModel('Product') private readonly productModel: Model<Product>,
    private configService: ConfigService,
    private utilsService: UtilsService,
  ) {}

  private containsBengali(value?: string): boolean {
    return /[\u0980-\u09FF]/.test(value || '');
  }

  private resolveTranslatorSlugSource(input: {
    slug?: string;
    nameEn?: string;
    name?: string;
  }): string {
    const nameEn = input.nameEn?.trim();
    const name = input.name?.trim();
    const slug = input.slug?.trim();

    if (nameEn) {
      return nameEn;
    }

    if (slug && !this.containsBengali(slug)) {
      return slug;
    }

    return name || slug || '';
  }

  private buildTranslatorSlug(input: {
    slug?: string;
    nameEn?: string;
    name?: string;
  }): string {
    return this.utilsService.transformToSlug(this.resolveTranslatorSlugSource(input));
  }

  async addTranslator(addTranslatorDto: AddTranslatorDto): Promise<ResponsePayload> {
    const { name, nameEn, slug } = addTranslatorDto;

    try {
      const baseSlug = this.buildTranslatorSlug({ slug, nameEn, name });
      let finalSlug = baseSlug;
      const fData = await this.translatorModel.findOne({ slug: finalSlug });

      if (fData) {
        finalSlug = this.utilsService.transformToSlug(baseSlug, true);
      }

      const defaultData = {
        slug: finalSlug,
      };
      const mData = { ...addTranslatorDto, ...defaultData };
      const newData = new this.translatorModel(mData);

      const saveData = await newData.save();
      const data = {
        _id: saveData._id,
      };
      return {
        success: true,
        message: 'Translator Added Successfully',
        data,
      } as ResponsePayload;
    } catch (error) {
      console.log(error);
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug Must be Unique');
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async insertManyTranslator(
    addTranslatorsDto: AddTranslatorDto[],
    optionTranslatorDto: OptionTranslatorDto,
  ): Promise<ResponsePayload> {
    const { deleteMany } = optionTranslatorDto;
    if (deleteMany) {
      await this.translatorModel.deleteMany({});
    }
    const mData = addTranslatorsDto.map((m) => {
      return {
        ...m,
        ...{
          slug: this.buildTranslatorSlug({
            slug: m.slug,
            nameEn: m.nameEn,
            name: m.name,
          }),
        },
      };
    });
    try {
      const saveData = await this.translatorModel.insertMany(mData);
      return {
        success: true,
        message: `${
          saveData && saveData.length ? saveData.length : 0
        } Data Added Successfully`,
      } as ResponsePayload;
    } catch (error) {
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug Must be Unique');
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async getAllTranslatorsBasic() {
    try {
      const pageSize = 10;
      const currentPage = 1;

      const data = await this.translatorModel
        .find()
        .skip(pageSize * (currentPage - 1))
        .limit(Number(pageSize));
      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async getAllTranslators(
    filterTranslatorDto: FilterAndPaginationTranslatorDto,
    searchQuery?: string,
  ): Promise<ResponsePayload> {
    const { filter, pagination, sort, select } = filterTranslatorDto;

    const aggregateTranslators = [];
    let mFilter: any = {};
    let mSort = {};
    let mSelect = {};
    let mPagination = {};

    if (filter) {
      mFilter = { ...mFilter, ...filter };
    }
    if (searchQuery) {
      mFilter.$or = [
        { name: new RegExp(searchQuery, 'i') },
        { nameEn: new RegExp(searchQuery, 'i') },
      ];
    }

    if (sort) {
      mSort = sort;
    } else {
      mSort = { createdAt: -1 };
    }

    if (select) {
      mSelect = { ...select };
    } else {
      mSelect = {
        name: 1,
        nameEn: 1,
        slug: 1,
        image: 1,
        description: 1,
        priority: 1,
        createdAt: 1,
      };
    }

    if (Object.keys(mFilter).length) {
      aggregateTranslators.push({ $match: mFilter });
    }

    if (Object.keys(mSort).length) {
      aggregateTranslators.push({ $sort: mSort });
    }

    if (!pagination) {
      aggregateTranslators.push({ $project: mSelect });
    } else {
      mPagination = {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            {
              $skip: pagination.pageSize * pagination.currentPage,
            },
            { $limit: pagination.pageSize },
            { $project: mSelect },
          ],
        },
      };

      aggregateTranslators.push(mPagination);

      aggregateTranslators.push({
        $project: {
          data: 1,
          count: { $arrayElemAt: ['$metadata.total', 0] },
        },
      });
    }

    try {
      const dataAggregates = await this.translatorModel.aggregate(aggregateTranslators);
      if (pagination) {
        return {
          ...{ ...dataAggregates[0] },
          ...{ success: true, message: 'Success' },
        } as ResponsePayload;
      } else {
        return {
          data: dataAggregates,
          success: true,
          message: 'Success',
          count: dataAggregates.length,
        } as ResponsePayload;
      }
    } catch (err) {
      this.logger.error(err);
      if (err.code && err.code.toString() === ErrorCodes.PROJECTION_MISMATCH) {
        throw new BadRequestException('Error! Projection mismatch');
      } else {
        throw new InternalServerErrorException(err.message);
      }
    }
  }

  async getTranslatorById(id: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.translatorModel.findById(id).select(select);
      return {
        success: true,
        message: 'Single translator retrieved successfully',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  private buildTranslatorSlugCandidates(slug: string): string[] {
    const trimmed = slug?.trim();
    if (!trimmed) {
      return [];
    }

    const normalized = this.utilsService.transformToSlug(trimmed);
    const hyphenated = trimmed.replace(/\s+/g, '-').toLowerCase();
    const spaced = trimmed.replace(/-/g, ' ');

    return Array.from(
      new Set(
        [
          trimmed,
          normalized,
          hyphenated,
          spaced,
          encodeURIComponent(trimmed),
          decodeURIComponent(trimmed),
        ].filter(Boolean),
      ),
    );
  }

  private async findTranslatorBySlugCandidates(
    slug: string,
    select?: string,
  ): Promise<Translator | null> {
    const candidates = this.buildTranslatorSlugCandidates(slug);

    if (!candidates.length) {
      return null;
    }

    for (const candidate of candidates) {
      const query = this.translatorModel.findOne({ slug: candidate });
      if (select) {
        query.select(select);
      }
      const data = await query.exec();
      if (data) {
        return data;
      }
    }

    const regexCandidates = candidates.map((candidate) =>
      this.utilsService.escapeRegex(candidate),
    );
    const fallbackQuery = this.translatorModel.findOne({
      slug: {
        $in: regexCandidates.map((candidate) => new RegExp(`^${candidate}$`, 'i')),
      },
    });

    if (select) {
      fallbackQuery.select(select);
    }

    return await fallbackQuery.exec();
  }

  async getTranslatorBySlug(slug: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.findTranslatorBySlugCandidates(slug, select);
      return {
        success: true,
        message: 'Single translator retrieved successfully',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateTranslatorById(
    id: string,
    updateTranslatorDto: UpdateTranslatorDto,
  ): Promise<ResponsePayload> {
    try {
      const { name, nameEn, slug } = updateTranslatorDto;

      let finalSlug = this.buildTranslatorSlug({ slug, nameEn, name });
      const fData = await this.translatorModel.findById(id);

      if (fData?.slug !== finalSlug) {
        const duplicate = await this.translatorModel.findOne({
          slug: finalSlug,
          _id: { $ne: id },
        });
        if (duplicate) {
          finalSlug = this.utilsService.transformToSlug(finalSlug, true);
        }
      }

      const defaultData = {
        slug: finalSlug,
      };

      const finalData = { ...updateTranslatorDto, ...defaultData };

      await this.translatorModel.findByIdAndUpdate(id, {
        $set: finalData,
      });

      const productUpdatePayload: any = {};
      if (finalData.name) productUpdatePayload['translator.$.name'] = finalData.name;
      if (finalData.slug) productUpdatePayload['translator.$.slug'] = finalData.slug;

      if (Object.keys(productUpdatePayload).length > 0) {
        await this.productModel.updateMany(
          { 'translator._id': new ObjectId(id) },
          { $set: productUpdatePayload },
        );
      }

      return {
        success: true,
        message: 'Update Successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateMultipleTranslatorById(
    ids: string[],
    updateTranslatorDto: UpdateTranslatorDto,
  ): Promise<ResponsePayload> {
    const mIds = ids.map((m) => new ObjectId(m));

    try {
      await this.translatorModel.updateMany(
        { _id: { $in: mIds } },
        { $set: updateTranslatorDto },
      );

      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async deleteTranslatorById(
    id: string,
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    let data;
    try {
      data = await this.translatorModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }
    try {
      await this.translatorModel.findByIdAndDelete(id);
      return {
        success: true,
        message: 'Delete Successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async deleteMultipleTranslatorById(
    ids: string[],
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    try {
      const mIds = ids.map((m) => new ObjectId(m));
      await this.translatorModel.deleteMany({ _id: { $in: mIds } });
      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }
}
