export interface Setting {
  _id?: string;
  analytics?: Analytics;
  courierMethods?: CourierMethod[];
  fraudCheck?: {
    apiKey?: string;
    apiType?: 'free' | 'pro';
  };
  facebookCatalog?: FacebookCatalog;
}

export interface FacebookCatalog {
  isEnableFacebookCatalog?: boolean;
}

export interface Analytics {
  tagManagerId?: string;
  facebookPixelId?: string;
  facebookPixelAccessToken?: string;
  IsManageFbPixelByTagManager?: boolean;
  isEnablePixelTestEvent?: boolean;
  facebookPixelTestEventId?: string;
  tiktokPixelId?: string;
  tiktokAccessToken?: string;
  tiktokTestEventCode?: string;
  isPurchaseEventOnConfirm?: boolean;
}

export interface CourierMethod {
  providerName?: string;
  apiKey?: string;
  secretKey?: string;
  username?: string;
  password?: string;
  storeId?: string;
  status?: string;
  specialInstruction?: string;
}
