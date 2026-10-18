import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FacebookCatalogController } from './facebook-catalog.controller';
import { FacebookCatalogService } from './facebook-catalog.service';
import { ProductSchema } from '../../schema/product.schema';
import { SettingSchema } from '../../schema/setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Setting', schema: SettingSchema },
    ]),
  ],
  controllers: [FacebookCatalogController],
  providers: [FacebookCatalogService],
  exports: [FacebookCatalogService],
})
export class FacebookCatalogModule {}
