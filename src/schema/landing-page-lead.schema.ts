import * as mongoose from 'mongoose';
import { Schema } from 'mongoose';

export const LandingPageLeadSchema = new mongoose.Schema(
  {
    landingPage: {
      type: Schema.Types.ObjectId,
      ref: 'LandingPage',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNo: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: false,
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
