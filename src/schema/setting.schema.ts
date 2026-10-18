import * as mongoose from 'mongoose';

export const SettingSchema = new mongoose.Schema(
  {
    analytics: {
      tagManagerId: {
        type: String,
        required: false,
      },
      facebookPixelId: {
        type: String,
        required: false,
      },
      facebookPixelAccessToken: {
        type: String,
        required: false,
      },
      IsManageFbPixelByTagManager: {
        type: Boolean,
        required: false,
      },
      isEnablePixelTestEvent: {
        type: Boolean,
        required: false,
      },
      facebookPixelTestEventId: {
        type: String,
        required: false,
      },
      // TikTok Pixel Settings
      tiktokPixelId: {
        type: String,
        required: false,
      },
      tiktokAccessToken: {
        type: String,
        required: false,
      },
      tiktokTestEventCode: {
        type: String,
        required: false,
      },
      isPurchaseEventOnConfirm: {
        type: Boolean,
        required: false,
      },
    },
    courierMethods: [{
      providerName: { type: String, required: false },
      apiKey: { type: String, required: false },
      secretKey: { type: String, required: false },
      username: { type: String, required: false },
      password: { type: String, required: false },
      storeId: { type: String, required: false },
      status: { type: String, required: false }, // 'active' or 'inactive'
      specialInstruction: { type: String, required: false },
    }],
    fraudCheck: {
      apiKey: { type: String, required: false },
      apiType: { type: String, required: false }, // 'free' or 'pro'
    },
    facebookCatalog: {
      isEnableFacebookCatalog: {
        type: Boolean,
        required: false,
        default: false,
      },
    },
  },
  {
    versionKey: false,
    timestamps: true,
  },
);
