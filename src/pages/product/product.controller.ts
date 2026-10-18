import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminMetaRoles } from '../../decorator/admin-roles.decorator';
import { AdminRoles } from '../../enum/admin-roles.enum';
import { AdminRolesGuard } from '../../guards/admin-roles.guard';
import { AdminMetaPermissions } from '../../decorator/admin-permissions.decorator';
import { AdminPermissions } from '../../enum/admin-permission.enum';
import { AdminPermissionGuard } from '../../guards/admin-permission.guard';
import { AdminJwtAuthGuard } from '../../guards/admin-jwt-auth.guard';
import { GetAdmin } from '../../decorator/get-admin.decorator';
import { Admin } from '../../interfaces/admin/admin.interface';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { ProductService } from './product.service';
import {
  AddProductDto,
  BulkAddTagsDto,
  FilterAndPaginationProductDto,
  GetProductByIdsDto,
  OptionProductDto,
  UpdateProductDto,
} from '../../dto/product.dto';

import { MongoIdValidationPipe } from '../../pipes/mongo-id-validation.pipe';

@Controller('product')
export class ProductController {
  private logger = new Logger(ProductController.name);

  constructor(private productService: ProductService) {}

  @Get('/get-all-data')
  @UsePipes(ValidationPipe)
  async getAllProductForUi(
    @Query() query: Record<string, any>,
  ): Promise<ResponsePayload> {
    return await this.productService.getAllProductForUi(query);
  }

  /**
   * addProduct
   * insertManyProduct
   */
  @Post('/add')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(
    AdminRoles.SUPER_ADMIN,
    AdminRoles.ADMIN,
    AdminRoles.EDITOR,
    AdminRoles.PUBLISHER,
  )
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async addProduct(
    @Body()
    addProductDto: AddProductDto,
    @GetAdmin() admin: Admin,
  ): Promise<ResponsePayload> {
    return await this.productService.addProduct(addProductDto, admin);
  }

  @Post('/clone')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async cloneSingleProduct(
    @Body('id')
    id: string,
  ): Promise<ResponsePayload> {
    return await this.productService.cloneSingleProduct(id);
  }

  @Post('/insert-many')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async insertManyProduct(
    @Body()
    body: {
      data: AddProductDto[];
      option: OptionProductDto;
    },
  ): Promise<ResponsePayload> {
    return await this.productService.insertManyProduct(body.data, body.option);
  }

  @Post('/bulk-import')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async bulkImportProducts(
    @Body('rows') rows: Record<string, any>[],
    @Body('overwrite') overwrite: boolean,
  ): Promise<ResponsePayload> {
    return await this.productService.bulkImportProducts(rows, overwrite === true);
  }

