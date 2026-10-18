import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNotEmptyObject,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GenderTypes } from '../enum/gender-types.enum';
import { Type } from 'class-transformer';
import { PaginationDto } from './pagination.dto';
import { AdminRoles } from '../enum/admin-roles.enum';

export class CreateAdminDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  password: string;

  @IsNotEmpty()
  @IsString()
  @IsIn([
    AdminRoles.SUPER_ADMIN,
    AdminRoles.ADMIN,
    AdminRoles.EDITOR,
    AdminRoles.SALESMAN,
    AdminRoles.ACCOUNTANT,
    AdminRoles.PUBLISHER,
  ])
  role: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  permissions: string[];

  @IsOptional()
  @IsString()
  @IsIn([GenderTypes.MALE, GenderTypes.FEMALE, GenderTypes.OTHER])
  gender: string;

  @IsOptional()
  publisher: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessPages?: string[];
}

export class AuthAdminDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  password: string;
}

export class AdminSelectFieldDto {
  @IsOptional()
  @Matches(/^((?!password).)*$/)
  select: string;
}

export class FilterAdminDto {
  @IsOptional()
  @IsBoolean()
  hasAccess: boolean;

  @IsOptional()
  role: any;

  @IsOptional()
  @IsString()
  @IsIn([GenderTypes.MALE, GenderTypes.FEMALE, GenderTypes.OTHER])
  gender: string;
}

export class FilterAndPaginationAdminDto {
  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => FilterAdminDto)
  filter: FilterAdminDto;

  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;

  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  sort: object;

  @IsOptional()
  @IsNotEmptyObject()
  @IsObject()
  select: any;
}

export class UpdateAdminDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  username: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  newPassword: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  password: string;

  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @IsIn([
    AdminRoles.SUPER_ADMIN,
    AdminRoles.ADMIN,
    AdminRoles.EDITOR,
    AdminRoles.SALESMAN,
    AdminRoles.ACCOUNTANT,
    AdminRoles.PUBLISHER,
  ])
  role: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  permissions: string[];

  @IsOptional()
  @IsOptional()
  @IsString()
  @IsIn([GenderTypes.MALE, GenderTypes.FEMALE, GenderTypes.OTHER])
  gender: string;

  @IsOptional()
  publisher: any;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accessPages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  ids: string[];
}

