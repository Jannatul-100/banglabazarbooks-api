import * as mongoose from 'mongoose';

export const PublisherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    nameEn: {
      type: String,
      required: false,
    },
    image: {
      type: String,
      required: false,
    },
    description: {
      type: String,
      required: false,
    },
    descriptionEn: {
      type: String,
      required: false,
    },
    priority: {
      type: Number,
      required: false,
      default: 0
    },
    discountType: {
      type: Number,
      required: false,
    },
    discountAmount: {
      type: Number,
      required: false,
    },
    profitPercent: {
      type: Number,
      required: false,
    }
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
