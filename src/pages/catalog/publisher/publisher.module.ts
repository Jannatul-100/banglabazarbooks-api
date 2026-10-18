import { Module } from '@nestjs/common';
import { PublisherService } from './publisher.service';
import { PublisherController } from './publisher.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { PublisherSchema } from '../../../schema/publisher.schema';
import { UserSchema } from '../../../schema/user.schema';
import { ProductSchema } from '../../../schema/product.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Publisher', schema: PublisherSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Product', schema: ProductSchema },
    ]),
  ],
  providers: [PublisherService],
  controllers: [PublisherController],
})
export class PublisherModule {}  
