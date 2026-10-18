import {
  IsArray,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';

const toOptionalNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

export class AddLandingPageDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  brandTagline?: string;

  @IsOptional()
  @IsString()
  badgeText?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  titleHighlight?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  heroImage?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  featuresTitle?: string;

  @IsOptional()
  @IsArray()
  features?: any[];

  @IsOptional()
  @IsString()
  featuresContent?: string;

  @IsOptional()
  @IsArray()
  heroPoints?: string[];

  @IsOptional()
  @IsString()
  resourceCardTitle?: string;

  @IsOptional()
  @IsString()
  resourceCardSubtitle?: string;

  @IsOptional()
  @IsString()
  leadFormTitle?: string;

  @IsOptional()
  @IsString()
  leadFormSubtitle?: string;

  @IsOptional()
  @IsString()
  leadFormNote?: string;

  @IsOptional()
  @IsString()
  leadFormButtonText?: string;

  @IsOptional()
  @IsArray()
  leadFormTrustItems?: any[];

  @IsOptional()
  @IsString()
  benefitsTitle?: string;

  @IsOptional()
  @IsArray()
  benefitCards?: any[];

  @IsOptional()
  @IsArray()
  headerBadges?: string[];

  @IsOptional()
  @IsArray()
  footerStats?: any[];

  @IsOptional()
  @IsString()
  downloadFileUrl?: string;

  @IsOptional()
  @IsString()
  insidePagesTitle?: string;

  @IsOptional()
  @IsArray()
  insidePages?: string[];

  @IsOptional()
  @IsArray()
  trustItems?: any[];

  @IsOptional()
  @IsString()
  productSectionTitle?: string;

  @IsOptional()
  @IsString()
  productSectionSubtitle?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  salePrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  originalPrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  discountPercent?: number;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsArray()
  products?: string[];

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber()
  priority?: number;
}

export class UpdateLandingPageDto extends AddLandingPageDto {}

export class FilterLandingPageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class FilterAndPaginationLandingPageDto {
  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterLandingPageDto)
  filter?: FilterLandingPageDto;

  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination?: PaginationDto;

  @IsOptional()
  @IsObject()
  sort?: object;

  @IsOptional()
  @IsObject()
  select?: object;
}

export class SubmitLandingPageLeadDto {
  @IsNotEmpty()
  @IsString()
  slug: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  phoneNo: string;

  @IsNotEmpty()
  @IsString()
  email: string;
}
