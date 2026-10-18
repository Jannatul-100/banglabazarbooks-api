import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { AdminMetaRoles } from '../../decorator/admin-roles.decorator';
import { AdminRoles } from '../../enum/admin-roles.enum';
import { AdminRolesGuard } from '../../guards/admin-roles.guard';
import { AdminMetaPermissions } from '../../decorator/admin-permissions.decorator';
import { AdminPermissions } from '../../enum/admin-permission.enum';
import { AdminPermissionGuard } from '../../guards/admin-permission.guard';
import { AdminJwtAuthGuard } from '../../guards/admin-jwt-auth.guard';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { MongoIdValidationPipe } from '../../pipes/mongo-id-validation.pipe';
import { LandingPageService } from './landing-page.service';
import {
  AddLandingPageDto,
  FilterAndPaginationLandingPageDto,
  SubmitLandingPageLeadDto,
  UpdateLandingPageDto,
} from '../../dto/landing-page.dto';

@Controller('landing-page')
export class LandingPageController {
  private readonly logger = new Logger(LandingPageController.name);

  constructor(private readonly landingPageService: LandingPageService) {}

  @Post('/add')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async addLandingPage(
    @Body() addLandingPageDto: AddLandingPageDto,
  ): Promise<ResponsePayload> {
    return this.landingPageService.addLandingPage(addLandingPageDto);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/get-all')
  @UsePipes(ValidationPipe)
  async getAllLandingPages(
    @Body() filterDto: FilterAndPaginationLandingPageDto,
    @Query('q') searchString: string,
  ): Promise<ResponsePayload> {
    return this.landingPageService.getAllLandingPages(filterDto, searchString);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/get-by-slug/:slug')
  async getLandingPageBySlug(
    @Param('slug') slug: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return this.landingPageService.getLandingPageBySlug(slug, select);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/submit-lead')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async submitLandingPageLead(
    @Body() dto: SubmitLandingPageLeadDto,
  ): Promise<ResponsePayload> {
    return this.landingPageService.submitLandingPageLead(dto);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/:id')
  async getLandingPageById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return this.landingPageService.getLandingPageById(id, select);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async updateLandingPageById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateLandingPageDto: UpdateLandingPageDto,
  ): Promise<ResponsePayload> {
    return this.landingPageService.updateLandingPageById(id, updateLandingPageDto);
  }

  @Version(VERSION_NEUTRAL)
  @Delete('/delete/:id')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.DELETE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async deleteLandingPageById(
    @Param('id', MongoIdValidationPipe) id: string,
  ): Promise<ResponsePayload> {
    return this.landingPageService.deleteLandingPageById(id);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/delete-multiple')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.DELETE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async deleteMultipleLandingPageById(
    @Body() data: { ids: string[] },
  ): Promise<ResponsePayload> {
    return this.landingPageService.deleteMultipleLandingPageById(data.ids);
  }
}
