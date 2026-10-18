import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';
import {
  PRODUCT_VARIATION_OPTION_SCHEMA,
  VARIATION_SUB_SCHEMA,
} from './sub-schema.schema';

export const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    nameEn: {
      type: String,
      required: false,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: false,
    },
    shortDescription: {
      type: String,
      required: false,
    },

    url: {
      type: String,
      required: false,
    },
    tagline: {
      type: String,
      required: false,
    },
    taglineEn: {
      type: String,
      required: false,
    },
    featureTitle: {
      type: String,
      required: false,
    },
    costPrice: {
      type: Number,
      required: false,
    },
    profitPercent: {
      type: Number,
      required: false,
    },
    salePrice: {
      type: Number,
      required: false,
    },
    dollarPrice: {
      type: Number,
      required: false,
    },
    tax: {
      type: Number,
      required: false,
    },
    hasTax: {
      type: Boolean,
      required: false,
    },
    sku: {
      type: String,
      required: false,
      unique: false,
    },
    isbn: {
      type: String,
      required: false,
    },
    pdfFile: {
      type: String,
      required: false,
    },
    pdfUrl: {
      type: String,
      required: false,
    },
    previewImages: {
      type: [String],
      required: false,
      default: [],
    },
    previewPageLimit: {
      type: Number,
      required: false,
      default: 0,
    },
    pdfFileSize: {
      type: Number,
      required: false,
      default: 0,
    },
    edition: {
      type: String,
      required: false,
    },
    editionEn: {
      type: String,
      required: false,
    },
    emiMonth: {
      type: [Number],
      required: false,
    },
    discountType: {
      type: Number,
      required: false,
    },
    discountAmount: {
      type: Number,
      required: false,
    },

    emiAmount: {
      type: Number,
      required: false,
    },
    images: {
      type: [String],
      required: false,
    },
    quantity: {
      type: Number,
      required: false,
      default: 0,
    },
    threeMonth: {
      type: Number,
      required: false,
      default: 0,
    },
    sixMonth: {
      type: Number,
      required: false,
      default: 0,
    },
    totalPages: {
      type: Number,
      required: false,
      default: 0,
    },
    currentVersion: {
      type: String,
      required: false,
    },
    currentVersionEn: {
      type: String,
      required: false,
    },

    publishEditionDate: {
      type: String,
      required: false,
    },

    publishedDate: {
      type: Date,
      required: false,
    },
    // translatorName: {
    //   type: String,
    //   required: false,
    // },

    language: {
      type: String,
      required: false,
    },

    country: {
      type: String,
      required: false,
    },

    translatorName: {
      type: [String],
      required: false,
    },

    translatorNameEn: {
      type: [String],
      required: false,
    },

    twelveMonth: {
      type: Number,
      required: false,
      default: 0,
    },
    cartLimit: {
      type: Number,
      required: false,
      default: 0,
    },
    trackQuantity: {
      type: Boolean,
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
    seoKeywords: {
      type: String,
      required: false,
    },
    category: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      nameEn: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: true,
      },
    },
    subCategory: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: false,
      },
    },
    publisher: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Publisher',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: false,
      },
    },
    author: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Author',
          required: false,
        },
        name: {
          type: String,
          required: false,
        },
        nameEn: {
          type: String,
          required: false,
        },
        slug: {
          type: String,
          required: false,
        },
      },
    ],
    editor: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Author',
          required: false,
        },
        name: {
          type: String,
          required: false,
        },
        nameEn: {
          type: String,
          required: false,
        },
        slug: {
          type: String,
          required: false,
        },
      },
    ],
    translator: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Translator',
          required: false,
        },
        name: {
          type: String,
          required: false,
        },
        nameEn: {
          type: String,
          required: false,
        },
        slug: {
          type: String,
          required: false,
        },
      },
    ],
    brand: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
        required: false,
      },
      name: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: false,
      },
    },
    tags: [
      {
        _id: {
          type: Schema.Types.ObjectId,
          ref: 'Tags',
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        slug: {
          type: String,
          required: true,
        },
      },
    ],
    hasVariations: {
      type: Boolean,
      required: false,
    },
    variations: {
      type: [VARIATION_SUB_SCHEMA],
      required: false,
    },
    variationsOptions: [
      {
        quantity: {
          type: Number,
          required: false,
        },
        price: {
          type: Number,
          required: false,
        },
        image: {
          type: String,
          required: false,
        },
        variations: [PRODUCT_VARIATION_OPTION_SCHEMA],
      },
    ],
    earnPoint: {
      type: Boolean,
      required: false,
    },
    pointType: {
      type: Number,
      required: false,
    },
    pointValue: {
      type: Number,
      required: false,
    },
    redeemPoint: {
      type: Boolean,
      required: false,
    },
    redeemType: {
      type: Number,
      required: false,
    },
    redeemValue: {
      type: Number,
      required: false,
    },
    status: {
      type: String,
      required: true,
    },
    approvalStatus: {
      type: String,
      required: false,
      default: 'approved',
    },
    isPublisherProduct: {
      type: Boolean,
      required: false,
      default: false,
    },
    isFacebookCatalog: {
      type: Boolean,
      required: false,
      default: false,
    },
    pendingPriceUpdate: {
      regularPrice: { type: Number, required: false },
      salePrice: { type: Number, required: false },
      costPrice: { type: Number, required: false },
      requestedAt: { type: Date, required: false },
      status: { type: String, required: false }, // 'pending' | 'approved' | 'rejected'
    },
    discountStartDateTime: {
      type: Date,
      required: false,
    },
    discountEndDateTime: {
      type: Date,
      required: false,
    },
    videoUrl: {
      type: String,
      required: false,
    },
    unit: {
      type: String,
      required: false,
    },
    specifications: {
      type: [Object],
      required: false,
    },
    features: {
      type: [Object],
      required: false,
    },
    totalSold: {
      type: Number,
      required: false,
      default: 0,
    },
    ratingDetails: {
      oneStar: {
        type: Number,
        default: 0,
      },
      twoStar: {
        type: Number,
        default: 0,
      },
      threeStar: {
        type: Number,
        default: 0,
      },
      fourStar: {
        type: Number,
        default: 0,
      },
      fiveStar: {
        type: Number,
        default: 0,
      },
    },
    ratingAvr: {
      type: Number,
      required: false,
      default: 0,
    },
    ratingCount: {
      type: Number,
      required: false,
      default: 0,
    },
    ratingTotal: {
      type: Number,
      required: false,
      default: 0,
    },
    reviewTotal: {
      type: Number,
      required: false,
      default: 0,
    },
    priority: {
      type: Number,
      required: false,
    },
    freeDelivery: {
      type: Boolean,
      required: false,
      default: false,
    },
    isPreOrder: {
      type: Boolean,
      required: false,
      default: false,
    },
    preOrderReleaseDate: {
      type: Date,
      required: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
