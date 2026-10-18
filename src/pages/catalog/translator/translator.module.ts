import { Module } from '@nestjs/common';
import { TranslatorService } from './translator.service';
import { TranslatorController } from './translator.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { TranslatorSchema } from '../../../schema/translator.schema';
import { ProductSchema } from '../../../schema/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Translator', schema: TranslatorSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
  ],
  providers: [TranslatorService],
  controllers: [TranslatorController],
  exports: [TranslatorService],
})
export class TranslatorModule {}
