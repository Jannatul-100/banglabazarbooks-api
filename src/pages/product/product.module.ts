import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductSchema } from '../../schema/product.schema';
import { CategorySchema } from '../../schema/category.schema';
import { BrandSchema } from '../../schema/brand.schema';
import { PublisherSchema } from 'src/schema/publisher.schema';
import { SubCategorySchema } from '../../schema/sub-category.schema';
import { AuthorSchema } from '../../schema/author.schema';
import { TagSchema } from '../../schema/tag.schema';
import { ShopInformationSchema } from '../../schema/shop-information.schema';
import { RedirectUrlSchema } from '../../schema/redirect-url.schema';

import { HttpModule } from '@nestjs/axios';
import { PdfPreviewModule } from '../../shared/pdf-preview/pdf-preview.module';

@Module({
  imports: [
    HttpModule,
    PdfPreviewModule,
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Category', schema: CategorySchema },
      { name: 'SubCategory', schema: SubCategorySchema },
      { name: 'Brand', schema: BrandSchema },
      { name: 'Publisher', schema: PublisherSchema },
      { name: 'Author', schema: AuthorSchema },
      { name: 'Tags', schema: TagSchema },
      { name: 'RedirectUrl', schema: RedirectUrlSchema },
      { name: 'ShopInformation', schema: ShopInformationSchema },
    ]),
  ],
  providers: [ProductService],
  controllers: [ProductController],
  exports: [ProductService],
})
export class ProductModule {}
