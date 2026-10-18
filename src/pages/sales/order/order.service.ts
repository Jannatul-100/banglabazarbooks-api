import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UtilsService } from '../../../shared/utils/utils.service';
import { Order } from '../../../interfaces/common/order.interface';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import { ErrorCodes } from '../../../enum/error-code.enum';
import {
  AddOrderDto,
  FilterAndPaginationOrderDto,
  OptionOrderDto,
  UpdateOrderDto,
  UpdateOrderStatusDto,
  ParseRawTextDto,
} from '../../../dto/order.dto';
import { Product } from '../../../interfaces/common/product.interface';
import { UniqueId } from '../../../interfaces/core/unique-id.interface';
import { OrderStatus } from '../../../enum/order.enum';
import { User } from '../../../interfaces/user/user.interface';
import { Cart } from '../../../interfaces/common/cart.interface';
import { BulkSmsService } from '../../../shared/bulk-sms/bulk-sms.service';
import { EmailService } from '../../../shared/email/email.service';
import { Coupon } from '../../../interfaces/common/coupon.interface';
import { DiscountTypeEnum } from '../../../enum/product.enum';
import { OrderOffer } from '../../../interfaces/common/order-offer.interface';
import { SpecialPackage } from '../../../interfaces/common/special-package.interface';
import { Setting } from '../../../interfaces/common/setting.interface';
import { Admin } from '../../../interfaces/admin/admin.interface';
import { AdminRoles } from '../../../enum/admin-roles.enum';
import { ModeratorActivityFilterDto } from '../../../dto/order.dto';
import { PaymentService } from '../../payment/payment.service';
import axios from 'axios';

const ObjectId = Types.ObjectId;

@Injectable()
export class OrderService {
  private logger = new Logger(OrderService.name);

  constructor(
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    @InjectModel('Product') private readonly productModel: Model<Product>,
    @InjectModel('SpecialPackage')
    private readonly specialPackageModel: Model<SpecialPackage>,
    @InjectModel('UniqueId') private readonly uniqueIdModel: Model<UniqueId>,
    @InjectModel('Cart') private readonly cartModel: Model<Cart>,
    @InjectModel('User') private readonly userModel: Model<Cart>,
    @InjectModel('Coupon') private readonly couponModel: Model<Coupon>,
    @InjectModel('OrderOffer')
    private readonly orderOfferModel: Model<OrderOffer>,
    @InjectModel('Setting')
    private readonly settingModel: Model<Setting>,
    @InjectModel('Admin')
    private readonly adminModel: Model<Admin>,
    private configService: ConfigService,
    private utilsService: UtilsService,
    private bulkSmsService: BulkSmsService,
    private emailService: EmailService,
    private paymentService: PaymentService, // private pdfMakerService: TCreatedPdf,
    private jwtService: JwtService,
  ) { }

