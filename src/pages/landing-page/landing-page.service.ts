import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UtilsService } from '../../shared/utils/utils.service';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { ErrorCodes } from '../../enum/error-code.enum';
import { LandingPage } from '../../interfaces/common/landing-page.interface';
import { Product } from '../../interfaces/common/product.interface';
import {
  AddLandingPageDto,
  FilterAndPaginationLandingPageDto,
  UpdateLandingPageDto,
} from '../../dto/landing-page.dto';

const ObjectId = Types.ObjectId;

@Injectable()
export class LandingPageService {
  private readonly logger = new Logger(LandingPageService.name);

  constructor(
    @InjectModel('LandingPage')
    private readonly landingPageModel: Model<LandingPage>,
    @InjectModel('LandingPageLead')
    private readonly landingPageLeadModel: Model<any>,
    @InjectModel('Product') private readonly productModel: Model<Product>,
    private readonly utilsService: UtilsService,
  ) {}

  async addLandingPage(
    addLandingPageDto: AddLandingPageDto,
  ): Promise<ResponsePayload> {
    try {
      const productIds = addLandingPageDto.products ?? [];
      const productInfo = await this.buildProductInfo(productIds);
      const slug =
        addLandingPageDto.slug ||
        this.utilsService.transformToSlug(addLandingPageDto.name);

      const newData = new this.landingPageModel({
        ...addLandingPageDto,
        slug,
        products: productIds,
        productInfo,
      });

      const saveData = await newData.save();
      return {
        success: true,
        message: 'Landing page added successfully',
        data: { _id: saveData._id },
      } as ResponsePayload;
    } catch (error) {
      if (error.code?.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug must be unique');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async getAllLandingPages(
    filterDto: FilterAndPaginationLandingPageDto,
    searchQuery?: string,
  ): Promise<ResponsePayload> {
    try {
      const { filter, pagination, sort, select } = filterDto;
      const aggregateStages = [];
      let mFilter: any = {};
      let mSort: any = { priority: -1, createdAt: -1 };
      let mSelect: any = {};

      if (filter) {
        mFilter = { ...mFilter, ...filter };
      }
      if (searchQuery) {
        mFilter = {
          ...mFilter,
          $or: [
            { name: new RegExp(searchQuery, 'i') },
            { slug: new RegExp(searchQuery, 'i') },
            { title: new RegExp(searchQuery, 'i') },
          ],
        };
      }
      if (sort) {
        mSort = sort;
      }
      if (select) {
        mSelect = { ...select };
      }

      if (Object.keys(mFilter).length) {
        aggregateStages.push({ $match: mFilter });
      }
      if (Object.keys(mSort).length) {
        aggregateStages.push({ $sort: mSort });
      }

      if (!pagination) {
        aggregateStages.push({ $project: mSelect });
        const data = await this.landingPageModel.aggregate(aggregateStages);
        return { success: true, message: 'Success', data } as ResponsePayload;
      }

      const mPagination = {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [
            { $skip: pagination.pageSize * pagination.currentPage },
            { $limit: pagination.pageSize },
            { $project: mSelect },
          ],
        },
      };
      aggregateStages.push(mPagination);
      const aggregateData = await this.landingPageModel.aggregate(aggregateStages);
      const data = aggregateData[0];
      return {
        success: true,
        message: 'Success',
        data: data.data,
        count: data.metadata[0]?.total ?? 0,
      } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getLandingPageById(
    id: string,
    select?: string,
  ): Promise<ResponsePayload> {
    try {
      const data = await this.landingPageModel
        .findById(id)
        .populate(
          'products',
          'name nameEn slug images salePrice discountType discountAmount quantity author category',
        )
        .select(select ?? '');
      if (!data) {
        throw new NotFoundException('Landing page not found');
      }
      return { success: true, message: 'Success', data } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async getLandingPageBySlug(
    slug: string,
    select?: string,
  ): Promise<ResponsePayload> {
    try {
      const data = await this.landingPageModel
        .findOne({ slug, status: 'publish' })
        .populate(
          'products',
          'name nameEn slug images salePrice discountType discountAmount offerDiscountType offerDiscountAmount quantity author category subCategory publisher tagline taglineEn currentVersion currentVersionEn',
        )
        .select(select ?? '');
      if (!data) {
        throw new NotFoundException('Landing page not found');
      }
      return { success: true, message: 'Success', data } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async submitLandingPageLead(dto: {
    slug: string;
    name: string;
    phoneNo: string;
    email: string;
  }): Promise<ResponsePayload> {
    try {
      const page = await this.landingPageModel.findOne({
        slug: dto.slug,
        status: 'publish',
        template: 'v2',
      });

      if (!page) {
        throw new NotFoundException('Landing page not found');
      }

      await this.landingPageLeadModel.create({
        landingPage: page._id,
        slug: dto.slug,
        name: dto.name,
        phoneNo: dto.phoneNo,
        email: dto.email,
      });

      return {
        success: true,
        message: 'Lead submitted successfully',
        data: {
          downloadFileUrl: page.downloadFileUrl ?? null,
        },
      } as ResponsePayload;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async updateLandingPageById(
    id: string,
    updateLandingPageDto: UpdateLandingPageDto,
  ): Promise<ResponsePayload> {
    try {
      const productIds = updateLandingPageDto.products ?? [];
      const productInfo = productIds.length
        ? await this.buildProductInfo(productIds)
        : undefined;

      const updateData: any = { ...updateLandingPageDto };
      if (productIds.length) {
        updateData.products = productIds;
        updateData.productInfo = productInfo;
      }

      await this.landingPageModel.findByIdAndUpdate(id, {
        $set: updateData,
      });
      return {
        success: true,
        message: 'Landing page updated successfully',
      } as ResponsePayload;
    } catch (error) {
      if (error.code?.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug must be unique');
      }
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteLandingPageById(id: string): Promise<ResponsePayload> {
    try {
      await this.landingPageModel.findByIdAndDelete(id);
      return {
        success: true,
        message: 'Landing page deleted successfully',
      } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async deleteMultipleLandingPageById(ids: string[]): Promise<ResponsePayload> {
    try {
      await this.landingPageModel.deleteMany({ _id: { $in: ids } });
      return {
        success: true,
        message: 'Landing pages deleted successfully',
      } as ResponsePayload;
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  private async buildProductInfo(productIds: string[]) {
    if (!productIds?.length) {
      return [];
    }

    const products = await this.productModel
      .find({ _id: { $in: productIds.map((id) => new ObjectId(id)) } })
      .select('name nameEn slug images salePrice discountType discountAmount');

    return products.map((product) => ({
      _id: product._id,
      name: product.name,
      nameEn: product.nameEn,
      slug: product.slug,
      images: product.images,
      salePrice: product.salePrice,
      discountType: product.discountType,
      discountAmount: product.discountAmount,
    }));
  }
}
