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
import { Author } from '../../../interfaces/common/author.interface';
import { Product } from '../../../interfaces/common/product.interface';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import { ErrorCodes } from '../../../enum/error-code.enum';
import {
  AddAuthorDto,
  CheckAuthorDto,
  FilterAndPaginationAuthorDto,
  OptionAuthorDto,
  UpdateAuthorDto,
} from '../../../dto/author.dto';
import { User } from '../../../interfaces/user/user.interface';

const ObjectId = Types.ObjectId;

@Injectable()
export class AuthorService {
  private logger = new Logger(AuthorService.name);

  constructor(
    @InjectModel('Author') private readonly authorModel: Model<Author>,
    @InjectModel('Product') private readonly productModel: Model<Product>,
    @InjectModel('User') private readonly userModel: Model<User>,
    private configService: ConfigService,
    private utilsService: UtilsService,
  ) {}

  private containsBengali(value?: string): boolean {
    return /[\u0980-\u09FF]/.test(value || '');
  }

  private resolveAuthorSlugSource(input: {
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

  private buildAuthorSlug(input: {
    slug?: string;
    nameEn?: string;
    name?: string;
  }): string {
    return this.utilsService.transformToSlug(this.resolveAuthorSlugSource(input));
  }

  private resolveAuthorSlugSourceForMigration(author: {
    slug?: string;
    nameEn?: string;
    name?: string;
  }): { source: string; skipReason?: string } {
    if (author.nameEn?.trim()) {
      return { source: author.nameEn.trim() };
    }

    if (author.slug?.trim() && !this.containsBengali(author.slug)) {
      return { source: author.slug.trim() };
    }

    if (author.name?.trim() && !this.containsBengali(author.name)) {
      return { source: author.name.trim() };
    }

    return {
      source: '',
      skipReason: 'Add English name (nameEn) first',
    };
  }

  /**
   * addAuthor
   * insertManyAuthor
   */
  async addAuthor(addAuthorDto: AddAuthorDto): Promise<ResponsePayload> {
    const { name, nameEn, slug } = addAuthorDto;

    try {
      const baseSlug = this.buildAuthorSlug({ slug, nameEn, name });
      let finalSlug = baseSlug;
      const fData = await this.authorModel.findOne({ slug: finalSlug });

      if (fData) {
        finalSlug = this.utilsService.transformToSlug(baseSlug, true);
      }

      const defaultData = {
        slug: finalSlug,
      };
      const mData = { ...addAuthorDto, ...defaultData };
      const newData = new this.authorModel(mData);

      const saveData = await newData.save();
      const data = {
        _id: saveData._id,
      };
      return {
        success: true,
        message: 'Data Added Successfully',
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

  async insertManyAuthor(
    addAuthorsDto: AddAuthorDto[],
    optionAuthorDto: OptionAuthorDto,
  ): Promise<ResponsePayload> {
    const { deleteMany } = optionAuthorDto;
    if (deleteMany) {
      await this.authorModel.deleteMany({});
    }
    const mData = addAuthorsDto.map((m) => {
      return {
        ...m,
        ...{
          slug: this.buildAuthorSlug({
            slug: m.slug,
            nameEn: m.nameEn,
            name: m.name,
          }),
        },
      };
    });
    try {
      const saveData = await this.authorModel.insertMany(mData);
      return {
        success: true,
        message: `${
          saveData && saveData.length ? saveData.length : 0
        }  Data Added Success`,
      } as ResponsePayload;
    } catch (error) {
      // console.log(error);
      if (error.code && error.code.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug Must be Unique');
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  /**
   * getAllAuthors
   * getAuthorById
   */
  async getAllAuthorsBasic() {
    try {
      const pageSize = 10;
      const currentPage = 1;

      const data = await this.authorModel
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

  async getAllAuthors(
    filterAuthorDto: FilterAndPaginationAuthorDto,
    searchQuery?: string,
  ): Promise<ResponsePayload> {
    const { filter } = filterAuthorDto;
    const { pagination } = filterAuthorDto;
    const { sort } = filterAuthorDto;
    const { select } = filterAuthorDto;

    // Essential Variables
    const aggregateSauthores = [];
    let mFilter = {};
    let mSort = {};
    let mSelect = {};
    let mPagination = {};

    // Match
    if (filter) {
      mFilter = { ...mFilter, ...filter };
    }
    if (searchQuery) {
      mFilter = { ...mFilter, ...{ name: new RegExp(searchQuery, 'i') } };
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
      mSelect = {
        name: 1,
      };
    }

    // Finalize
    if (Object.keys(mFilter).length) {
      aggregateSauthores.push({ $match: mFilter });
    }

    if (Object.keys(mSort).length) {
      aggregateSauthores.push({ $sort: mSort });
    }

    if (!pagination) {
      aggregateSauthores.push({ $project: mSelect });
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

      aggregateSauthores.push(mPagination);

      aggregateSauthores.push({
        $project: {
          data: 1,
          count: { $arrayElemAt: ['$metadata.total', 0] },
        },
      });
    }

    try {
      const dataAggregates = await this.authorModel.aggregate(
        aggregateSauthores,
      );
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

  async getAuthorById(id: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.authorModel.findById(id).select(select);
      return {
        success: true,
        message: 'Single author get Successfully',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async getAuthorBySlug(slug: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.findAuthorBySlugCandidates(slug, select);
      return {
        success: true,
        message: 'Single author get Successfully',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  private buildAuthorSlugCandidates(slug: string): string[] {
    const trimmed = slug?.trim();
    if (!trimmed) {
      return [];
    }

    const normalized = this.utilsService.transformToSlug(trimmed);
    const hyphenated = trimmed.replace(/\s+/g, '-').toLowerCase();
    const spaced = trimmed.replace(/-/g, ' ');

    return [...new Set([trimmed, normalized, hyphenated, spaced].filter(Boolean))];
  }

  private async findAuthorBySlugCandidates(slug: string, select?: string) {
    for (const candidate of this.buildAuthorSlugCandidates(slug)) {
      const data = await this.authorModel.findOne({ slug: candidate }).select(select);
      if (data) {
        return data;
      }
    }

    return null;
  }

  /**
   * updateAuthorById
   * updateMultipleAuthorById
   */
  async updateAuthorById(
    id: string,
    updateAuthorDto: UpdateAuthorDto,
  ): Promise<ResponsePayload> {
    try {
      const { name, nameEn, slug } = updateAuthorDto;

      let finalSlug = this.buildAuthorSlug({ slug, nameEn, name });
      const fData = await this.authorModel.findById(id);

      if (fData?.slug !== finalSlug) {
        const duplicate = await this.authorModel.findOne({
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

      const finalData = { ...updateAuthorDto, ...defaultData };

      await this.authorModel.findByIdAndUpdate(id, {
        $set: finalData,
      });

      const productUpdatePayload: any = {};
      if (finalData.name) productUpdatePayload['author.$.name'] = finalData.name;
      if (finalData.slug) productUpdatePayload['author.$.slug'] = finalData.slug;

      if (Object.keys(productUpdatePayload).length > 0) {
        await this.productModel.updateMany(
          { 'author._id': new ObjectId(id) },
          { $set: productUpdatePayload },
        );
      }

      return {
        success: true,
        message: 'Update Successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }

  async updateMultipleAuthorById(
    ids: string[],
    updateAuthorDto: UpdateAuthorDto,
  ): Promise<ResponsePayload> {
    const mIds = ids.map((m) => new ObjectId(m));

    try {
      await this.authorModel.updateMany(
        { _id: { $in: mIds } },
        { $set: updateAuthorDto },
      );

      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * deleteAuthorById
   * deleteMultipleAuthorById
   */
  async deleteAuthorById(
    id: string,
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    let data;
    try {
      data = await this.authorModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }
    try {
      await this.authorModel.findByIdAndDelete(id);
      return {
        success: true,
        message: 'Delete Successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async deleteMultipleAuthorById(
    ids: string[],
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    try {
      const mIds = ids.map((m) => new ObjectId(m));
      await this.authorModel.deleteMany({ _id: ids });
      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * COUPON FUNCTIONS
   * generateOtpWithPhoneNo()
   * validateOtpWithPhoneNo()
   */
  async checkAuthorAvailability(
    user: User,
    checkAuthorDto: CheckAuthorDto,
  ): Promise<ResponsePayload> {
    try {
      const { authorCode, subTotal } = checkAuthorDto;

      const authorData = await this.authorModel.findOne({
        authorCode,
      });

      if (authorData) {
        const isExpired = this.utilsService.getDateDifference(
          new Date(),
          // new Date(authorData.endDateTime),
          'seconds',
        );

        const isStartDate = this.utilsService.getDateDifference(
          new Date(),
          // new Date(authorData.startDateTime),
          'seconds',
        );

        if (isStartDate > 0) {
          return {
            success: false,
            message: 'Sorry! Author offer is not start yet',
            data: null,
          } as ResponsePayload;
        }

        if (isExpired <= 0) {
          return {
            success: false,
            message: 'Sorry! Author Expired',
            data: null,
          } as ResponsePayload;
        } else {
          const userAuthorExists = await this.userModel.findOne({
            _id: user._id,
            usedAuthors: authorData._id,
          });

          if (userAuthorExists) {
            return {
              success: false,
              message: 'Sorry! Author already used in your account.',
              data: null,
            } as ResponsePayload;
          } else {
            if (authorData['minimumAmount'] > subTotal) {
              return {
                success: false,
                message: `Sorry! Author minimum amount is ${authorData['minimumAmount']}`,
                data: null,
              } as ResponsePayload;
            } else {
              return {
                success: true,
                message: 'Success! Author added.',
                data: {
                  _id: authorData._id,
                  discountAmount: authorData['discountAmount'],
                  discountType: authorData['discountType'],
                  authorCode: authorData['authorCode'],
                },
              } as ResponsePayload;
            }
          }
        }
      } else {
        return {
          success: false,
          message: 'Sorry! Invalid author code',
          data: null,
        } as ResponsePayload;
      }
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
  async findAllPublished(): Promise<Author[]> {
    return this.authorModel.find({}).select('slug updatedAt').exec();
  }

  async migrateAllAuthorSlugs(dryRun = false): Promise<ResponsePayload> {
    try {
      const authors = await this.authorModel.find({}).sort({ createdAt: 1 }).lean();
      const usedSlugs = new Map<string, string>();
      const changes: Array<{
        id: string;
        name: string;
        oldSlug: string;
        newSlug: string;
      }> = [];
      const skipped: Array<{
        id: string;
        name: string;
        oldSlug: string;
        reason: string;
      }> = [];

      for (const author of authors) {
        const id = String(author._id);
        const oldSlug = (author.slug || '').trim();
        const { source, skipReason } = this.resolveAuthorSlugSourceForMigration({
          slug: author.slug,
          nameEn: author.nameEn,
          name: author.name,
        });

        if (skipReason) {
          skipped.push({
            id,
            name: author.name || author.nameEn || '',
            oldSlug,
            reason: skipReason,
          });
          if (oldSlug) {
            usedSlugs.set(oldSlug, id);
          }
          continue;
        }

        let baseSlug = this.utilsService.transformToSlug(source);

        if (!baseSlug) {
          baseSlug = `author-${id.slice(-6)}`;
        }

        let newSlug = baseSlug;
        let suffix = 2;
        while (usedSlugs.has(newSlug) && usedSlugs.get(newSlug) !== id) {
          newSlug = `${baseSlug}-${suffix++}`;
        }

        usedSlugs.set(newSlug, id);

        if (oldSlug !== newSlug) {
          changes.push({
            id,
            name: author.nameEn || author.name || '',
            oldSlug,
            newSlug,
          });
        }
      }

      if (dryRun) {
        return {
          success: true,
          message: `Dry run complete: ${changes.length} author slug(s) need update, ${skipped.length} skipped`,
          data: {
            total: authors.length,
            updated: changes.length,
            skipped: skipped.length,
            productsUpdated: 0,
            changes,
            skippedAuthors: skipped,
          },
        } as ResponsePayload;
      }

      let productsUpdated = 0;
      for (const change of changes) {
        await this.authorModel.findByIdAndUpdate(change.id, {
          $set: { slug: change.newSlug },
        });

        const result = await this.productModel.updateMany(
          { 'author._id': new ObjectId(change.id) },
          { $set: { 'author.$[elem].slug': change.newSlug } },
          { arrayFilters: [{ 'elem._id': new ObjectId(change.id) }] },
        );
        productsUpdated += result.modifiedCount || 0;
      }

      return {
        success: true,
        message: `Migrated ${changes.length} author slug(s), skipped ${skipped.length}, updated ${productsUpdated} product(s)`,
        data: {
          total: authors.length,
          updated: changes.length,
          skipped: skipped.length,
          productsUpdated,
          changes,
          skippedAuthors: skipped,
        },
      } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
