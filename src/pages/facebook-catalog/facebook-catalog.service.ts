import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../../interfaces/common/product.interface';
import { Setting } from '../../interfaces/common/setting.interface';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';

@Injectable()
export class FacebookCatalogService {
  private readonly logger = new Logger(FacebookCatalogService.name);
  private readonly siteBaseUrl = 'https://www.banglabazarbooks.com';
  private readonly apiBaseUrl = 'https://api.banglabazarbooks.com';

  constructor(
    @InjectModel('Product') private readonly productModel: Model<Product>,
    @InjectModel('Setting') private readonly settingModel: Model<Setting>,
  ) {}

  /**
   * Escape CSV cell values according to RFC 4180
   */
  private escapeCsv(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Remove HTML tags and decode common entities
   */
  private stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Format full image URL
   */
  private formatImageUrl(images?: string[]): string {
    if (!images || !images.length || !images[0]) return '';
    let img = images[0].trim();
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return img.replace('http://', 'https://');
    }
    return `${this.apiBaseUrl}${img.startsWith('/') ? '' : '/'}${img}`;
  }

  /**
   * Generate Meta Facebook Catalog CSV Feed
   */
  async generateCsvFeed(): Promise<string> {
    const setting = await this.settingModel.findOne();
    const isEnabled = setting?.facebookCatalog?.isEnableFacebookCatalog;

    const headers = [
      'id',
      'title',
      'description',
      'availability',
      'condition',
      'price',
      'sale_price',
      'link',
      'image_link',
      'brand',
      'google_product_category',
      'fb_product_category',
    ];

    if (!isEnabled) {
      return headers.join(',') + '\n';
    }

    const filter: any = {
      status: 'publish',
      isFacebookCatalog: true,
    };

    const products: any[] = await this.productModel
      .find(filter)
      .populate('category', 'name slug')
      .populate('publisher', 'name slug')
      .populate('author', 'name slug')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const rows: string[] = [];
    rows.push(headers.join(','));

    for (const p of products) {
      if (!p.slug) continue;

      const id = p._id.toString();
      const title = p.name ? p.name.trim() : 'Book';
      const rawDesc = p.description || p.shortDescription || p.name || '';
      const description = this.stripHtml(rawDesc).slice(0, 4990);

      const isInStock = p.trackQuantity ? (p.quantity ?? 0) > 0 : true;
      const availability = isInStock ? 'in stock' : 'out of stock';
      const condition = 'new';

      const regularPrice = p.regularPrice || p.salePrice || 0;
      const price = `${regularPrice} BDT`;

      let salePrice = '';
      if (p.salePrice && p.regularPrice && p.salePrice < p.regularPrice) {
        salePrice = `${p.salePrice} BDT`;
      }

      const link = `${this.siteBaseUrl}/product-details/${p.slug}`;
      const imageLink = this.formatImageUrl(p.images);

      let brand = 'বাংলাবাজার বুকস';
      if (p.publisher && p.publisher.name) {
        brand = p.publisher.name;
      } else if (p.author) {
        if (Array.isArray(p.author) && p.author.length > 0 && p.author[0]?.name) {
          brand = p.author[0].name;
        } else if (p.author.name) {
          brand = p.author.name;
        }
      }

      const googleProductCategory = '784'; // Media > Books
      const fbProductCategory = 'Books';

      const rowValues = [
        this.escapeCsv(id),
        this.escapeCsv(title),
        this.escapeCsv(description),
        this.escapeCsv(availability),
        this.escapeCsv(condition),
        this.escapeCsv(price),
        this.escapeCsv(salePrice),
        this.escapeCsv(link),
        this.escapeCsv(imageLink),
        this.escapeCsv(brand),
        this.escapeCsv(googleProductCategory),
        this.escapeCsv(fbProductCategory),
      ];

      rows.push(rowValues.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Generate Meta Facebook Catalog RSS / XML Feed
   */
  async generateXmlFeed(): Promise<string> {
    const setting = await this.settingModel.findOne();
    const isEnabled = setting?.facebookCatalog?.isEnableFacebookCatalog;

    let itemsXml = '';

    if (isEnabled) {
      const filter: any = {
        status: 'publish',
        isFacebookCatalog: true,
      };

      const products: any[] = await this.productModel
        .find(filter)
        .populate('category', 'name slug')
        .populate('publisher', 'name slug')
        .populate('author', 'name slug')
        .sort({ createdAt: -1 })
        .lean()
        .exec();

      for (const p of products) {
        if (!p.slug) continue;

        const id = p._id.toString();
        const title = p.name ? p.name.trim() : 'Book';
        const rawDesc = p.description || p.shortDescription || p.name || '';
        const description = this.stripHtml(rawDesc).slice(0, 4990);

        const isInStock = p.trackQuantity ? (p.quantity ?? 0) > 0 : true;
        const availability = isInStock ? 'in stock' : 'out of stock';
        const condition = 'new';

        const regularPrice = p.regularPrice || p.salePrice || 0;
        const price = `${regularPrice} BDT`;

        let salePriceTag = '';
        if (p.salePrice && p.regularPrice && p.salePrice < p.regularPrice) {
          salePriceTag = `<g:sale_price>${p.salePrice} BDT</g:sale_price>`;
        }

        const link = `${this.siteBaseUrl}/product-details/${p.slug}`;
        const imageLink = this.formatImageUrl(p.images);

        let brand = 'বাংলাবাজার বুকস';
        if (p.publisher && p.publisher.name) {
          brand = p.publisher.name;
        } else if (p.author) {
          if (Array.isArray(p.author) && p.author.length > 0 && p.author[0]?.name) {
            brand = p.author[0].name;
          } else if (p.author.name) {
            brand = p.author.name;
          }
        }

        itemsXml += `
    <item>
      <g:id>${id}</g:id>
      <g:title><![CDATA[${title}]]></g:title>
      <g:description><![CDATA[${description}]]></g:description>
      <g:link>${link}</g:link>
      <g:image_link>${imageLink}</g:image_link>
      <g:brand><![CDATA[${brand}]]></g:brand>
      <g:condition>${condition}</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${price}</g:price>
      ${salePriceTag}
      <g:google_product_category>784</g:google_product_category>
      <g:fb_product_category>Books</g:fb_product_category>
    </item>`;
      }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Banglabazar Books Product Catalog</title>
    <link>${this.siteBaseUrl}</link>
    <description>Facebook &amp; Instagram Product Catalog Data Feed for Banglabazar Books</description>${itemsXml}
  </channel>
</rss>`;
  }

  /**
   * Get Catalog Status & Product Counts
   */
  async getStatus(): Promise<ResponsePayload> {
    const setting = await this.settingModel.findOne();
    const isEnabled = !!setting?.facebookCatalog?.isEnableFacebookCatalog;

    const totalPublished = await this.productModel.countDocuments({ status: 'publish' });
    const catalogCount = await this.productModel.countDocuments({
      status: 'publish',
      isFacebookCatalog: true,
    });

    return {
      success: true,
      message: 'Catalog status fetched successfully',
      data: {
        isEnabled,
        catalogCount,
        totalPublished,
        feedCsvUrl: `${this.apiBaseUrl}/api/facebook-catalog/datafeed.csv`,
        feedXmlUrl: `${this.apiBaseUrl}/api/facebook-catalog/datafeed.xml`,
      },
    };
  }
}
