import * as mongoose from 'mongoose';

export const TagSchema = new mongoose.Schema(
  {
    readOnly: {
      type: Boolean,
      required: false,
    },
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
    image: {
      type: String,
      required: false,
    },
    url: {
      type: String,
      required: false,
    },
    priority: {
      type: Number,
      required: false,
      default: 0,
    },
    status: {
      type: String,
      required: false,
      default: 'publish',
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