  /**
   * getAllProducts
   * getProductById
   */
  @Version(VERSION_NEUTRAL)
  @Post('/get-all')
  @UsePipes(ValidationPipe)
  async getAllProducts(
    @Body() filterProductDto: FilterAndPaginationProductDto,
    @Query('q') searchString: string,
    @Req() req: Request,
  ): Promise<ResponsePayload> {
    return this.productService.getAllProducts(filterProductDto, searchString, req);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/get-products-by-ids')
  async getProductByIds(
    @Body() getProductByIdsDto: GetProductByIdsDto,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.productService.getProductByIds(
      getProductByIdsDto,
      select,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('/get-related-products-by-category-ids')
  async getRelatedProductsByMultiCategoryId(
    @Body() body: { ids: string[]; limit: number },
  ): Promise<ResponsePayload> {
    // console.log('body', body);
    return await this.productService.getRelatedProductsByMultiCategoryId(body);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/:id')
  async getProductById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.productService.getProductById(id, select);
  }


  // @Version(VERSION_NEUTRAL)
  // @Get('/get-by-slug/:slug')
  // async getProductBySlug(
  //   @Param('slug') slug: string,
  //   @Query() select: string,
  // ): Promise<ResponsePayload> {
  //   return await this.productService.getProductBySlug(slug, select);
  // }

  @Version(VERSION_NEUTRAL)
  @Get('/get-by-slug/:slug')
  async getProductBySlug(
    @Param('slug') slug: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.productService.getProductBySlug(slug, select);
  }

  /**
   * updateProductById
   * updateMultipleProductById
   */
  @Version(VERSION_NEUTRAL)
  @Put('/update/:id')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(
    AdminRoles.SUPER_ADMIN,
    AdminRoles.ADMIN,
    AdminRoles.EDITOR,
    AdminRoles.PUBLISHER,
  )
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async updateProductById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
    @GetAdmin() admin: Admin,
  ): Promise<ResponsePayload> {
    return await this.productService.updateProductById(
      id,
      updateProductDto,
      admin,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update-multiple')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async updateMultipleProductById(
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ResponsePayload> {
    return await this.productService.updateMultipleProductById(
      updateProductDto.ids,
      updateProductDto,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('/bulk-add-tags')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async bulkAddTagsToProducts(
    @Body() body: BulkAddTagsDto,
  ): Promise<ResponsePayload> {
    return await this.productService.bulkAddTagsToProducts(body.ids, body.tagIds);
  }

  /**
   * deleteProductById
   * deleteMultipleProductById
   */
  @Version(VERSION_NEUTRAL)
  @Delete('/delete/:id')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.DELETE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async deleteProductById(
    @Param('id', MongoIdValidationPipe) id: string,
  ): Promise<ResponsePayload> {
    return await this.productService.deleteProductById(id);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/delete-multiple')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.DELETE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async deleteMultipleProductById(
    @Body() data: { ids: string[] },
  ): Promise<ResponsePayload> {
    return await this.productService.deleteMultipleProductById(data.ids);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/set-product-not-null')
  async setProductQtyNotNull(): Promise<ResponsePayload> {
    return await this.productService.setProductQtyNotNull();
  }

  @Version(VERSION_NEUTRAL)
  @Post('/set-product-image-https')
  async setProductImageHttpToHttps(): Promise<ResponsePayload> {
    return await this.productService.setProductImageHttpToHttps();
  }

  @Version(VERSION_NEUTRAL)
  @Post('/generate-all-book-previews')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async generateAllBookPreviews(
    @Body() body: { onlyMissing?: boolean },
  ): Promise<ResponsePayload> {
    return await this.productService.generateAllBookPreviews(
      body?.onlyMissing !== false,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Post('/regenerate-all-book-previews')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async regenerateAllBookPreviews(): Promise<ResponsePayload> {
    return await this.productService.regenerateAllBookPreviews();
  }

  @Version(VERSION_NEUTRAL)
  @Post('/fix-preview-image-urls')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async fixPreviewImageUrls(): Promise<ResponsePayload> {
    return await this.productService.fixPreviewImageUrls();
  }

  @Version(VERSION_NEUTRAL)
  @Put('/approve-product/:id')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async approveProduct(
    @Param('id', MongoIdValidationPipe) id: string,
  ): Promise<ResponsePayload> {
    return await this.productService.approveProduct(id);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/reject-product/:id')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async rejectProduct(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body('reason') reason?: string,
  ): Promise<ResponsePayload> {
    return await this.productService.rejectProduct(id, reason);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/approve-price/:id')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async approvePriceUpdate(
    @Param('id', MongoIdValidationPipe) id: string,
  ): Promise<ResponsePayload> {
    return await this.productService.approvePriceUpdate(id);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/reject-price/:id')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async rejectPriceUpdate(
    @Param('id', MongoIdValidationPipe) id: string,
  ): Promise<ResponsePayload> {
    return await this.productService.rejectPriceUpdate(id);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/pending-approvals')
  @AdminMetaRoles(
    AdminRoles.SUPER_ADMIN,
    AdminRoles.ADMIN,
    AdminRoles.EDITOR,
    AdminRoles.PUBLISHER,
  )
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async getPendingApprovals(
    @Body() filterProductDto: FilterAndPaginationProductDto,
    @Req() req: Request,
  ): Promise<ResponsePayload> {
    return await this.productService.getPendingApprovals(filterProductDto, req);
  }
}
