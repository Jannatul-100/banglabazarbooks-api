import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { SettingSchema } from '../../schema/setting.schema';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { GtmService } from './gtm.service';
import { UtilsModule } from '../../shared/utils/utils.module';

@Module({
  imports: [
    HttpModule,
    UtilsModule,
    MongooseModule.forFeature([
      { name: 'Setting', schema: SettingSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, GtmService],
  exports: [AnalyticsService, GtmService],
})
export class AnalyticsModule {}
