export interface Publisher {
  _id?: string;
  name?: string;
  nameEn?: string;
  slug?: string;
  image?: string;
  description?: string;
  descriptionEn?: string;
  discountType?: number;
  discountAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
