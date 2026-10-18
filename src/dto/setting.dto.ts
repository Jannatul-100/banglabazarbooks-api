import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsDto {
  @IsOptional()
  @IsString()
  tagManagerId: string;

  @IsOptional()
  @IsString()
  facebookPixelId: string;

  @IsOptional()
  @IsString()
  facebookPixelAccessToken: string;

  @IsOptional()
  @IsBoolean()
  IsManageFbPixelByTagManager: boolean;

  @IsOptional()
  @IsBoolean()
  isEnablePixelTestEvent: boolean;

  @IsOptional()
  @IsString()
  facebookPixelTestEventId: string;

  @IsOptional()
  @IsString()
  tiktokPixelId: string;

  @IsOptional()
  @IsString()
  tiktokAccessToken: string;

  @IsOptional()
  @IsString()
  tiktokTestEventCode: string;

  @IsOptional()
  @IsBoolean()
  isPurchaseEventOnConfirm: boolean;
}

export class CourierMethodDto {
  @IsOptional()
  @IsString()
  providerName: string;

  @IsOptional()
  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  secretKey: string;

  @IsOptional()
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  storeId: string;

  @IsOptional()
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  specialInstruction: string;
}

export class FraudCheckDto {
  @IsOptional()
  @IsString()
  apiKey: string;

  @IsOptional()
  @IsString()
  apiType: string;
}

export class FacebookCatalogDto {
  @IsOptional()
  @IsBoolean()
  isEnableFacebookCatalog: boolean;
}

export class AddSettingDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AnalyticsDto)
  analytics: AnalyticsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourierMethodDto)
  courierMethods: CourierMethodDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FraudCheckDto)
  fraudCheck: FraudCheckDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FacebookCatalogDto)
  facebookCatalog: FacebookCatalogDto;
}

export class UpdateSettingDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AnalyticsDto)
  analytics: AnalyticsDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourierMethodDto)
  courierMethods: CourierMethodDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FraudCheckDto)
  fraudCheck: FraudCheckDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FacebookCatalogDto)
  facebookCatalog: FacebookCatalogDto;
}
