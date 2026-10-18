import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';
import { OrderStatus } from '../enum/order.enum';

export class AddOrderDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  phoneNo: string;

  @IsOptional()
  @IsString()
  email: string;

  @IsOptional()
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  city: string;

  @IsOptional()
  @IsString()
  paymentType: string;

  @IsNotEmpty()
  @IsString()
  shippingAddress: string;

  @IsOptional()
  division: any;

  @IsOptional()
  area: any;

  @IsOptional()
  zone: any;

  @IsOptional()
  @IsString()
  user: string;

  @IsOptional()
  @IsString()
  coupon: string;

  @IsOptional()
  @IsString()
  processedBy: string;

  @IsOptional()
  @IsNumber()
  orderStatus: number;

  @IsOptional()
  courierData: any;
}

export class CustomerUpdateOrderDto extends AddOrderDto {
  @IsNotEmpty()
  @IsArray()
  orderedItems: any[];
}

export class FilterOrderDto {
  @IsOptional()
  orderStatus: any;

  @IsOptional()
  @IsString()
  paymentStatus: string;

  @IsOptional()
  @IsString()
  paymentType: string;

  @IsOptional()
  @IsString()
  city: string;
}

export class OptionOrderDto {
  @IsOptional()
  @IsBoolean()
  deleteMany: boolean;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  packingImage?: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  phoneNo: string;

  @IsOptional()
  // @IsNotEmpty()
  @IsString()
  city: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  shippingAddress: string;

  @IsOptional()
  division: any;

  @IsOptional()
  area: any;

  @IsOptional()
  zone: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  ids: string[];

  @IsOptional()
  @IsString()
  processedBy: string;

  @IsOptional()
  @IsNumber()
  orderStatus?: number;

  @IsOptional()
  courierData?: any;
}

export class UpdateOrderStatusDto {
  @IsNotEmpty()
  @IsNumber()
  @IsIn([
    OrderStatus.PENDING,
    OrderStatus.CONFIRM,
    OrderStatus.PROCESSING,
    OrderStatus.SHIPPING,
    OrderStatus.DELIVERED,
    OrderStatus.CANCEL,
    OrderStatus.REFUND,
    OrderStatus.DRAFT,
  ])
  orderStatus: number;

  @IsOptional()
  @IsString()
  courierLink: string;

  @IsOptional()
  @IsString()
  orderId: string;

  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  packingImage?: string;

  @IsOptional()
  @IsString()
  phoneNo: string;
}

export class FilterAndPaginationOrderDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterOrderDto)
  filter: FilterOrderDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;

  @IsOptional()
  @IsObject()
  sort: object;

  @IsOptional()
  @IsObject()
  select: any;
}

export class ParseRawTextDto {
  @IsNotEmpty()
  @IsString()
  rawText: string;
}

export class ModeratorActivityFilterDto {
  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  actionType?: string;

  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  pageSize?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

