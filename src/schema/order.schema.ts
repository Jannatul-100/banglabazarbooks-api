import * as mongoose from 'mongoose';
import { ORDER_ITEM_SCHEMA } from './sub-schema.schema';
import { Schema } from 'mongoose';

export const OrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNo: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    shippingAddress: {
      type: String,
      required: true,
    },
    zone: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Zone',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    },
    division: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Division',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    },
    area: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Area',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
    },
    paymentType: {
      type: String,
      required: false,
    },
    orderFrom: {
      type: String,
      required: false,
    },
    paymentStatus: {
      type: String,
      required: true,
    },
    courierLink: {
      type: String,
      required: false,
    },
    courierData: {
      providerName: { type: String, required: false },
      consignmentId: { type: String, required: false },
      trackingCode: { type: String, required: false },
      trackingLink: { type: String, required: false },
    },
    orderedItems: [ORDER_ITEM_SCHEMA],
    subTotal: {
      type: Number,
      required: true,
    },
    deliveryCharge: {
      type: Number,
      required: false,
    },
    discount: {
      type: Number,
      required: true,
    },
    additionalDiscount: {
      type: Number,
      required: false,
      default: 0,
    },
    extraDiscount: {
      type: Number,
      required: false,
      default: 0,
    },
    orderDiscountFromApps: {
      type: Number,
      required: false,
    },
    month: {
      type: Number,
      required: false,
    },
    year: {
      type: Number,
      required: false,
    },
    productDiscount: {
      type: Number,
      required: false,
    },
    sslSessionId: {
      type: String,
      required: false,
    },
    bkashPaymentId: {
      type: String,
      required: false,
    },
    bkashTrxId: {
      type: String,
      required: false,
    },
    refundTrxID: {
      type: String,
      required: false,
    },
    nagadPaymentId: {
      type: String,
      required: false,
    },
    grandTotal: {
      type: Number,
      required: false,
    },
    discountTypes: {
      type: [Object],
      required: false,
    },
    checkoutDate: {
      type: String,
      required: false,
    },
    deliveryDate: {
      type: Date,
      required: false,
    },
    packingImage: {
      type: String,
      required: false,
    },
    deliveryDateString: {
      type: String,
      required: false,
    },
    orderStatus: {
      type: Number,
      required: true,
    },
    hasOrderTimeline: {
      type: Boolean,
      required: false,
    },
    orderTimeline: {
      type: Object,
      required: false,
    },
    processingDate: {
      type: Date,
      required: false,
    },
    shippingDate: {
      type: Date,
      required: false,
    },
    deliveringDate: {
      type: Date,
      required: false,
    },
    preferredDateString: {
      type: String,
      required: false,
    },
    preferredTime: {
      type: String,
      required: false,
    },
    note: {
      type: String,
      required: false,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    coupon: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: false,
    },
    couponDiscount: {
      type: Number,
      required: false,
    },
    fraudChecker: {
      courierData: {
        summary: {
          total_parcel: { type: Number, required: false, default: 0 },
          success_parcel: { type: Number, required: false, default: 0 },
          cancelled_parcel: { type: Number, required: false, default: 0 },
          success_ratio: { type: Number, required: false, default: 0 },
        },
      },
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: false,
    },
    createdByAdmin: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
      required: false,
    },
    moderatorLogs: [
      {
        adminId: {
          type: Schema.Types.ObjectId,
          ref: 'Admin',
          required: false,
        },
        adminName: {
          type: String,
          required: false,
        },
        adminUsername: {
          type: String,
          required: false,
        },
        adminRole: {
          type: String,
          required: false,
        },
        action: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: false,
        },
        beforeStatus: {
          type: Number,
          required: false,
        },
        afterStatus: {
          type: Number,
          required: false,
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    packingPhotoUrl: {
      type: String,
      required: false,
    },
    hasPreOrder: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
