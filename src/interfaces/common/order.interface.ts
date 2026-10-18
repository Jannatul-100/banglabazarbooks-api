import { Area } from './area.interface';
import { Zone } from './zone.interface';
import { Division } from './division.interface';

export interface Order {
  _id: string;
  orderId: string;
  discountTypes: DiscountType;
  name: string;
  phoneNo: string;
  email: string;
  city: string;
  courierLink: string;
  shippingAddress: string;
  paymentType: string;
  orderedItems: OrderedItem[];
  subTotal: number;
  area?: Area;
  division?: Division;
  zone?: Zone;
  deliveryCharge: number;
  discount: number;
  grandTotal: number;
  checkoutDate: string;
  deliveryDate?: any;
  paymentStatus: string;
  orderStatus: number;
  sslSessionId: string;
  bkashPaymentId?: string;
  bkashTrxId?: string;
  refundTrxID?: string;
  hasOrderTimeline?: boolean;
  processingDate?: Date;
  shippingDate?: Date;
  deliveringDate?: Date;
  preferredDate?: Date;
  preferredTime?: string;
  orderTimeline?: OrderTimeline;
  user?: string;
  productDiscount?: number;
  note?: string;
  processedBy?: any;
  createdByAdmin?: any;
  moderatorLogs?: OrderModeratorLog[];
  packingImage?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface OrderModeratorLog {
  adminId?: any;
  adminName?: string;
  adminUsername?: string;
  adminRole?: string;
  action: string;
  description?: string;
  beforeStatus?: number;
  afterStatus?: number;
  date?: Date;
}

export interface OrderedItem {
  _id: string;
  name: string;
  slug: string;
  image: string;
  category: any;
  subCategory: any;
  publisher: any;
  author?: any;
  brand: any;
  regularPrice: number;
  unitPrice: number;
  quantity: number;
  orderType: string;
}

export interface OrderTimeline {
  confirmed: OrderTimelineType;
  processed: OrderTimelineType;
  shipped: OrderTimelineType;
  delivered: OrderTimelineType;
  canceled: OrderTimelineType;
  refunded: OrderTimelineType;
}

export interface DiscountType {
  type: string;
  amount: number;
}

export interface OrderTimelineType {
  success: boolean;
  date?: Date;
  expectedDate?: Date;
}
