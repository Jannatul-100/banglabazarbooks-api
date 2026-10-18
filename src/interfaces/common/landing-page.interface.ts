export interface LandingPageFeature {
  title?: string;
  value?: string;
}

export interface LandingPageTrustItem {
  icon?: string;
  title?: string;
  subtitle?: string;
}

export interface LandingPageBenefitCard {
  icon?: string;
  title?: string;
  description?: string;
}

export interface LandingPageFooterStat {
  icon?: string;
  text?: string;
}

export interface LandingPageProductInfo {
  _id?: string;
  name?: string;
  nameEn?: string;
  slug?: string;
  images?: string[];
  salePrice?: number;
  discountType?: number;
  discountAmount?: number;
}

export interface LandingPage {
  _id?: string;
  name?: string;
  slug?: string;
  status?: string;
  template?: string;
  brandTagline?: string;
  badgeText?: string;
  title?: string;
  titleHighlight?: string;
  subtitle?: string;
  heroImage?: string;
  images?: string[];
  description?: string;
  featuresTitle?: string;
  features?: LandingPageFeature[];
  featuresContent?: string;
  heroPoints?: string[];
  resourceCardTitle?: string;
  resourceCardSubtitle?: string;
  leadFormTitle?: string;
  leadFormSubtitle?: string;
  leadFormNote?: string;
  leadFormButtonText?: string;
  leadFormTrustItems?: LandingPageTrustItem[];
  benefitsTitle?: string;
  benefitCards?: LandingPageBenefitCard[];
  headerBadges?: string[];
  footerStats?: LandingPageFooterStat[];
  downloadFileUrl?: string;
  insidePagesTitle?: string;
  insidePages?: string[];
  trustItems?: LandingPageTrustItem[];
  productSectionTitle?: string;
  productSectionSubtitle?: string;
  salePrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  primaryColor?: string;
  videoUrl?: string;
  endDate?: string;
  seoTitle?: string;
  seoDescription?: string;
  products?: any[];
  productInfo?: LandingPageProductInfo[];
  priority?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
