import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LandingPageSchema } from '../../schema/landing-page.schema';
import { LandingPageLeadSchema } from '../../schema/landing-page-lead.schema';
import { ProductSchema } from '../../schema/product.schema';
import { LandingPageController } from './landing-page.controller';
import { LandingPageService } from './landing-page.service';
import { UtilsModule } from '../../shared/utils/utils.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'LandingPage', schema: LandingPageSchema },
      { name: 'LandingPageLead', schema: LandingPageLeadSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
    UtilsModule,
  ],
  controllers: [LandingPageController],
  providers: [LandingPageService],
  exports: [LandingPageService],
})
export class LandingPageModule {}
