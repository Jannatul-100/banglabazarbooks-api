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
import { AdminMetaRoles } from '../../../decorator/admin-roles.decorator';
import { AdminRoles } from '../../../enum/admin-roles.enum';
import { AdminRolesGuard } from '../../../guards/admin-roles.guard';
import { AdminMetaPermissions } from '../../../decorator/admin-permissions.decorator';
import { AdminPermissions } from '../../../enum/admin-permission.enum';
import { AdminPermissionGuard } from '../../../guards/admin-permission.guard';
import { AdminJwtAuthGuard } from '../../../guards/admin-jwt-auth.guard';
import {
  AddOrderDto,
  FilterAndPaginationOrderDto,
  OptionOrderDto,
  ParseRawTextDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  CustomerUpdateOrderDto,
  ModeratorActivityFilterDto,
} from '../../../dto/order.dto';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import { MongoIdValidationPipe } from '../../../pipes/mongo-id-validation.pipe';
import { OrderService } from './order.service';
import { UserJwtAuthGuard } from '../../../guards/user-jwt-auth.guard';
import { GetTokenUser } from '../../../decorator/get-token-user.decorator';
import { User } from '../../../interfaces/user/user.interface';

@Controller('order')
export class OrderController {
  private logger = new Logger(OrderController.name);

  constructor(private orderService: OrderService) {}

  /**
   * addOrder
   * insertManyOrder
   */
  @Post('/add')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async addOrder(
    @Body()
    addOrderDto: AddOrderDto,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    addOrderDto.processedBy = admin._id;
    return await this.orderService.addOrderAdmin(addOrderDto, admin);
  }

  @Put('/updateDate')
  // @UsePipes(ValidationPipe)
  // @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  // @UseGuards(AdminRolesGuard)
  // @AdminMetaPermissions(AdminPermissions.CREATE)
  // @UseGuards(AdminPermissionGuard)
  // @UseGuards(AdminJwtAuthGuard)
  async updateDate(): Promise<ResponsePayload> {
    return await this.orderService.updateDate();
  }

  @Post('/add-order-by-user')
  @UsePipes(ValidationPipe)
  @UseGuards(UserJwtAuthGuard)
  async addOrderByUser(
    @Body()
    addOrderDto: AddOrderDto,
    @GetTokenUser() user: User,
  ): Promise<ResponsePayload> {
    return await this.orderService.addOrderByUser(addOrderDto, user);
  }

  @Put('/customer-edit/:id')
  @UsePipes(ValidationPipe)
  @UseGuards(UserJwtAuthGuard)
  async customerEditOrder(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() customerUpdateOrderDto: CustomerUpdateOrderDto,
    @GetTokenUser() user: User,
  ): Promise<ResponsePayload> {
    return await this.orderService.customerEditOrder(id, customerUpdateOrderDto, user);
  }

  @Post('/add-order-by-anonymous')
  @UsePipes(ValidationPipe)
  // @UseGuards(UserJwtAuthGuard)
  async addOrderByAnonymous(
    @Body()
    addOrderDto: AddOrderDto,
    // @GetTokenUser() user: User,
  ): Promise<ResponsePayload> {
    return await this.orderService.addOrderByAnonymous(addOrderDto);
  }

  @Post('/insert-many')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.CREATE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async insertManyOrder(
    @Body()
    body: {
      data: AddOrderDto[];
      option: OptionOrderDto;
    },
  ): Promise<ResponsePayload> {
    return await this.orderService.insertManyOrder(body.data, body.option);
  }

  /**
   * getAllOrders
   * getOrderById
   */
  @Version(VERSION_NEUTRAL)
  @Post('/get-all')
  @UsePipes(ValidationPipe)
  async getAllOrders(
    @Body() filterOrderDto: FilterAndPaginationOrderDto,
    @Query('q') searchString: string,
  ): Promise<ResponsePayload> {
    return this.orderService.getAllOrders(filterOrderDto, searchString);
  }

  @Post('/get-orders-by-user')
  @UsePipes(ValidationPipe)
  @UseGuards(UserJwtAuthGuard)
  async getOrdersByUser(
    @GetTokenUser() user: User,
    @Body() filterOrderDto: FilterAndPaginationOrderDto,
    @Query('q') searchString: string,
  ): Promise<ResponsePayload> {
    return await this.orderService.getOrdersByUser(
      user,
      filterOrderDto,
      searchString,
    );
  }

  @Post('/parse-raw-text')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async parseRawText(
    @Body() parseRawTextDto: ParseRawTextDto,
  ): Promise<ResponsePayload> {
    return await this.orderService.parseRawText(parseRawTextDto);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/:id')
  async getOrderById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.orderService.getOrderById(id, select);
  }