  /**
   * addOrder
   * insertManyOrder
   */
  async addOrderAdmin(addOrderDto: AddOrderDto, admin?: any): Promise<ResponsePayload> {
    let user;
    let mData;

    // this.logger.error(addOrderDto);
    // Increment Order Id Unique
    const incOrder = await this.uniqueIdModel.findOneAndUpdate(
      {},
      { $inc: { orderId: 1 } },
      { new: true, upsert: true },
    );

    const orderIdUnique = this.utilsService.padLeadingZeros(incOrder.orderId);

    let hasPreOrder = (addOrderDto as any).hasPreOrder === true ||
      (addOrderDto as any).orderedItems?.some((item: any) => item.orderType === 'pre_order' || item.orderType === 'pre-order' || item.isPreOrder) || false;

    if (!hasPreOrder && (addOrderDto as any).orderedItems?.length) {
      const itemIds = (addOrderDto as any).orderedItems.map((i: any) => i._id).filter(Boolean);
      if (itemIds.length) {
        const foundPreOrder = await this.productModel.exists({ _id: { $in: itemIds }, isPreOrder: true });
        if (foundPreOrder) {
          hasPreOrder = true;
        }
      }
    }

    const dataExtra: any = {
      orderId: orderIdUnique,
      month: this.utilsService.getDateMonth(false, new Date()),
      year: this.utilsService.getDateYear(new Date()),
      hasPreOrder,
    };

    if (admin) {
      dataExtra.processedBy = admin._id;
      dataExtra.createdByAdmin = admin._id;
      dataExtra.moderatorLogs = [
        {
          adminId: admin._id,
          adminName: admin.name || admin.username,
          adminUsername: admin.username,
          adminRole: admin.role,
          action: 'Order Created',
          description: `Order created by ${admin.name || admin.username} (${admin.role})`,
          afterStatus: addOrderDto.orderStatus,
          date: new Date(),
        },
      ];
    }

    if (addOrderDto.phoneNo && !addOrderDto.user) {
      user = await this.userModel.findOne({ phoneNo: addOrderDto.phoneNo });
      // console.log(user);
      if (user) {
        mData = { ...addOrderDto, ...dataExtra, ...{ user: user._id } };
      } else {
        mData = { ...addOrderDto, ...dataExtra };
      }
    } else {
      mData = { ...addOrderDto, ...dataExtra };
    }

    if (addOrderDto.orderStatus === OrderStatus.DRAFT && addOrderDto.phoneNo) {
      const existingDraft = await this.orderModel.findOne({
        phoneNo: addOrderDto.phoneNo,
        orderStatus: OrderStatus.DRAFT
      });
      if (existingDraft) {
        throw new BadRequestException(`A draft order already exists for phone number ${addOrderDto.phoneNo}. Please update the existing draft (Order ID: ${existingDraft.orderId}).`);
      }
    }

    const newData = new this.orderModel(mData);

    try {
      const saveData = await newData.save();

      // if (saveData.email) {
      //
      //   const file = await this.pdfMakerService.makePDF(saveData)
      //   await this.emailService.sendEmail(saveData.name, saveData.email, file);
      //
      // }

      const data = {
        _id: saveData._id,
        orderId: saveData.orderId,
      };
      if (addOrderDto.user) {
        await this.cartModel.deleteMany({
          user: new ObjectId(addOrderDto.user),
        });
        await this.userModel.findOneAndUpdate(
          { _id: addOrderDto.user },
          {
            $set: {
              carts: [],
            },
          },
        );
        if (addOrderDto.coupon) {
          await this.userModel.findOneAndUpdate(
            { _id: addOrderDto.user },
            {
              $push: {
                usedCoupons: addOrderDto.coupon,
              },
            },
          );
        }
      }

      for (const f of addOrderDto['orderedItems']) {
        const product = await this.productModel.findById(f._id);
        if (product?.quantity > 0) {
          await this.productModel.findByIdAndUpdate(f._id, {
            $inc: {
              quantity: -f.quantity,
              totalSold: f.quantity,
            },
          });
        } else {
          await this.productModel.findByIdAndUpdate(f._id, {
            $inc: {
              totalSold: f.quantity,
            },
          });
        }
      }

      return {
        success: true,
        message: 'Order Added Success',
        data,
      } as ResponsePayload;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async addOrder(addOrderDto: AddOrderDto): Promise<ResponsePayload> {
    try {
      if (addOrderDto['courierData']?.providerName === 'Sundarban Courier' && addOrderDto.paymentType === 'cash_on_delivery') {
        throw new BadRequestException('সুন্দরবন কুরিয়ারের ক্ষেত্রে ক্যাশ অন ডেলিভারি প্রযোজ্য নয়।');
      }

      // Double order prevention: reject duplicate within 15s with same phone and grandTotal
      if (addOrderDto.phoneNo) {
        const fifteenSecondsAgo = new Date(Date.now() - 15000);
        const existingRecentOrder = await this.orderModel.findOne({
          phoneNo: addOrderDto.phoneNo,
          createdAt: { $gte: fifteenSecondsAgo },
          grandTotal: (addOrderDto as any).grandTotal,
        });
        if (existingRecentOrder) {
          return {
            success: true,
            message: 'আপনার অর্ডারটি ইতিমধ্যে সফলভাবে গ্রহণ করা হয়েছে।',
            data: existingRecentOrder,
          } as ResponsePayload;
        }
      }

      let token: string = null;
      let tokenExpiredIn: number = null;
      let userData = null;

      if (addOrderDto.phoneNo && !addOrderDto.user) {
        let user: any = await this.userModel.findOne({ phoneNo: addOrderDto.phoneNo });

        if (!user) {
          const newUser = new this.userModel({
            name: addOrderDto.name,
            phoneNo: addOrderDto.phoneNo,
            username: addOrderDto.phoneNo,
            password: await bcrypt.hash(addOrderDto.phoneNo, 8),
            registrationType: 'email_password',
            hasAccess: true
          });
          user = await newUser.save();
        }

        addOrderDto.user = user._id.toString();

        const payload = {
          _id: user._id,
          username: user.username,
        };
        token = this.jwtService.sign(payload);
        tokenExpiredIn = this.configService.get<number>('userTokenExpiredTime');
        userData = { _id: user._id };
      }

      // New Order Make
      const newOrderMake: any = await this.newOrderMake(addOrderDto);

      // Increment Order Id Unique
      const incOrder = await this.uniqueIdModel.findOneAndUpdate(
        {},
        { $inc: { orderId: 1 } },
        { new: true, upsert: true },
      );

      const orderIdUnique = this.utilsService.padLeadingZeros(incOrder.orderId);

      let hasPreOrder = newOrderMake?.hasPreOrder === true ||
        (addOrderDto as any).hasPreOrder === true ||
        (addOrderDto as any).orderedItems?.some((item: any) => item.orderType === 'pre_order' || item.orderType === 'pre-order' || item.isPreOrder) || false;

      if (!hasPreOrder && (addOrderDto as any)?.carts?.length) {
        const cartIds = (addOrderDto as any).carts.map((m: any) => new ObjectId(m));
        const foundPreOrder = await this.productModel.exists({ _id: { $in: cartIds }, isPreOrder: true });
        if (foundPreOrder) {
          hasPreOrder = true;
        }
      }

      const dataExtra = {
        orderId: orderIdUnique,
        month: this.utilsService.getDateMonth(false, new Date()),
        year: this.utilsService.getDateYear(new Date()),
        hasPreOrder,
      };
      const mData = { ...newOrderMake, ...dataExtra };
      const newData = new this.orderModel(mData);

      const saveData = await newData.save();

      // if (saveData.email) {
      //   const file = await this.pdfMakerService.makePDF(saveData);
      //   await this.emailService.sendEmail(saveData.name, saveData.email, file);
      // }

      const data = {
        _id: saveData._id,
        orderId: saveData.orderId,
      };

      if (addOrderDto.user && saveData._id) {
        await this.cartModel.deleteMany({
          user: new ObjectId(addOrderDto.user),
        });
        await this.userModel.findOneAndUpdate(
          { _id: addOrderDto.user },
          {
            $set: {
              carts: [],
            },
          },
        );
        if (addOrderDto.coupon) {
          await this.userModel.findOneAndUpdate(
            { _id: addOrderDto.user },
            {
              $push: {
                usedCoupons: addOrderDto.coupon,
              },
            },
          );
        }

        // const userData = await this.userModel
        //   .findById(addOrderDto.user)
        //   .select('phone email');
      }
      // <iframe src="${pdfLink}" frameborder="0" width="100%" height="500px"></iframe>
      // <a href="${pdfLink}">Download your invoice</a>
      // await this.utilsService.generateInvoicePdf(saveData);
      // const pdfLink = `https://api.banglabazarbooks.com/invoice/invoice-${saveData.orderId}.pdf`;
      // <iframe src="${pdfLink}" frameborder="0" width="100%" height="500px"></iframe>
      // <iframe src="${pdfLink}" frameborder="0" width="100%" height="500px"></iframe>
      if (saveData['paymentType'] === 'bkash') {
        const paymentData = {
          mode: '0011',
          payerReference: saveData.phoneNo || '1',
          callbackURL: this.configService.get<string>('bkashCallbackUrl') || (process.env.PRODUCTION_BUILD === 'true'
            ? 'https://api.banglabazarbooks.com/api/payment/callback-bkash-payment'
            : `http://localhost:${process.env.PORT || 3000}/api/payment/callback-bkash-payment`),
          amount: saveData.grandTotal.toString(),
          currency: 'BDT',
          intent: 'sale',
          merchantInvoiceNumber: saveData.orderId,
        };
        const bkashResponse = await this.paymentService.createBkashPayment(paymentData);
        if (bkashResponse.success) {
          await this.orderModel.findByIdAndUpdate(saveData._id, {
            bkashPaymentId: bkashResponse.data.paymentID
          });
          data['providerName'] = 'Bkash';
          data['link'] = bkashResponse.data.bkashURL;
        }
      } else if (saveData['paymentType'] === 'cash_on_delivery') {
        // const message = `অভিনন্দন! ${addOrderDto.name} আপনি সফলভাবে অর্ডারটি সম্পূর্ণ করেছেন।`;
        // const message = `অভিনন্দন! ${addOrderDto.name} আপনি সফলভাবে অর্ডারটি সম্পূর্ণ করেছেন।`;
        //const message = `Hi ${addOrderDto.name} \nThanks for Shopping with banglabazarbooks.com Please wait for confirmation.`;
        const isSundarban = (saveData as any).courierData?.providerName?.toLowerCase()?.includes('sundarban');
        const isPaid = saveData.paymentStatus === 'paid' || isSundarban;
        const dueAmount = isPaid ? 0 : saveData.grandTotal;
        const paymentStatusText = isPaid ? 'Paid' : `Due: ৳${saveData.grandTotal}`;
        const message = `Thank you for your purchase from banglabazarbooks.com. Your order (${saveData.orderId}) has been placed successfully. Bill: ৳${saveData.grandTotal} (${paymentStatusText}). Please wait for a confirmation Call.`;
        this.bulkSmsService.sentSingleSms(saveData.phoneNo, message);
        // const userEmail = addOrderDto.email;
        // Sent Email
        if (saveData.email) {
          const html = `
      <p>Thank you for your purchase from banglabazarbooks.com. Your order (${saveData.orderId}) has been placed successfully. Due Amount: ৳${dueAmount}. Please wait for a confirmation Call. Track your order banglabazarbooks.com/order-track/${saveData._id}
      </p>
     
      `;
          this.emailService.sendEmail(saveData.email, 'Gurdianpubs', html);
        }
      }

      // Sent Bulk Sms
      // this.bulkSmsService.sentSingleSms(
      //   phoneNo,
      //   `Your banglabazarbooks.com otp code is ${code}`,
      // );

      // for (const f of addOrderDto['orderedItems']) {
      //   await this.productModel.findByIdAndUpdate(f._id, {
      //     $inc: {
      //       totalSold: f.quantity,
      //     },
      //   });
      //
      //   await this.productModel.findByIdAndUpdate(f._id, {
      //     $inc: {
      //       quantity: -f.quantity,
      //     },
      //   });
      // }

      return {
        success: true,
        message: 'Order Added Success',
        data,
        ...(token ? { token, tokenExpiredIn, userData } : {})
      } as ResponsePayload;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async addOrderByUser(
    addOrderDto: AddOrderDto,
    user: User,
  ): Promise<ResponsePayload> {
    // Add user ID on order dto
    if (user) {
      addOrderDto.user = user._id;
    }
    return this.addOrder(addOrderDto);
  }

  async addOrderByAnonymous(
    addOrderDto: AddOrderDto,
  ): Promise<ResponsePayload> {
    // Add user ID on order dto
    // if (user) {
    //   addOrderDto.user = user._id;
    // }
    return this.addOrder(addOrderDto);
  }

  async updateDate(): Promise<ResponsePayload> {
    try {
      const data = await this.orderModel.find();

      if (data) {
        data.forEach(async (f) => {
          const date = this.utilsService.getDateString(f.preferredDate);
          // console.log('updateDate', date);
          await this.orderModel.findByIdAndUpdate(f._id, {
            $set: { preferredDateString: date },
            // $unset: {preferredDate: ''}
          });
        });
      }

      return {
        success: true,
        message: `Success`,
      } as ResponsePayload;
    } catch (error) {
      // console.log(error);
      if (error?.code && error?.code?.toString() === ErrorCodes.UNIQUE_FIELD) {
        throw new ConflictException('Slug Must be Unique');
      } else {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async insertManyOrder(
    addOrdersDto: AddOrderDto[],
    optionOrderDto: OptionOrderDto,
  ): Promise<ResponsePayload> {
    const { deleteMany } = optionOrderDto;
    if (deleteMany) {
      await this.orderModel.deleteMany({});
    }
    const mData = addOrdersDto.map((m) => {
      return {
        ...m,
        ...{
          slug: this.utilsService.transformToSlug(m.name),
        },
      };
    });
    try {
      const saveData = await this.orderModel.insertMany(mData);
      return {
        success: true,
        message: `${saveData && saveData.length ? saveData.length : 0
          }  Data Added Success`,
      } as ResponsePayload;
    } catch (error) {
      // console.log(error);
      if (error?.code && error?.code?.toString() === ErrorCodes?.UNIQUE_FIELD) {
        throw new ConflictException('Slug Must be Unique');
      } else {
        throw new InternalServerErrorException(error?.message);
      }
    }
  }

  /**
   * getAllOrders
   * getOrderById
   */
  async getAllOrders(
    filterOrderDto: FilterAndPaginationOrderDto,
    searchQuery?: string,
  ): Promise<ResponsePayload> {
    const { filter } = filterOrderDto;
    const { pagination } = filterOrderDto;
    const { sort } = filterOrderDto;
    const { select } = filterOrderDto;

    // Calculations
    const aggregateStagesCalculation = [];
    // Essential Variables
    const aggregateStages = [];
    let mFilter = {};
    let mSort = {};
    let mSelect = {};
    let mPagination = {};

    // Match
    if (filter) {
      mFilter = { ...mFilter, ...filter };
    }

    if (searchQuery && searchQuery !== 'null') {
      mFilter = {
        $and: [
          mFilter,
          {
            $or: [
              { orderId: { $regex: searchQuery, $options: 'i' } },
              { phoneNo: { $regex: searchQuery, $options: 'i' } },
              { name: { $regex: searchQuery, $options: 'i' } },
            ],
          },
        ],
      };
    }
    // Sort
    if (sort) {
      mSort = sort;
    } else {
      mSort = { createdAt: -1 };
    }

    // Select
    if (select) {
      mSelect = { ...select };
    } else {
      mSelect = { name: 1 };
    }

    // Finalize
    if (Object.keys(mFilter).length) {
      aggregateStages.push({ $match: mFilter });
      const group = {
        $group: {
          _id: null,
          grandTotal: { $sum: '$grandTotal' },
          // totalPaid: { $sum: '$paidAmount' },
          // totalDiscount: { $sum: '$discount' },
        },
      };
      aggregateStagesCalculation.push({ $match: mFilter });
      aggregateStagesCalculation.push(group);
    } else {
      const group = {
        $group: {
          _id: null,
          grandTotal: { $sum: '$grandTotal' },
          // totalPaid: { $sum: '$paidAmount' },
          // totalDiscount: { $sum: '$discount' },
        },
      };
      aggregateStagesCalculation.push(group);
    }

    if (Object.keys(mSort).length) {
      aggregateStages.push({ $sort: mSort });
    }

    if (!pagination) {
      aggregateStages.push({ $project: mSelect });
    }

    // Pagination
    if (pagination) {
      if (Object.keys(mSelect).length) {
        mPagination = {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              {
                $skip: pagination.pageSize * pagination.currentPage,
              } /* IF PAGE START FROM 0 OR (pagination.currentPage - 1) IF PAGE 1*/,
              { $limit: pagination.pageSize },
              { $project: mSelect },
            ],
          },
        };
      } else {
        mPagination = {
          $facet: {
            metadata: [{ $count: 'total' }],
            data: [
              {
                $skip: pagination.pageSize * pagination.currentPage,
              } /* IF PAGE START FROM 0 OR (pagination.currentPage - 1) IF PAGE 1*/,
              { $limit: pagination.pageSize },
            ],
          },
        };
      }

      aggregateStages.push(mPagination);

      aggregateStages.push({
        $project: {
          data: 1,
          count: { $arrayElemAt: ['$metadata.total', 0] },
        },
      });
    }

    try {
      const dataAggregates = await this.orderModel.aggregate(aggregateStages);
      const calculateAggregates = await this.orderModel.aggregate(
        aggregateStagesCalculation,
      );
      if (pagination) {
        if (dataAggregates[0]?.data?.length) {
          await this.attachPreviousOrderCount(dataAggregates[0].data);
        }
        return {
          ...{ ...dataAggregates[0] },
          ...{
            calculation: calculateAggregates[0],
            success: true,
            message: 'Success',
          },
        } as ResponsePayload;
      } else {
        return {
          data: dataAggregates,
          //
          success: true,
          message: 'Success',
          count: dataAggregates.length,
        } as ResponsePayload;
      }
    } catch (err) {
      this.logger.error(err);
      if (
        err?.code &&
        err?.code?.toString() === ErrorCodes?.PROJECTION_MISMATCH
      ) {
        throw new BadRequestException('Error! Projection mismatch');
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  /**
   * Adds `previousOrderCount` to each order: how many earlier (non-draft)
   * orders the same phone number has placed. 0 means a first-time customer.
   */
  private async attachPreviousOrderCount(orders: any[]): Promise<void> {
    try {
      const phones = [
        ...new Set(orders.map((o) => o.phoneNo).filter((p) => !!p)),
      ];
      if (!phones.length) {
        return;
      }

      const history = await this.orderModel
        .find({
          phoneNo: { $in: phones },
          orderStatus: { $ne: OrderStatus.DRAFT },
        })
        .select('phoneNo createdAt')
        .lean();

      const byPhone = new Map<string, number[]>();
      for (const h of history as any[]) {
        const list = byPhone.get(h.phoneNo) || [];
        list.push(new Date(h.createdAt).getTime());
        byPhone.set(h.phoneNo, list);
      }

      for (const order of orders) {
        const times = byPhone.get(order.phoneNo) || [];
        const current = order.createdAt
          ? new Date(order.createdAt).getTime()
          : Date.now();
        order.previousOrderCount = times.filter((t) => t < current).length;
      }
    } catch (err) {
      this.logger.error(err);
    }
  }

  async getOrdersByUser(
    user: User,
    filterOrderDto: FilterAndPaginationOrderDto,
    searchQuery?: string,
  ): Promise<ResponsePayload> {
    const userPhone = (user as any).phoneNo || user.phone;
    const userObjId = ObjectId.isValid(user._id) ? new ObjectId(user._id) : null;
    const userStringId = user._id ? user._id.toString() : null;

    if (userPhone && userObjId) {
      const digits = userPhone.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      await this.orderModel.updateMany(
        {
          $or: [
            { phoneNo: userPhone },
            ...(last10 ? [{ phoneNo: new RegExp(last10 + '$') }] : []),
          ],
        },
        { $set: { user: userObjId } },
      );
    }

    const { filter } = filterOrderDto;

    const userMatchConds: any[] = [];
    if (userObjId) userMatchConds.push({ user: userObjId });
    if (userStringId) userMatchConds.push({ user: userStringId });
    if (userPhone) {
      userMatchConds.push({ phoneNo: userPhone });
      const digits = userPhone.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      if (last10) {
        userMatchConds.push({ phoneNo: new RegExp(last10 + '$') });
      }
    }

    let mFilter: any = {};
    if (userMatchConds.length > 0) {
      if (filter) {
        mFilter = {
          $and: [
            { $or: userMatchConds },
            filter,
          ],
        };
      } else {
        mFilter = { $or: userMatchConds };
      }
    } else {
      mFilter = filter || {};
    }

    filterOrderDto.filter = mFilter;

    return this.getAllOrders(filterOrderDto, searchQuery);
  }

  async getOrderById(id: string, select: string): Promise<ResponsePayload> {
    try {
      const data = await this.orderModel.findById(id).select(select);
      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async trackOrder(orderId: string, phoneNo: string): Promise<ResponsePayload> {
    try {
      const cleanOrderId = (orderId || '').trim();
      const cleanPhoneNo = (phoneNo || '').trim();

      if (!cleanOrderId || !cleanPhoneNo) {
        return {
          success: false,
          message: 'Order ID and Phone Number are required.',
        } as ResponsePayload;
      }

      const digits = cleanPhoneNo.replace(/\D/g, '');
      const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
      const escapedOrderId = cleanOrderId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const paddedOrderId =
        cleanOrderId.length < 8 && !isNaN(Number(cleanOrderId))
          ? this.utilsService.padLeadingZeros(Number(cleanOrderId))
          : cleanOrderId;

      const order = await this.orderModel
        .findOne({
          $or: [
            { orderId: cleanOrderId },
            { orderId: paddedOrderId },
            { orderId: { $regex: new RegExp(`^${escapedOrderId}$`, 'i') } },
          ],
        })
        .populate('user', 'name phoneNo');

      if (!order) {
        return {
          success: false,
          message: 'অর্ডারটি খুঁজে পাওয়া যায়নি। সঠিক Order ID দিন।',
        } as ResponsePayload;
      }

      const orderDigits = (order.phoneNo || '').replace(/\D/g, '');
      const isMatch =
        order.phoneNo === cleanPhoneNo ||
        (last10 && orderDigits.endsWith(last10)) ||
        (orderDigits.length >= 10 && digits.endsWith(orderDigits.slice(-10)));

      if (!isMatch) {
        return {
          success: false,
          message: 'প্রদত্ত ফোন নম্বরের সাথে অর্ডারের তথ্যের মিল পাওয়া যায়নি।',
        } as ResponsePayload;
      }

      return {
        success: true,
        message: 'Success',
        data: order,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * updateOrderById
   * updateMultipleOrderById
   */
  async updateOrderById(
    id: string,
    updateOrderDto: UpdateOrderDto,
    admin?: any,
  ): Promise<ResponsePayload> {
    const { name } = updateOrderDto;
    let data;
    try {
      data = await this.orderModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }

    if (updateOrderDto.orderStatus === OrderStatus.DRAFT) {
      const phoneToUse = updateOrderDto.phoneNo || data.phoneNo;
      if (phoneToUse) {
        const existingDraft = await this.orderModel.findOne({
          phoneNo: phoneToUse,
          orderStatus: OrderStatus.DRAFT,
          _id: { $ne: data._id }
        });
        if (existingDraft) {
          throw new BadRequestException(`A draft order already exists for phone number ${phoneToUse}. Please update the existing draft (Order ID: ${existingDraft.orderId}).`);
        }
      }
    }
    try {
      if ((updateOrderDto as any).orderedItems && (updateOrderDto as any).orderedItems.length > 0) {
        (updateOrderDto as any).hasPreOrder = (updateOrderDto as any).orderedItems.some(item => item.orderType === 'pre_order' || item.orderType === 'pre-order');
      }

      const updateData: any = {
        $set: updateOrderDto,
      };

      if (admin) {
        updateData.$set.processedBy = admin._id;
        const logEntry = {
          adminId: admin._id,
          adminName: admin.name || admin.username,
          adminUsername: admin.username,
          adminRole: admin.role,
          action: 'Order Edited',
          description: `Order edited by ${admin.name || admin.username}`,
          beforeStatus: data.orderStatus,
          afterStatus:
            updateOrderDto.orderStatus !== undefined
              ? updateOrderDto.orderStatus
              : data.orderStatus,
          date: new Date(),
        };
        updateData.$push = { moderatorLogs: logEntry };
      }

      await this.orderModel.findByIdAndUpdate(id, updateData);
      return {
        success: true,
        message: 'Order updated successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }

  async updateMultipleOrderById(
    ids: string[],
    updateOrderDto: UpdateOrderDto,
    admin?: any,
  ): Promise<ResponsePayload> {
    try {
      if (updateOrderDto.orderStatus !== undefined) {
        const updateOrderStatusDto = {
          orderStatus: updateOrderDto.orderStatus
        } as UpdateOrderStatusDto;

        // Execute changeOrderStatus for each order concurrently
        await Promise.allSettled(
          ids.map((id) => this.changeOrderStatus(id, updateOrderStatusDto, admin))
        );

        // Remove orderStatus from updateOrderDto so it's not processed twice
        delete updateOrderDto.orderStatus;
      }

      // If there are any other fields remaining to be updated
      if (Object.keys(updateOrderDto).length > 0) {
        const mIds = ids.map((m) => new ObjectId(m));
        const updateData: any = {
          $set: updateOrderDto,
        };

        if (admin) {
          updateData.$set.processedBy = admin._id;
          const logEntry = {
            adminId: admin._id,
            adminName: admin.name || admin.username,
            adminUsername: admin.username,
            adminRole: admin.role,
            action: 'Bulk Updated',
            description: `Bulk updated by ${admin.name || admin.username}`,
            afterStatus: undefined,
            date: new Date(),
          };
          updateData.$push = { moderatorLogs: logEntry };
        }

        await this.orderModel.updateMany(
          { _id: { $in: mIds } },
          updateData,
        );
      }

      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async customerEditOrder(
    id: string,
    customerUpdateOrderDto: any,
    user: User,
  ): Promise<ResponsePayload> {
    try {
      const order = await this.orderModel.findOne({
        _id: new ObjectId(id),
        user: new ObjectId(user._id),
      });

      if (!order) {
        throw new NotFoundException('Order not found or you do not have permission.');
      }

      if (order.orderStatus !== OrderStatus.PENDING) {
        throw new BadRequestException('Only pending orders can be edited.');
      }

      // Re-calculate based on orderedItems
      // Fetch fresh products to prevent price spoofing
      const productIds = customerUpdateOrderDto.orderedItems.map((m: any) => new ObjectId(m._id));
      const products = await this.productModel.find({ _id: { $in: productIds } });

      let subTotal = 0;
      let discountAmount = 0;
      const updatedOrderedItems = [];

      for (const item of customerUpdateOrderDto.orderedItems) {
        const product = products.find(p => p._id.toString() === item._id.toString());
        if (product) {
          const regularPrice = this.utilsService.transform(product, 'regularPrice');
          const salePrice = this.utilsService.transform(product, 'salePrice');
          const quantity = item.quantity;

          subTotal += regularPrice * quantity;
          const itemDiscount = (regularPrice - salePrice) * quantity;
          discountAmount += itemDiscount;

          updatedOrderedItems.push({
            _id: product._id,
            name: product.name,
            nameEn: product.nameEn,
            slug: product.slug,
            image: product.images?.[0] || null,
            regularPrice: regularPrice,
            salePrice: salePrice,
            unitPrice: salePrice,
            quantity: quantity,
            category: product.category,
            author: product.author?.[0], // Assuming first author
            publisher: product.publisher,
            discountType: product.discountType,
            discountAmount: product.discountAmount,
          });
        }
      }

      // We might need to recalculate delivery charge based on new items if weight changes, 
      // but assuming deliveryCharge remains the same based on deliveryChargeType from previous order
      // Let's keep it simple and use the previous delivery charge or update if provided
      let deliveryCharge = order.deliveryCharge;
      if (customerUpdateOrderDto.deliveryChargeType) {
        deliveryCharge = customerUpdateOrderDto.deliveryChargeType === 'inside_dhaka' ? 60 : 120; // Or fetch from settings
      }

      const grandTotal = (subTotal - discountAmount) + deliveryCharge;

      await this.orderModel.findByIdAndUpdate(id, {
        $set: {
          orderedItems: updatedOrderedItems,
          subTotal: subTotal,
          discount: discountAmount,
          deliveryCharge: deliveryCharge,
          grandTotal: grandTotal,
          ...customerUpdateOrderDto.name && { name: customerUpdateOrderDto.name },
          ...customerUpdateOrderDto.phoneNo && { phoneNo: customerUpdateOrderDto.phoneNo },
          ...customerUpdateOrderDto.shippingAddress && { shippingAddress: customerUpdateOrderDto.shippingAddress },
          ...customerUpdateOrderDto.note && { note: customerUpdateOrderDto.note },
        }
      });

      return {
        success: true,
        message: 'Order updated successfully',
      };
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async updateOrderSessionKey(
    id: string,
    updateOrderDto: any,
  ): Promise<ResponsePayload> {
    try {
      await this.orderModel.findByIdAndUpdate(id, {
        $set: updateOrderDto,
      });

      return {
        success: true,
        message: 'Order updated successfully',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException();
    }
  }

  async changeOrderStatus(
    id: string,
    updateOrderStatusDto: UpdateOrderStatusDto,
    admin?: any,
  ): Promise<ResponsePayload> {
    const { orderStatus } = updateOrderStatusDto;

    let data;
    try {
      data = await this.orderModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }
    try {
      // console.log('updateOrderStatusDto', updateOrderStatusDto);
      let deliveryDate;
      let deliveryDateString;
      // console.log('orderStatus', orderStatus);
      if (orderStatus === 5) {
        deliveryDate = this.utilsService.getLocalDateTime();
        deliveryDateString = this.utilsService.getDateString(
          this.utilsService.getLocalDateTime(),
        );
      } else {
        deliveryDate = null;
        deliveryDateString = null;
      }

      // console.log('data', data);
      let orderTimeline;
      if (data.hasOrderTimeline) {
        orderTimeline = data.orderTimeline;
        if (orderStatus === OrderStatus.CONFIRM) {
          orderTimeline.confirmed = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: null,
          };
        } else if (orderStatus === OrderStatus.PROCESSING) {
          orderTimeline.processed = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: data.orderTimeline?.processed?.expectedDate || null,
          };
          if (!orderTimeline.confirmed?.success) {
            orderTimeline.confirmed = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: null,
            };
          }
        } else if (orderStatus === OrderStatus.SHIPPING || orderStatus === OrderStatus.SENT_TO_COURIER) {
          orderTimeline.shipped = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: data.orderTimeline?.shipped?.expectedDate || null,
          };
          if (!orderTimeline.confirmed?.success) {
            orderTimeline.confirmed = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: null,
            };
          }
          if (!orderTimeline.processed?.success) {
            orderTimeline.processed = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: data.orderTimeline?.processed?.expectedDate || null,
            };
          }
        } else if (orderStatus === OrderStatus.DELIVERED) {
          orderTimeline.delivered = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: data.orderTimeline?.delivered?.expectedDate || null,
          };
          if (!orderTimeline.confirmed?.success) {
            orderTimeline.confirmed = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: null,
            };
          }
          if (!orderTimeline.processed?.success) {
            orderTimeline.processed = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: data.orderTimeline?.processed?.expectedDate || null,
            };
          }
          if (!orderTimeline.shipped?.success) {
            orderTimeline.shipped = {
              success: true,
              date: this.utilsService.getLocalDateTime(),
              expectedDate: data.orderTimeline?.shipped?.expectedDate || null,
            };
          }
        } else if (orderStatus === OrderStatus.CANCEL) {
          orderTimeline.canceled = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: null,
          };
        } else if (orderStatus === OrderStatus.REFUND) {
          orderTimeline.refunded = {
            success: true,
            date: this.utilsService.getLocalDateTime(),
            expectedDate: null,
          };
        }
      } else {
        orderTimeline = null;
      }

      const mData: any = {
        courierLink: updateOrderStatusDto.courierLink,
        orderStatus: orderStatus,
        orderTimeline: orderTimeline,
        paymentStatus:
          orderStatus === OrderStatus.DELIVERED ? 'paid' : data.paymentStatus,
        deliveryDate: deliveryDate,
        deliveryDateString: deliveryDateString,
      };

      const updateData: any = {
        $set: mData,
      };

      if (admin) {
        mData.processedBy = admin._id;
        const logEntry = {
          adminId: admin._id,
          adminName: admin.name || admin.username,
          adminUsername: admin.username,
          adminRole: admin.role,
          action: 'Status Changed',
          description: `Status changed from ${this.getOrderStatusName(data.orderStatus)} to ${this.getOrderStatusName(orderStatus)} by ${admin.name || admin.username}`,
          beforeStatus: data.orderStatus,
          afterStatus: orderStatus,
          date: new Date(),
        };
        updateData.$push = { moderatorLogs: logEntry };
      } else if (updateOrderStatusDto['processedBy']) {
        mData.processedBy = updateOrderStatusDto['processedBy'];
      }

      await this.orderModel.findByIdAndUpdate(id, updateData);

      // if (orderStatus === 6) {
      //   for (const f of data['orderedItems']) {
      //     await this.productModel.findByIdAndUpdate(f._id, {
      //       $inc: {
      //         quantity: f.quantity,
      //       },
      //     });
      //   }
      // }

      // if (orderStatus === 5) {
      //   const message = `Your order No: ${data?.orderId} has been Delivered. Total Amount ${data?.grandTotal} Tk. Thanks from banglabazarbooks.com`;
      //   // const message = `অভিনন্দন! ${updateOrderStatusDto.name} আপনি সফলভাবে অর্ডারটি সম্পূর্ণ করেছেন।`;
      //   this.bulkSmsService.sentSingleSms(data.phoneNo, message);
      //   // console.log('orderStatus', data.phoneNo);
      if (orderStatus === 2) {
        const isSundarban = data?.courierData?.providerName?.toLowerCase()?.includes('sundarban');
        const isPaid = data?.paymentStatus === 'paid' || isSundarban || data?.paymentType !== 'cash_on_delivery';
        const paymentStatusText = isPaid ? 'Paid' : `Due: ৳${data?.grandTotal}`;
        const message = `Hi ${data?.name}, your order (${data?.orderId}) has been confirmed! Bill: ৳${data?.grandTotal} (${paymentStatusText}). Thanks from banglabazarbooks.com`;
        this.bulkSmsService.sentSingleSms(data.phoneNo, message);
      }

      if (orderStatus === 4) {
        //const message = `Your order No: ${data?.orderId} has been Shipped. Total Amount ${data?.grandTotal} Tk. Thanks from banglabazarbooks.com`;
        const message = `Hi ${data.name} \nwe just shipped your order from banglabazarbooks.com. Your order is estimated to arrive in 2-5 business days.`;
        // const message = `অভিনন্দন! ${updateOrderStatusDto.name} আপনি সফলভাবে অর্ডারটি সম্পূর্ণ করেছেন।`;
        this.bulkSmsService.sentSingleSms(data.phoneNo, message);
        // console.log('orderStatus', data.phoneNo);
      }

      if (orderStatus === 5) {
        for (const f of data['orderedItems']) {
          await this.productModel.findByIdAndUpdate(f._id, {
            $inc: {
              totalSold: f.quantity,
            },
          });

          await this.productModel.findByIdAndUpdate(f._id, {
            $inc: {
              quantity: -f.quantity,
            },
          });
        }
      }

      return {
        success: true,
        message: 'Order updated successfully',
      } as ResponsePayload;
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException();
    }
  }

  async checkFraudOrder(phoneNo: string): Promise<ResponsePayload> {
    try {
      const setting = await this.settingModel.findOne();

      let apiKey: string = 'bdc_c8pAQsIeRya4zEkRcJisJAbY63yZnvNMxRCkKZHvExYMVRtH77qZ6Jd0OyyT'; // Default fallback
      let isFree = true;

      if (setting && setting.fraudCheck) {
        if (setting.fraudCheck.apiKey) {
          apiKey = setting.fraudCheck.apiKey;
        }
        if (setting.fraudCheck.apiType) {
          isFree = setting.fraudCheck.apiType === 'free';
        }
      }

      const baseUrl = 'https://bdcourier.com/api';
      const endpoint = isFree ? '/courier-check' : '/pro/courier-check';
      const url = `${baseUrl}${endpoint}`;

      const response = await axios.post(
        url,
        {},
        {
          headers: {
            Authorization: 'Bearer ' + apiKey,
          },
          params: { phone: phoneNo },
        },
      );

      return {
        success: true,
        message: 'Fraud check completed',
        data: response.data,
      } as ResponsePayload;
    } catch (error) {
      this.logger.error('Failed to call fraud check api', error.response?.data || error.message);
      return {
        success: false,
        message: 'Failed to perform fraud check',
        data: null
      } as ResponsePayload;
    }
  }

  async generateInvoices(ids: string[]): Promise<ResponsePayload> {
    try {
      const objectIds = ids.map((id) => new Types.ObjectId(id));
      const orders = await this.orderModel.find({ _id: { $in: objectIds } });

      return {
        success: true,
        message: 'Success',
        data: orders,
      } as ResponsePayload;
    } catch (err) {
      console.log(err);
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * deleteOrderById
   * deleteMultipleOrderById
   */
  async deleteOrderById(
    id: string,
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    let data;
    try {
      data = await this.orderModel.findById(id);
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
    if (!data) {
      throw new NotFoundException('No Data found!');
    }
    try {
      await this.orderModel.findByIdAndDelete(id);
      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  async deleteMultipleOrderById(
    ids: string[],
    checkUsage: boolean,
  ): Promise<ResponsePayload> {
    try {
      await this.orderModel.deleteMany({ _id: { $in: ids } });
      return {
        success: true,
        message: 'Success',
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * COURIER INTEGRATION
   */
  /**
   * COURIER INTEGRATION
   */
  async sendToCourier(orderId: string, courierData?: any, admin?: any): Promise<ResponsePayload> {
    try {
      const settings = await this.settingModel.findOne({});
      let activeMethod;

      if (courierData?.providerName) {
        activeMethod = settings?.courierMethods?.find(m => m.providerName === courierData.providerName);
      }

      if (!activeMethod) {
        activeMethod = settings?.courierMethods?.find(m => m.status === 'active');
      }

      if (!activeMethod) {
        throw new BadRequestException('No active courier provider selected in Settings');
      }

      const provider = activeMethod.providerName.toLowerCase();

      if (provider.includes('steadfast')) {
        return await this.sendToSteadfast(orderId, activeMethod, admin);
      } else if (provider.includes('pathao')) {
        return await this.sendToPathao(orderId, activeMethod);
      } else if (provider.includes('redx')) {
        return await this.sendToRedX(orderId, activeMethod);
      } else {
        throw new BadRequestException(`Courier provider ${activeMethod.providerName} is not yet implemented`);
      }
    } catch (error) {
      throw error;
    }
  }

  async sendToSteadfast(orderId: string, method: any, admin?: any): Promise<ResponsePayload> {
    try {
      const order = await this.orderModel.findById(orderId);
      if (!order) throw new NotFoundException('Order not found');

      const apiKey = method.apiKey;
      const secretKey = method.secretKey;

      if (!apiKey || !secretKey) {
        throw new BadRequestException('Steadfast API Key or Secret Key is not configured');
      }

      // Prepare payload
      const payload = {
        invoice: order.orderId,
        recipient_name: order.name,
        recipient_phone: order.phoneNo,
        recipient_address: `${order.shippingAddress}, ${order.area?.name || ''}, ${order.city || order.division?.name || ''}`,
        cod_amount: order.paymentType === 'cash_on_delivery' ? order.grandTotal : 0,
        note: order.note || 'None'
      };

      // Make API Request
      const response = await axios.post(
        'https://portal.steadfast.com.bd/api/v1/create_order',
        payload,
        {
          headers: {
            'Api-Key': apiKey,
            'Secret-Key': secretKey,
            'Content-Type': 'application/json'
          }
        }
      );

      const responseData = response.data;
      if (responseData && responseData.status === 200 && responseData.consignment) {
        const trackingCode = responseData.consignment.tracking_code;
        const trackingLink = `https://steadfast.com.bd/t/${trackingCode}`;

        const updateData: any = {
          $set: {
            courierLink: trackingLink,
            orderStatus: OrderStatus.SENT_TO_COURIER,
            courierData: {
              providerName: 'Steadfast',
              consignmentId: responseData.consignment.consignment_id,
              trackingCode: trackingCode,
              trackingLink: trackingLink
            }
          }
        };

        if (admin) {
          updateData.$set.processedBy = admin._id;
          updateData.$push = {
            moderatorLogs: {
              adminId: admin._id,
              adminName: admin.name || admin.username,
              adminUsername: admin.username,
              adminRole: admin.role,
              action: 'Sent to Courier',
              description: `Dispatched to Steadfast Courier (Tracking: ${trackingCode}) by ${admin.name || admin.username}`,
              beforeStatus: order.orderStatus,
              afterStatus: OrderStatus.SENT_TO_COURIER,
              date: new Date(),
            }
          };
        }

        await this.orderModel.findByIdAndUpdate(orderId, updateData);

        return {
          success: true,
          message: 'Order sent to Steadfast successfully!',
          data: responseData.consignment
        };
      } else {
        throw new BadRequestException('Failed to create Steadfast consignment');
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.errors) {
        const messages = Object.values(error.response.data.errors).flat().join(', ');
        throw new BadRequestException(messages);
      }
      throw new InternalServerErrorException(error.message || 'Error communicating with Steadfast Courier');
    }
  }

  async sendToPathao(orderId: string, method: any): Promise<ResponsePayload> {
    // Pathao implementation would go here using method.apiKey, method.secretKey, method.storeId etc.
    throw new BadRequestException('Pathao integration is currently under development');
  }

  async sendToRedX(orderId: string, method: any): Promise<ResponsePayload> {
    // RedX implementation would go here using method.apiKey etc.
    throw new BadRequestException('RedX integration is currently under development');
  }

  async bulkSendToCourier(data: any, admin?: any): Promise<ResponsePayload> {
    try {
      const orderIds = data.ids;
      const courierData = data.courierData;

      let successCount = 0;
      let failCount = 0;
      const errors = [];

      for (const id of orderIds) {
        try {
          await this.sendToCourier(id, courierData, admin);
          successCount++;
        } catch (error) {
          failCount++;
          errors.push(`Order ${id}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Bulk Process Finished. Success: ${successCount}, Failed: ${failCount}`,
        data: errors,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  // New Order Make
  private async newOrderMake(orderData: any) {
    let cartItems: any[] = [];

    // Card Data Get
    if (!orderData?.user) {
      const fProducts = JSON.parse(
        JSON.stringify(
          await this.productModel.find({
            _id: { $in: orderData.carts.map((m) => new ObjectId(m)) },
          }),
        ),
      );

      // Fetch special package data if cartType is 1
      const fSpecialPackages = orderData.cartData
        .filter((item) => item.cartType === 1)
        .map((item) => item.specialPackage);

      const specialPackages = fSpecialPackages.length
        ? JSON.parse(
          JSON.stringify(
            await this.specialPackageModel.find({
              _id: { $in: fSpecialPackages.map((id) => new ObjectId(id)) },
            }),
          ),
        )
        : [];

      if ((fProducts && fProducts.length) || specialPackages) {
        cartItems = orderData.cartData.map((t1) => {
          const productFromFProducts = fProducts.find(
            (t2) => t2._id === t1.product,
          );
          const productFromSpecialPackages = specialPackages.find(
            (t2) => t2._id === t1.product,
          );
          return {
            ...t1,
            product: { ...productFromFProducts },
            specialPackage: { ...productFromSpecialPackages },
          };
        });
      }
    } else {
      cartItems = JSON.parse(
        JSON.stringify(
          await this.cartModel
            .find({ user: orderData.user })
            .populate(
              'product',
              'name nameEn slug author description publisher salePrice sku tax discountType discountAmount images quantity trackQuantity category subCategory brand tags unit freeDelivery isPreOrder',
            )
            .populate('specialPackage'),
        ),
      );
    }

    const finalData = cartItems
      .map((item: any) => {
        if (item.cartType === 1) {
          if (item.specialPackage) {
            const images = [item.specialPackage.image];
            return {
              ...item,
              product: { ...item.specialPackage, images },
            };
          }
          return null;
        }
        return item;
      })
      .filter((item) => item !== null && item.product && item.product._id);

    // Order Items

    const products: any = finalData.map((m) => ({
      _id: m.product._id,
      name: m.product.name,
      nameEn: m.product.nameEn,
      slug: m.product.slug,
      image: m.product.images?.[0] || null,
      category: {
        _id: m.product.category?._id,
        name: m.product.category?.name,
        slug: m.product.category?.slug,
      },
      author: {
        _id: m.product.author?._id,
        name: m.product.author?.name,
        slug: m.product.author?.slug,
      },
      publisher: {
        _id: m.product.publisher?._id,
        name: m.product.publisher?.name,
        slug: m.product.publisher?.slug,
      },
      subCategory: {
        _id: m.product.subCategory?._id,
        name: m.product.subCategory?.name,
        slug: m.product.subCategory?.slug,
      },
      brand: {
        _id: m.product.brand?._id,
        name: m.product.brand?.name,
        slug: m.product.brand?.slug,
      },
      discountType: m.product.discountType,
      discountAmount: m.product.discountAmount,
      regularPrice: this.utilsService.transform(m.product, 'regularPrice'),
      unitPrice: this.utilsService.transform(m.product, 'salePrice'),
      salePrice: this.utilsService.transform(m.product, 'salePrice'),
      quantity: m.selectedQty,
      orderType: (m.product?.isPreOrder || m.orderType === 'pre_order' || m.orderType === 'pre-order') ? 'pre_order' : 'regular',
    }));

    // Cart SubTotal
    const cartSubTotal = finalData.reduce(
      (acc, t) =>
        acc +
        this.utilsService.transform(t.product, 'regularPrice', t.selectedQty),
      0,
    );

    // Cart Total Sale Price
    const cartTotalSalePrice = finalData.reduce(
      (acc, t) =>
        acc +
        this.utilsService.transform(t.product, 'salePrice', t.selectedQty),
      0,
    );

    // Cart Discount Amount (Calculate exactly by difference to prevent Math.floor precision issues)
    const cartDiscountAmount = cartSubTotal - cartTotalSalePrice;

    // Coupon Discount
    const couponDiscount = await this.calculateCouponDiscount(
      cartSubTotal,
      orderData?.coupon,
    );

    // Order Discount
    const orderDiscount =
      cartSubTotal > 0
        ? await this.calculateOrderDiscount(
          cartSubTotal,
          orderData?.user,
          orderData.orderFrom,
        )
        : 0;

    // Check Free Delivery
    const hasFreeDelivery = finalData.some((item) => item.product && item.product.freeDelivery === true);

    let deliveryCharge = 0;
    if (orderData?.deliveryCharge !== undefined && orderData?.deliveryCharge !== null) {
      deliveryCharge = Number(orderData.deliveryCharge);
    } else if (!hasFreeDelivery) {
      const baseDelivery = 60;
      const tempTotal = cartSubTotal - couponDiscount - cartDiscountAmount - orderDiscount + baseDelivery;
      const extraCharge = Math.floor(tempTotal / 1000) * 15;
      deliveryCharge = baseDelivery + extraCharge;
    }

    const grandTotal = Math.round(cartSubTotal + deliveryCharge - couponDiscount - cartDiscountAmount - orderDiscount);

    // Grand Total (calculated above)

    // New Order Data
    const newOrderData = {
      name: orderData?.name,
      phoneNo: orderData?.phoneNo,
      shippingAddress: orderData?.shippingAddress,
      division: orderData?.division,
      note: orderData?.note,
      area: orderData?.area,
      zone: orderData?.zone,
      city: orderData?.city,
      paymentType: orderData?.paymentType,
      orderFrom: orderData?.orderFrom || 'Website',
      courierData: orderData?.courierData?.providerName
        ? { providerName: orderData.courierData.providerName }
        : undefined,
      country: orderData?.country,
      paymentStatus: 'unpaid',
      orderStatus: OrderStatus.PENDING,
      orderedItems: products,
      subTotal: cartSubTotal,
      deliveryCharge: deliveryCharge,
      discount: cartDiscountAmount.toFixed(2),
      totalSave: cartDiscountAmount,
      grandTotal,
      discountTypes: [{ productDiscount: cartDiscountAmount.toFixed(2) }],
      checkoutDate: this.utilsService.getDateString(new Date()),
      user: orderData?.user || null,
      email: orderData?.email || null,
      coupon: orderData?.coupon ?? null,
      couponDiscount,
      hasOrderTimeline: true,
      orderTimeline: orderData?.orderTimeline,
      hasPreOrder: products.some((p: any) => p.orderType === 'pre_order') ||
        finalData.some((item: any) => item.product?.isPreOrder === true),
    };

    return newOrderData;
  }

  // Calculate Coupon Discount
  async calculateCouponDiscount(
    cartSubTotal: number,
    couponId: any,
  ): Promise<ResponsePayload | any> {
    // Coupon data
    const coupon = JSON.parse(
      JSON.stringify(await this.couponModel.findOne({ _id: couponId })),
    );

    if (!coupon) {
      return 0;
    }

    const discount =
      coupon.discountType === DiscountTypeEnum.PERCENTAGE
        ? Math.floor((coupon.discountAmount / 100) * cartSubTotal)
        : Math.floor(coupon.discountAmount);

    return discount;
  }

  // Calculate Order Discount
  async calculateOrderDiscount(
    cartSubTotal: number,
    userId: any,
    orderFrom: any,
  ): Promise<ResponsePayload | any> {
    // Order Offer Data

    const fOrderOfferData = await this.orderOfferModel.findOne({});

    const orderOfferData = JSON.parse(JSON.stringify(fOrderOfferData));
    let finalData: any;
    let orderDiscount = 0;
    let orderDiscountFromApps = 0;

    // Order Offer Data

    if (orderOfferData) {
      // Order Count
      const orderCount = await this.orderModel.countDocuments({
        user: new ObjectId(userId),
      });
      const currentMonth = this.utilsService.getDateMonth(false, new Date());
      const currentYear = this.utilsService.getDateYear(new Date());

      // Order In Month
      const orderInMonth = await this.orderModel.find({
        user: new ObjectId(userId),
        month: currentMonth,
        year: currentYear,
      });
      const jOrderInMonth = JSON.parse(JSON.stringify(orderInMonth));

      let hasMonthDiscount = false;

      for (const data of jOrderInMonth) {
        if (data.hasMonthDiscount) {
          hasMonthDiscount = true;
        }
      }

      const orderInMonthAmount = jOrderInMonth
        .map((m: any) => m.grandTotal)
        .reduce((acc: number, value: number) => acc + value, 0);

      if (orderCount === 0) {
        finalData = {
          ...orderOfferData,
          ...{
            hasFirstOrderDiscount: true,
          },
        };
      } else {
        finalData = {
          ...orderOfferData,
          ...{
            hasFirstOrderDiscount: false,
            orderInMonthAmount: hasMonthDiscount ? 0 : orderInMonthAmount,
          },
        };
      }
    } else {
      finalData = {
        ...orderOfferData,
        ...{
          hasFirstOrderDiscount: false,
          orderInMonthAmount: null,
        },
      };
    }

    // Final Data
    if (finalData) {
      if (
        cartSubTotal >= finalData.amount3OrderMinAmount &&
        cartSubTotal < finalData.monthOrderMinAmount
      ) {
        if (
          finalData.amount3OrderDiscountType === DiscountTypeEnum.PERCENTAGE
        ) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.amount3OrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.amount3OrderDiscountAmount,
          );
        }
      } else if (
        cartSubTotal >= finalData.amount3OrderMinAmount &&
        finalData.monthOrderMinAmount! >= 0
      ) {
        if (
          finalData.amount3OrderDiscountType === DiscountTypeEnum.PERCENTAGE
        ) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.amount3OrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.amount3OrderDiscountAmount,
          );
        }
      } else if (
        cartSubTotal >= finalData.amount2OrderMinAmount &&
        cartSubTotal < finalData.amount3OrderMinAmount
      ) {
        if (
          finalData.amount2OrderDiscountType === DiscountTypeEnum.PERCENTAGE
        ) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.amount2OrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.amount2OrderDiscountAmount,
          );
        }
      } else if (
        cartSubTotal >= finalData.amountOrderMinAmount &&
        cartSubTotal < finalData.amount2OrderMinAmount
      ) {
        if (finalData.amountOrderDiscountType === DiscountTypeEnum.PERCENTAGE) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.amountOrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.amountOrderDiscountAmount,
          );
        }
      } else if (
        finalData.hasFirstOrderDiscount &&
        cartSubTotal >= finalData.firstOrderDiscountAmount &&
        cartSubTotal < finalData.amountOrderMinAmount
      ) {
        if (finalData.firstOrderDiscountType === DiscountTypeEnum.PERCENTAGE) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.firstOrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.firstOrderDiscountAmount,
          );
        }
      } else if (
        finalData.orderInMonthAmount >= finalData.monthOrderValue &&
        finalData.monthOrderMinAmount <= cartSubTotal
      ) {
        if (finalData.monthOrderDiscountType === DiscountTypeEnum.PERCENTAGE) {
          orderDiscount = this.utilsService.roundNumber(
            (finalData.monthOrderDiscountAmount / 100) * cartSubTotal,
          );
        } else {
          orderDiscount = this.utilsService.roundNumber(
            finalData.monthOrderDiscountAmount,
          );
        }
      }

      // Order Discount From Apps

      if (orderFrom && orderFrom === 'Apps') {
        if (
          finalData.appsOrderMinAmount &&
          cartSubTotal >= finalData.appsOrderMinAmount
        ) {
          if (finalData.appsOrderDiscountType === DiscountTypeEnum.PERCENTAGE) {
            orderDiscountFromApps = this.utilsService.roundNumber(
              (finalData.appsOrderDiscountAmount / 100) * cartSubTotal,
            );
          } else {
            orderDiscountFromApps = this.utilsService.roundNumber(
              finalData.appsOrderDiscountAmount,
            );
          }
        }
      }

      return orderDiscount + orderDiscountFromApps;
    }
  }

  async getTabCounts(filterOrderDto: any, searchString: string): Promise<ResponsePayload> {
    try {
      let mFilter = filterOrderDto?.filter ? { ...filterOrderDto.filter } : {};

      // Remove orderStatus from count filter to get counts for all tabs
      if (mFilter && mFilter['orderStatus']) {
        delete mFilter['orderStatus'];
      }

      if (searchString && searchString !== 'null') {
        const searchRegExp = new RegExp(searchString, 'i');
        mFilter = {
          ...mFilter,
          $or: [
            { orderId: searchRegExp },
            { phoneNo: searchRegExp },
            { name: searchRegExp },
          ],
        };
      }

      const aggregate = [
        { $match: mFilter },
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
          },
        },
      ];

      const result = await this.orderModel.aggregate(aggregate);

      const tabCounts = {};
      // Initialize all statuses to 0
      const statuses = [1, 2, 3, 4, 5, 6, 7, 8];
      statuses.forEach(s => tabCounts[s] = 0);

      result.forEach((item) => {
        if (item._id !== null && item._id !== undefined) {
          tabCounts[item._id] = item.count;
        }
      });

      // Total count
      const totalCount = await this.orderModel.countDocuments(mFilter);
      tabCounts['all'] = totalCount;

      return {
        success: true,
        message: 'Success',
        data: tabCounts,
      };
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async parseRawText(
    parseRawTextDto: ParseRawTextDto,
  ): Promise<ResponsePayload> {
    try {
      const rawText = parseRawTextDto.rawText;

      // Basic extraction for phone number
      const phoneRegex = /(?:\+?88|0088)?\s*01[3-9](?:[\s-]*\d){7,9}/;
      const phoneMatch = rawText.match(phoneRegex);
      const phoneNo = phoneMatch ? phoneMatch[0].replace(/[\s-]/g, '') : '';

      // Basic extraction for name and address using common keywords
      const nameMatch = rawText.match(/(?:Name|নাম)\s*[:-]?\s*(.*?)(?=\n|,|Address|Phone|ঠিকানা|ফোন|Boi|Book|বই|$)/i);
      const name = nameMatch ? nameMatch[1].trim() : '';

      const addressMatch = rawText.match(/(?:Address|ঠিকানা)\s*[:-]?\s*(.*?)(?=\n|Name|Phone|নাম|ফোন|Boi|Book|বই|$)/i);
      const shippingAddress = addressMatch ? addressMatch[1].trim() : '';

      let matchedProducts = [];

      // Simulate UI search logic by using a regex on the raw text
      // We will search for products where the name matches parts of the raw text
      // UI search typically does: name: { $regex: searchString, $options: 'i' }

      // Split the text into potential search phrases by commas or newlines
      const phrases = rawText.split(/[,\n\r]+/).map(p => p.trim()).filter(p => p.length > 2);

      for (const phrase of phrases) {
        // Try to find a product matching this phrase
        const searchRegExp = new RegExp(phrase, 'i');
        const matched = await this.productModel
          .find({ name: searchRegExp })
          .select('name slug brand images category subCategory publisher costPrice salePrice regularPrice discountType discountAmount hasVariations variations variationsOptions status unit _id')
          .limit(3);

        if (matched && matched.length > 0) {
          matchedProducts.push(...matched);
        }
      }

      // Remove duplicates
      matchedProducts = matchedProducts.filter((v, i, a) => a.findIndex(t => (t._id.toString() === v._id.toString())) === i);

      // Detect courier if mentioned in chat text
      let courier = null;
      if (/সুন্দরবন|sundarban/i.test(rawText)) {
        courier = 'Sundarban Courier';
      } else if (/পাঠাও|pathao/i.test(rawText)) {
        courier = 'Pathao Courier';
      } else if (/steadfast|স্ট্যাডফাস্ট/i.test(rawText)) {
        courier = 'Steadfast Courier';
      } else if (/redx/i.test(rawText)) {
        courier = 'REDX';
      }

      return {
        success: true,
        message: 'Parsed locally',
        data: {
          customer: {
            name: name,
            phoneNo: phoneNo,
            shippingAddress: shippingAddress,
            courier: courier,
          },
          matchedProducts,
        },
      };
    } catch (error) {
      console.log('Parsing Error:', error);
      throw new InternalServerErrorException(error.message || 'Error parsing raw text');
    }
  }

  private getOrderStatusName(status: number): string {
    switch (status) {
      case OrderStatus.PENDING:
        return 'Pending';
      case OrderStatus.CONFIRM:
        return 'Confirmed';
      case OrderStatus.PROCESSING:
        return 'Processing';
      case OrderStatus.SHIPPING:
        return 'Shipped';
      case OrderStatus.DELIVERED:
        return 'Delivered';
      case OrderStatus.CANCEL:
        return 'Canceled';
      case OrderStatus.REFUND:
        return 'Refunded';
      case OrderStatus.DRAFT:
        return 'Draft';
      case OrderStatus.SENT_TO_COURIER:
        return 'Sent to Courier';
      default:
        return `Status (${status})`;
    }
  }

  /**
   * MODERATOR ACTIVITY REPORT
   */
  async getModeratorActivityReport(
    filterDto: ModeratorActivityFilterDto,
  ): Promise<ResponsePayload> {
    try {
      const {
        adminId,
        startDate,
        endDate,
        actionType,
        page = 1,
        pageSize = 20,
        search,
      } = filterDto;

      // 1. Fetch all admins with relevant roles
      const allAdmins = await this.adminModel
        .find({
          role: {
            $in: [
              AdminRoles.MODERATOR,
              AdminRoles.ADMIN,
              AdminRoles.SUPER_ADMIN,
              AdminRoles.SALESMAN,
              AdminRoles.EDITOR,
            ],
          },
        })
        .select('name username role profileImg')
        .lean();

      // Build date filters for moderatorLogs.date
      const dateFilter: any = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        dateFilter.$lte = endD;
      }

      // Build match stage for unwinded logs
      const matchLog: any = {};
      if (adminId) {
        matchLog['moderatorLogs.adminId'] = new ObjectId(adminId);
      }
      if (Object.keys(dateFilter).length > 0) {
        matchLog['moderatorLogs.date'] = dateFilter;
      }
      if (actionType) {
        matchLog['moderatorLogs.action'] = actionType;
      }
      if (search) {
        const regex = new RegExp(search, 'i');
        matchLog.$or = [
          { orderId: regex },
          { name: regex },
          { phoneNo: regex },
          { 'moderatorLogs.adminName': regex },
          { 'moderatorLogs.adminUsername': regex },
        ];
      }

      // Aggregation pipeline to get logs with order details
      const pipeline: any[] = [
        { $match: { moderatorLogs: { $exists: true, $ne: [] } } },
        { $unwind: '$moderatorLogs' },
        { $match: matchLog },
        { $sort: { 'moderatorLogs.date': -1 } },
      ];

      // Aggregation for Stats per moderator
      const statsPipeline = [
        ...pipeline,
        {
          $group: {
            _id: '$moderatorLogs.adminId',
            adminName: { $first: '$moderatorLogs.adminName' },
            adminUsername: { $first: '$moderatorLogs.adminUsername' },
            adminRole: { $first: '$moderatorLogs.adminRole' },
            totalActions: { $sum: 1 },
            ordersCreated: {
              $sum: {
                $cond: [{ $eq: ['$moderatorLogs.action', 'Order Created'] }, 1, 0],
              },
            },
            statusChanges: {
              $sum: {
                $cond: [{ $eq: ['$moderatorLogs.action', 'Status Changed'] }, 1, 0],
              },
            },
            ordersEdited: {
              $sum: {
                $cond: [{ $eq: ['$moderatorLogs.action', 'Order Edited'] }, 1, 0],
              },
            },
            sentToCourier: {
              $sum: {
                $cond: [{ $eq: ['$moderatorLogs.action', 'Sent to Courier'] }, 1, 0],
              },
            },
            uniqueOrders: { $addToSet: '$_id' },
            lastActive: { $max: '$moderatorLogs.date' },
          },
        },
      ];

      // Aggregation for System Status Breakdown
      const statusMatch: any = {};
      if (startDate || endDate) {
        const dateCond: any = {};
        if (startDate) dateCond.$gte = new Date(startDate);
        if (endDate) {
          const endD = new Date(endDate);
          endD.setHours(23, 59, 59, 999);
          dateCond.$lte = endD;
        }
        statusMatch.$or = [
          { createdAt: dateCond },
          { updatedAt: dateCond },
          { 'moderatorLogs.date': dateCond },
          { deliveryDate: dateCond },
        ];
      }
      if (adminId) {
        const adminCond = [
          { 'moderatorLogs.adminId': new ObjectId(adminId) },
          { processedBy: new ObjectId(adminId) },
        ];
        if (statusMatch.$or) {
          statusMatch.$and = [
            { $or: statusMatch.$or },
            { $or: adminCond },
          ];
          delete statusMatch.$or;
        } else {
          statusMatch.$or = adminCond;
        }
      }

      const statusCountsPipeline: any[] = [
        ...(Object.keys(statusMatch).length > 0 ? [{ $match: statusMatch }] : []),
        {
          $group: {
            _id: '$orderStatus',
            count: { $sum: 1 },
            totalAmount: { $sum: '$grandTotal' },
          },
        },
      ];

      // Confirmed Orders Pipeline to track delivery performance per moderator
      const confirmedOrdersPipeline: any[] = [
        ...(Object.keys(statusMatch).length > 0 ? [{ $match: statusMatch }] : []),
        {
          $match: {
            $or: [
              {
                'moderatorLogs.afterStatus': {
                  $in: [
                    OrderStatus.CONFIRM,
                    OrderStatus.PROCESSING,
                    OrderStatus.SHIPPING,
                    OrderStatus.SENT_TO_COURIER,
                    OrderStatus.DELIVERED,
                    OrderStatus.CANCEL,
                    OrderStatus.REFUND,
                  ],
                },
              },
              {
                processedBy: { $exists: true, $ne: null },
                orderStatus: {
                  $in: [
                    OrderStatus.CONFIRM,
                    OrderStatus.PROCESSING,
                    OrderStatus.SHIPPING,
                    OrderStatus.SENT_TO_COURIER,
                    OrderStatus.DELIVERED,
                    OrderStatus.CANCEL,
                    OrderStatus.REFUND,
                  ],
                },
              },
            ],
          },
        },
        {
          $project: {
            orderId: 1,
            orderStatus: 1,
            grandTotal: 1,
            processedBy: 1,
            moderatorLogs: 1,
            confirmLog: {
              $filter: {
                input: { $ifNull: ['$moderatorLogs', []] },
                as: 'log',
                cond: { $eq: ['$$log.afterStatus', OrderStatus.CONFIRM] },
              },
            },
          },
        },
      ];

      const [
        statsResult,
        paginatedLogsResult,
        totalLogsResult,
        rawStatusCounts,
        confirmedOrdersResult,
      ] = await Promise.all([
        this.orderModel.aggregate(statsPipeline),
        this.orderModel.aggregate([
          ...pipeline,
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
          {
            $project: {
              _id: '$moderatorLogs._id',
              logId: '$moderatorLogs._id',
              orderDbId: '$_id',
              orderId: '$orderId',
              customerName: '$name',
              customerPhone: '$phoneNo',
              grandTotal: '$grandTotal',
              currentStatus: '$orderStatus',
              adminId: '$moderatorLogs.adminId',
              adminName: '$moderatorLogs.adminName',
              adminUsername: '$moderatorLogs.adminUsername',
              adminRole: '$moderatorLogs.adminRole',
              action: '$moderatorLogs.action',
              description: '$moderatorLogs.description',
              beforeStatus: '$moderatorLogs.beforeStatus',
              afterStatus: '$moderatorLogs.afterStatus',
              date: '$moderatorLogs.date',
            },
          },
        ]),
        this.orderModel.aggregate([...pipeline, { $count: 'total' }]),
        this.orderModel.aggregate(statusCountsPipeline),
        this.orderModel.aggregate(confirmedOrdersPipeline),
      ]);

      const totalCount = totalLogsResult[0]?.total || 0;

      // Status breakdown summary
      const statusSummary = {
        pending: 0,
        confirm: 0,
        processing: 0,
        shipping: 0,
        delivered: 0,
        cancel: 0,
        refund: 0,
        sentToCourier: 0,
        draft: 0,
        totalOrders: 0,
        totalAmount: 0,
      };

      rawStatusCounts.forEach((item) => {
        const count = item.count || 0;
        const amt = item.totalAmount || 0;
        statusSummary.totalOrders += count;
        statusSummary.totalAmount += amt;

        switch (item._id) {
          case OrderStatus.PENDING:
            statusSummary.pending += count;
            break;
          case OrderStatus.CONFIRM:
            statusSummary.confirm += count;
            break;
          case OrderStatus.PROCESSING:
            statusSummary.processing += count;
            break;
          case OrderStatus.SHIPPING:
            statusSummary.shipping += count;
            break;
          case OrderStatus.DELIVERED:
            statusSummary.delivered += count;
            break;
          case OrderStatus.CANCEL:
            statusSummary.cancel += count;
            break;
          case OrderStatus.REFUND:
            statusSummary.refund += count;
            break;
          case OrderStatus.SENT_TO_COURIER:
            statusSummary.sentToCourier += count;
            break;
          case OrderStatus.DRAFT:
            statusSummary.draft += count;
            break;
        }
      });

      // Delivery Performance per Moderator
      const deliveryStatsMap = new Map();
      allAdmins.forEach((adm) => {
        deliveryStatsMap.set(adm._id.toString(), {
          adminId: adm._id,
          name: adm.name || adm.username,
          username: adm.username,
          role: adm.role,
          profileImg: adm.profileImg,
          totalConfirmed: 0,
          delivered: 0,
          sentToCourier: 0,
          shipping: 0,
          processing: 0,
          confirmPending: 0,
          cancelled: 0,
          refunded: 0,
          otherStatus: 0,
          confirmedAmount: 0,
          deliveredAmount: 0,
          deliveryRate: 0,
        });
      });

      confirmedOrdersResult.forEach((order) => {
        let adminIdStr = '';
        let adminObj: any = null;

        // 1. Moderator who confirmed the order
        if (order.confirmLog && order.confirmLog.length > 0) {
          const log = order.confirmLog[0];
          adminIdStr = log.adminId ? log.adminId.toString() : '';
          adminObj = log;
        }

        // 2. Moderator who delivered or sent to courier or processed
        if (!adminIdStr && order.moderatorLogs && order.moderatorLogs.length > 0) {
          const deliveryLog = order.moderatorLogs.find((l: any) =>
            [
              OrderStatus.DELIVERED,
              OrderStatus.SENT_TO_COURIER,
              OrderStatus.SHIPPING,
              OrderStatus.PROCESSING,
            ].includes(l.afterStatus),
          );
          if (deliveryLog && deliveryLog.adminId) {
            adminIdStr = deliveryLog.adminId.toString();
            adminObj = deliveryLog;
          }
        }

        // 3. order.processedBy
        if (!adminIdStr && order.processedBy) {
          adminIdStr = order.processedBy.toString();
        }

        // 4. Any log in moderatorLogs
        if (!adminIdStr && order.moderatorLogs && order.moderatorLogs.length > 0) {
          const anyLog = order.moderatorLogs[0];
          if (anyLog && anyLog.adminId) {
            adminIdStr = anyLog.adminId.toString();
            adminObj = anyLog;
          }
        }

        if (!adminIdStr) return;

        if (!deliveryStatsMap.has(adminIdStr)) {
          deliveryStatsMap.set(adminIdStr, {
            adminId: adminIdStr,
            name: adminObj?.adminName || 'Admin',
            username: adminObj?.adminUsername || 'admin',
            role: adminObj?.adminRole || 'admin',
            totalConfirmed: 0,
            delivered: 0,
            sentToCourier: 0,
            shipping: 0,
            processing: 0,
            confirmPending: 0,
            cancelled: 0,
            refunded: 0,
            otherStatus: 0,
            confirmedAmount: 0,
            deliveredAmount: 0,
            deliveryRate: 0,
          });
        }

        const stat = deliveryStatsMap.get(adminIdStr);
        stat.totalConfirmed++;
        stat.confirmedAmount += order.grandTotal || 0;

        switch (order.orderStatus) {
          case OrderStatus.DELIVERED:
            stat.delivered++;
            stat.deliveredAmount += order.grandTotal || 0;
            break;
          case OrderStatus.SENT_TO_COURIER:
            stat.sentToCourier++;
            break;
          case OrderStatus.SHIPPING:
            stat.shipping++;
            break;
          case OrderStatus.PROCESSING:
            stat.processing++;
            break;
          case OrderStatus.CONFIRM:
            stat.confirmPending++;
            break;
          case OrderStatus.CANCEL:
            stat.cancelled++;
            break;
          case OrderStatus.REFUND:
            stat.refunded++;
            break;
          default:
            stat.otherStatus++;
            break;
        }
      });

      const deliveryLeaderboard = Array.from(deliveryStatsMap.values()).map(
        (stat: any) => {
          const rate =
            stat.totalConfirmed > 0
              ? Math.round((stat.delivered / stat.totalConfirmed) * 100)
              : 0;
          return {
            ...stat,
            deliveryRate: rate,
          };
        },
      );

      // Sort by highest delivered orders first
      deliveryLeaderboard.sort(
        (a: any, b: any) =>
          b.delivered - a.delivered || b.deliveryRate - a.deliveryRate,
      );

      const topModerator =
        deliveryLeaderboard.length > 0 && deliveryLeaderboard[0].delivered > 0
          ? deliveryLeaderboard[0]
          : deliveryLeaderboard.length > 0 &&
            deliveryLeaderboard[0].totalConfirmed > 0
            ? deliveryLeaderboard[0]
            : null;

      // Moderator stats list mapped with all known admins
      const moderatorStatsMap = new Map();
      allAdmins.forEach((adm) => {
        moderatorStatsMap.set(adm._id.toString(), {
          adminId: adm._id,
          name: adm.name || adm.username,
          username: adm.username,
          role: adm.role,
          profileImg: adm.profileImg,
          totalActions: 0,
          ordersCreated: 0,
          statusChanges: 0,
          ordersEdited: 0,
          sentToCourier: 0,
          uniqueOrdersCount: 0,
          lastActive: null,
        });
      });

      statsResult.forEach((item) => {
        const idStr = item._id ? item._id.toString() : '';
        const existing = moderatorStatsMap.get(idStr) || {
          adminId: item._id,
          name: item.adminName || item.adminUsername || 'Unknown',
          username: item.adminUsername,
          role: item.adminRole,
          totalActions: 0,
          ordersCreated: 0,
          statusChanges: 0,
          ordersEdited: 0,
          sentToCourier: 0,
          uniqueOrdersCount: 0,
          lastActive: null,
        };
        existing.totalActions = item.totalActions;
        existing.ordersCreated = item.ordersCreated;
        existing.statusChanges = item.statusChanges;
        existing.ordersEdited = item.ordersEdited;
        existing.sentToCourier = item.sentToCourier;
        existing.uniqueOrdersCount = item.uniqueOrders ? item.uniqueOrders.length : 0;
        existing.lastActive = item.lastActive;
        moderatorStatsMap.set(idStr, existing);
      });

      const moderatorStats = Array.from(moderatorStatsMap.values());

      // Overall Summary
      const summary = {
        totalActions: totalCount,
        ordersCreated: statsResult.reduce((acc, curr) => acc + curr.ordersCreated, 0),
        statusChanges: statsResult.reduce((acc, curr) => acc + curr.statusChanges, 0),
        ordersEdited: statsResult.reduce((acc, curr) => acc + curr.ordersEdited, 0),
        sentToCourier: statsResult.reduce((acc, curr) => acc + curr.sentToCourier, 0),
        activeModeratorsCount: statsResult.filter((s) => s.totalActions > 0).length,
      };

      return {
        success: true,
        data: {
          summary,
          moderatorStats,
          statusSummary,
          deliveryLeaderboard,
          topModerator,
          logs: paginatedLogsResult,
          count: totalCount,
          allAdmins: allAdmins.map((a) => ({
            _id: a._id,
            name: a.name || a.username,
            username: a.username,
            role: a.role,
          })),
        },
      } as ResponsePayload;
    } catch (err) {
      this.logger.error(err);
      throw new InternalServerErrorException(err.message);
    }
  }
}
