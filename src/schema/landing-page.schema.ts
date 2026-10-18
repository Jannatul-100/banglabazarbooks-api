import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';

export const LandingPageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'publish',
    },
    template: {
      type: String,
      default: 'v1',
    },
    brandTagline: {
      type: String,
      required: false,
    },
    badgeText: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    titleHighlight: {
      type: String,
      required: false,
    },
    subtitle: {
      type: String,
      required: false,
    },
    heroImage: {
      type: String,
      required: false,
    },
    images: {
      type: [String],
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    featuresTitle: {
      type: String,
      required: false,
    },
    features: {
      type: [Object],
      required: false,
    },
    featuresContent: {
      type: String,
      required: false,
    },
    heroPoints: {
      type: [String],
      required: false,
    },
    resourceCardTitle: {
      type: String,
      required: false,
    },
    resourceCardSubtitle: {
      type: String,
      required: false,
    },
    leadFormTitle: {
      type: String,
      required: false,
    },
    leadFormSubtitle: {
      type: String,
      required: false,
    },
    leadFormNote: {
      type: String,
      required: false,
    },
    leadFormButtonText: {
      type: String,
      required: false,
    },
    leadFormTrustItems: {
      type: [Object],
      required: false,
    },
    benefitsTitle: {
      type: String,
      required: false,
    },
    benefitCards: {
      type: [Object],
      required: false,
    },
    headerBadges: {
      type: [String],
      required: false,
    },
    footerStats: {
      type: [Object],
      required: false,
    },
    downloadFileUrl: {
      type: String,
      required: false,
    },
    insidePagesTitle: {
      type: String,
      required: false,
    },
    insidePages: {
      type: [String],
      required: false,
    },
    trustItems: {
      type: [Object],
      required: false,
    },
    productSectionTitle: {
      type: String,
      required: false,
    },
    productSectionSubtitle: {
      type: String,
      required: false,
    },
    salePrice: {
      type: Number,
      required: false,
    },
    originalPrice: {
      type: Number,
      required: false,
    },
    discountPercent: {
      type: Number,
      required: false,
    },
    primaryColor: {
      type: String,
      default: '#1a4d2e',
    },
    videoUrl: {
      type: String,
      required: false,
    },
    endDate: {
      type: String,
      required: false,
    },
    seoTitle: {
      type: String,
      required: false,
    },
    seoDescription: {
      type: String,
      required: false,
    },
    products: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    productInfo: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: false,
        },
        name: { type: String, required: false },
        nameEn: { type: String, required: false },
        slug: { type: String, required: false },
        images: { type: [String], required: false },
        salePrice: { type: Number, required: false },
        discountType: { type: Number, required: false },
        discountAmount: { type: Number, required: false },
      },
    ],
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