  @Post('/track-order')
  async trackOrder(
    @Body() body: { orderId: string, phoneNo: string },
  ): Promise<ResponsePayload> {
    return await this.orderService.trackOrder(body.orderId, body.phoneNo);
  }

  @Post('/get-tab-counts')
  async getTabCounts(
    @Body() filterOrderDto: FilterAndPaginationOrderDto,
    @Query('q') searchString: string,
  ) {
    return await this.orderService.getTabCounts(filterOrderDto, searchString);
  }

  /**
   * updateOrderById
   * updateMultipleOrderById
   */
  @Version(VERSION_NEUTRAL)
  @Put('/update-admin/:id')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async updateOrderAdminById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    updateOrderDto.processedBy = admin._id;
    return await this.orderService.updateOrderById(id, updateOrderDto, admin);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update/:id')
  @UsePipes(ValidationPipe)
  async updateOrderById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<ResponsePayload> {
    return await this.orderService.updateOrderById(id, updateOrderDto);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update-multiple')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async updateMultipleOrderById(
    @Body() updateOrderDto: UpdateOrderDto,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    return await this.orderService.updateMultipleOrderById(
      updateOrderDto.ids,
      updateOrderDto,
      admin,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update-order-session-key/:id')
  @UsePipes(ValidationPipe)
  async updateOrderSessionKey(
    @Param('id') id: string,
    @Body() updateOrderDto: any,
  ): Promise<ResponsePayload> {
    return await this.orderService.updateOrderSessionKey(id, updateOrderDto);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/change-status/:id')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.EDIT)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async changeOrderStatus(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateOrderStatusDto: UpdateOrderStatusDto,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    updateOrderStatusDto['processedBy'] = admin._id;
    return await this.orderService.changeOrderStatus(id, updateOrderStatusDto, admin);
  }

  @Post('/generate-invoices')
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.GET)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async generateInvoices(
    @Body() data: { ids: string[] },
  ): Promise<ResponsePayload> {
    return await this.orderService.generateInvoices(data.ids);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/check-fraud-order/:phoneNo')
  @AdminMetaRoles(AdminRoles.ADMIN, AdminRoles.SUPER_ADMIN, AdminRoles.EDITOR, AdminRoles.SALESMAN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @UseGuards(AdminJwtAuthGuard)
  async checkFraudOrder(
    @Param('phoneNo') phoneNo: string,
  ): Promise<ResponsePayload> {
    return await this.orderService.checkFraudOrder(phoneNo);
  }

  /**
   * deleteOrderById
   * deleteMultipleOrderById
   */
  @Version(VERSION_NEUTRAL)
  @Delete('/delete/:id')
  @UsePipes(ValidationPipe)
  // @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  // @UseGuards(AdminRolesGuard)
  // @AdminMetaPermissions(AdminPermissions.DELETE)
  // @UseGuards(AdminPermissionGuard)
  // @UseGuards(AdminJwtAuthGuard)
  async deleteOrderById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query('checkUsage') checkUsage: boolean,
  ): Promise<ResponsePayload> {
    return await this.orderService.deleteOrderById(id, Boolean(checkUsage));
  }

  @Version(VERSION_NEUTRAL)
  @Post('/delete-multiple')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.DELETE)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async deleteMultipleOrderById(
    @Body() data: { ids: string[] },
    @Query('checkUsage') checkUsage: boolean,
  ): Promise<ResponsePayload> {
    return await this.orderService.deleteMultipleOrderById(
      data.ids,
      Boolean(checkUsage),
    );
  }

  @Version(VERSION_NEUTRAL)
  @Put('/send-to-courier/:id')
  @UsePipes(ValidationPipe)
  @UseGuards(AdminJwtAuthGuard)
  async sendToCourier(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() courierData: any,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    return await this.orderService.sendToCourier(id, courierData, admin);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/bulk-send-to-courier')
  @UsePipes(ValidationPipe)
  @UseGuards(AdminJwtAuthGuard)
  async bulkSendToCourier(
    @Body() data: any,
    @GetTokenUser() admin: any,
  ): Promise<ResponsePayload> {
    return await this.orderService.bulkSendToCourier(data, admin);
  }

  @Post('/moderator-activity-report')
  @UsePipes(ValidationPipe)
  @AdminMetaRoles(AdminRoles.SUPER_ADMIN, AdminRoles.ADMIN, AdminRoles.MODERATOR)
  @UseGuards(AdminRolesGuard)
  @AdminMetaPermissions(AdminPermissions.GET)
  @UseGuards(AdminPermissionGuard)
  @UseGuards(AdminJwtAuthGuard)
  async getModeratorActivityReport(
    @Body() filterDto: ModeratorActivityFilterDto,
  ): Promise<ResponsePayload> {
    return await this.orderService.getModeratorActivityReport(filterDto);
  }
}
