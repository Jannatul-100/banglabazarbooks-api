import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';

export const COURSE_MODULE_SCHEMA = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
  },
  {
    _id: true,
    timestamps: false,
  },
);

export const PACKAGE_ITEMS = new mongoose.Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    hasVariations: {
      type: Boolean,
      required: false,
    },
    quantity: {
      type: Number,
      required: true,
    },
    selectedVariation: {
      type: Schema.Types.ObjectId,
      ref: 'Product.variationsOptions',
      required: false,
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

export const ORDER_ITEM_SCHEMA = new mongoose.Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
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
    image: {
      type: String,
      required: false,
    },
    author: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Author',
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
    category: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
      name: {
        type: String,
      },
      slug: {
        type: String,
      },
    },
    subCategory: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'SubCategory',
      },
      name: {
        type: String,
      },
      slug: {
        type: String,
      },
    },
    publisher: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Publisher',
      },
      name: {
        type: String,
      },
      slug: {
        type: String,
      },
    },
    brand: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Brand',
      },
      name: {
        type: String,
      },
      slug: {
        type: String,
      },
    },
    regularPrice: {
      type: Number,
      required: false,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    salePrice: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    orderType: {
      type: String,
      required: true,
    },
    discountAmount: {
      type: Number,
      required: false,
    },
    discountType: {
      type: Number,
      required: false,
    },
    unit: {
      type: String,
      required: false,
    },
  },
  {
    _id: true,
  },
);

export const VARIATION_SUB_SCHEMA = new mongoose.Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Variation',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    values: {
      type: [String],
      required: true,
    },
  },
  {
    _id: false,
  },
);

export const PRODUCT_VARIATION_OPTION_SCHEMA = new mongoose.Schema(
  {
    _id: {
      type: Schema.Types.ObjectId,
      ref: 'Variation',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

export const PRODUCT_DISCOUNT_OPTIONS = new mongoose.Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
    },
    offerDiscountAmount: {
      type: Number,
      required: false,
    },
    offerDiscountType: {
      type: Number,
      required: false,
    },
    resetDiscount: {
      type: Boolean,
      required: false,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);

export const PRODUCT_DISCOUNT_OPTIONS1 = new mongoose.Schema(
  {
    product: {
      _id: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: false,
      },
      name: {
        type: String,
        required: false,
        trim: true,
      },
      slug2: {
        type: String,
        required: false,
      },
      slug: {
        type: String,
        required: false,
      },
      description: {
        type: String,
        required: false,
      },
      costPrice: {
        type: Number,
        required: false,
      },
      salePrice: {
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
      productType: {
        type: String,
        required: false,
      },
      productTagType: {
        type: String,
        required: false,
      },
      sku: {
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
      images: {
        type: [String],
        required: false,
      },
      quantity: {
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
      tags: {
        type: [Schema.Types.ObjectId],
        ref: 'Tag',
        required: false,
      },
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
        required: false,
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
      totalSold: {
        type: Number,
        required: false,
        default: 0,
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
      createdAtString: {
        type: String,
        required: false,
      },
    },
    offerDiscountAmount: {
      type: Number,
      required: false,
    },
    offerDiscountType: {
      type: Number,
      required: false,
    },
    resetDiscount: {
      type: Boolean,
      required: false,
    },
  },
  {
    _id: false,
    versionKey: false,
  },
);
