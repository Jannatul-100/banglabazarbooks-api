import { Injectable, Logger } from '@nestjs/common';
import * as moment from 'moment-timezone';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../../interfaces/common/product.interface';
// import path from 'path';
// import fs from 'fs';
import * as fs from 'fs';
import * as path from 'path';
import { DiscountTypeEnum } from '../../enum/product.enum';
const PDFDocument = require('pdfkit'); // Ensure correct import
@Injectable()
export class UtilsService {
  private logger = new Logger(UtilsService.name);

  constructor(
    @InjectModel('Product') private readonly productModel: Model<Product>,
  ) { }

  escapeRegex(str: string): string {
    return (str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * MOMENT DATE FUNCTIONS
   * getDateString
   */
  getDateString(date: Date): string {
    return moment(date).format('YYYY-MM-DD');
  }

  getPdfDateString(date: Date, format?: string): string {
    const fm = format ? format : 'YYYY-MM-DD';
    return moment(date).format(fm);
  }

  getNextDateString(date: Date, day): string {
    return moment(date).add(day, 'days').format('YYYY-MM-DD');
  }

  getDateMonth(fromZero: boolean, date?: any): number {
    let d;
    if (date) {
      d = new Date(date);
    } else {
      d = new Date();
    }
    const month = d.getMonth();
    return fromZero ? month : month + 1;
  }

  getDateYear(date?: any): number {
    let d;
    if (date) {
      d = new Date(date);
    } else {
      d = new Date();
    }
    return d.getFullYear();
  }
  getLocalDateTime(): Date {
    const newDate = moment().tz('Asia/Dhaka');
    return newDate.toDate();
  }

  getClientIp(req: any): string {
    const ipAddress = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip;
    return typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : Array.isArray(ipAddress) ? ipAddress[0] : ipAddress || '';
  }

  public createRegexFromString(inputString: string) {
    // Escape any special characters in the input string
    const escapedString = inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Create a regex pattern that matches any symbol, number, and character
    // const regexPattern = `.*[${escapedString}].*`;

    // Create a case-insensitive regex
    return new RegExp(escapedString, 'i');
  }

  getDateWithCurrentTime(date: Date): Date {
    const _ = moment().tz('Asia/Dhaka');
    // const newDate = moment(date).add({hours: _.hour(), minutes:_.minute() , seconds:_.second()});
    const newDate = moment(date).add({ hours: _.hour(), minutes: _.minute() });
    return newDate.toDate();
  }

  getDateDifference(
    date1: Date | string,
    date2: Date | string,
    unit?: string,
  ): number {
    /**
     * If First Date is Current or Future Date
     * If Second Date is Expire or Old Date
     * Return Positive Value If Not Expired
     */
    const a = moment(date1).tz('Asia/Dhaka');
    const b = moment(date2).tz('Asia/Dhaka');

    switch (unit) {
      case 'seconds': {
        return b.diff(a, 'seconds');
      }
      case 'minutes': {
        return b.diff(a, 'minutes');
      }
      case 'hours': {
        return b.diff(a, 'hours');
      }
      case 'days': {
        return b.diff(a, 'days');
      }
      case 'weeks': {
        return b.diff(a, 'weeks');
      }
      default: {
        return b.diff(a, 'hours');
      }
    }
  }

  public async generateInvoicePdf(orderData) {
    const dir = `./upload/invoice`;
    const logoPath = path.join(dir, 'logo1.jpeg'); // Path to the logo image
    const fileName = `invoice-${orderData.orderId}.pdf`;
    const filePath = path.join(dir, fileName);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Set uniform margins for all sides (50px on all sides)
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Include the logo and set its size and position
    doc.image(logoPath, doc.page.margins.left, doc.page.margins.top, {
      width: 50,
    });

    // Company info and contact
    const infoX = doc.page.margins.left + 60; // Adjust X to maintain left margin with logo
    const topPadding = doc.page.margins.top; // Ensuring top margin

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('www.banglabazarbooks.com', infoX, topPadding, { align: 'left' })
      .text(
        '34, (2nd Floor) Bangla Bazar, Dhaka-1100',
        infoX,
        topPadding + 15,
        { align: 'left' },
      )
      .text('Telephone: 01784093014', infoX, topPadding + 30, {
        align: 'left',
      })
      .text('Email: banglabazarbooks@gmail.com', infoX, topPadding + 45, {
        align: 'left',
      });

    // Invoice details positioned on the right, maintaining the right margin
    const invoiceDetailsX = doc.page.width - doc.page.margins.right - 170;
    doc
      .fontSize(10)
      .text(
        `Invoice ID: SL-${orderData.orderId}`,
        invoiceDetailsX,
        topPadding,
        { align: 'right' },
      )
      .text(
        `Date: ${this.getDateString(new Date())}`,
        invoiceDetailsX,
        topPadding + 15,
        { align: 'right' },
      )
      .text(
        `Contact: ${orderData?.user?.phoneNo ?? orderData?.phoneNo}`,
        invoiceDetailsX,
        topPadding + 30,
        { align: 'right' },
      );

    // Draw a line after the header
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(doc.page.margins.left, topPadding + 80)
      .lineTo(doc.page.width - doc.page.margins.right, topPadding + 80)
      .stroke();

    // Order Info Section (Keeping same left margin)
    const orderInfoY = topPadding + 90;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Order Info:', doc.page.margins.left, orderInfoY)
      .font('Helvetica')
      .text(
        `Order Id: #${orderData.orderId}`,
        doc.page.margins.left,
        orderInfoY + 15,
      )
      .text(
        `Date: ${this.getDateString(new Date())}`,
        doc.page.margins.left,
        orderInfoY + 30,
      )
      .text(
        `Payment Status: ${orderData.paymentStatus}`,
        doc.page.margins.left,
        orderInfoY + 45,
      )
      .text(
        `Total Product: ${orderData?.orderedItems?.length} Items`,
        doc.page.margins.left,
        orderInfoY + 60,
      );

    // Delivery Address Section (Aligned with right margin)
    const deliveryAddressX = invoiceDetailsX;
    doc
      .font('Helvetica-Bold')
      .text('Delivery Address:', deliveryAddressX, orderInfoY)
      .font('Helvetica')
      .text(
        `Name: ${orderData?.name ?? 'N/A'}`,
        deliveryAddressX,
        orderInfoY + 15,
      )
      .text(
        `Address: ${orderData?.shippingAddress ?? 'N/A'}`,
        deliveryAddressX,
        orderInfoY + 30,
      )
      .text(`Phone: ${orderData.phoneNo}`, deliveryAddressX, orderInfoY + 45);

    // Product Table Headers (Keep table aligned with the left margin)
    const tableHeaderY = orderInfoY + 105;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('SL', doc.page.margins.left + 20, tableHeaderY)
      .text('Product', doc.page.margins.left + 50, tableHeaderY, { width: 100 })
      .text('Price', doc.page.margins.left + 170, tableHeaderY)
      .text('Discount', doc.page.margins.left + 240, tableHeaderY)
      .text('Dis.Amount', doc.page.margins.left + 310, tableHeaderY)
      .text('Quantity', doc.page.margins.left + 380, tableHeaderY)
      .text('Total', doc.page.margins.left + 450, tableHeaderY);

    // Draw a line after the table headers
    doc
      .moveTo(doc.page.margins.left, tableHeaderY + 15)
      .lineTo(doc.page.width - doc.page.margins.right, tableHeaderY + 15)
      .stroke();

    // Table Body (Keep left and right aligned within margins)
    const startX = doc.page.margins.left;
    const columnWidths = [30, 130, 80, 70, 90, 60, 70];
    const columnPositions = [startX];

    for (let i = 1; i < columnWidths.length; i++) {
      columnPositions.push(columnPositions[i - 1] + columnWidths[i - 1]);
    }

    let y = tableHeaderY + 25;
    orderData.orderedItems.forEach((item, index) => {
      doc.font('Helvetica');
      const texts = [
        index + 1, // Serial Number
        item.nameEn, // Product Name
        `${item.regularPrice} TK`, // Price
        `${this.calculateDiscount(item, 'discountPercentage')} %`, // Discount Percentage
        `${this.calculateDiscount(item, 'discountAmount')} TK`, // Discount Amount
        item.quantity, // Quantity
        `${item.regularPrice * item.quantity} TK`, // Total
      ];

      const rowHeight = texts.reduce((max, text, i) => {
        const textHeight = doc.heightOfString(text?.toString(), {
          width: columnWidths[i],
        });
        return textHeight > max ? textHeight : max;
      }, 0);

      y += 5; // Add top margin
      texts.forEach((text, i) => {
        doc.text(text?.toString(), columnPositions[i], y, {
          width: columnWidths[i],
          align: i === 0 ? 'center' : 'left',
        });
      });

      y += rowHeight + 5;

      doc
        .moveTo(startX, y)
        .lineTo(startX + columnWidths.reduce((a, b) => a + b, 0), y)
        .stroke();
    });

    // Totals and Note Section (Keeping within left and right margins)
    const subtotalY = y + 30;
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Note:', doc.page.margins.left + 20, subtotalY);

    const totalsStartX = doc.page.margins.left + 290;
    const totalsWidth = 210;
    const borderMiddleX = totalsStartX + 120;
    doc.rect(totalsStartX, subtotalY - 5, totalsWidth, 85).stroke();

    doc
      .moveTo(borderMiddleX, subtotalY - 5)
      .lineTo(borderMiddleX, subtotalY + 80)
      .stroke();

    const drawLabelValue = (label, value, x, y, labelWidth, valueWidth) => {
      doc.font('Helvetica').fontSize(10);
      doc.text(label, x, y, { width: labelWidth, align: 'left' });
      doc.text(value, x + labelWidth, y, { width: valueWidth, align: 'right' });
    };

    const labelWidth = borderMiddleX - totalsStartX - 10;
    const valueWidth = totalsWidth - labelWidth - 20;

    drawLabelValue(
      'SubTotal:',
      `${orderData.subTotal} TK`,
      totalsStartX + 10,
      subtotalY,
      labelWidth,
      valueWidth,
    );
    drawLabelValue(
      'Discount:',
      `-${orderData.discount} TK`,
      totalsStartX + 10,
      subtotalY + 20,
      labelWidth,
      valueWidth,
    );
    drawLabelValue(
      'Delivery Charge:',
      `${orderData.deliveryCharge} TK`,
      totalsStartX + 10,
      subtotalY + 40,
      labelWidth,
      valueWidth,
    );
    drawLabelValue(
      'Grand Total:',
      `${orderData.grandTotal} TK`,
      totalsStartX + 10,
      subtotalY + 60,
      labelWidth,
      valueWidth,
    );

    doc
      .fontSize(10)
      .font('Helvetica')
      .text(
        'Thank you for choosing Banglabazar Books',
        doc.page.margins.left,
        y + 200,
        { align: 'center' },
      );

    doc.end();
    writeStream.on('finish', () => {
      console.log('Invoice PDF generated successfully.');
    });
    writeStream.on('error', (err) => {
      console.error('Error generating PDF:', err);
    });
  }

  calculateDiscount(item, type) {
    const { discountType, discountAmount, salePrice, quantity } = item;

    if (type === 'discountAmount') {
      if (discountType === 1) {
        const discountValue = (discountAmount / 100) * salePrice;
        return quantity ? discountValue * quantity : discountValue;
      } else if (discountType === 2) {
        return quantity ? discountAmount * quantity : discountAmount;
      }
    } else if (type === 'discountPercentage') {
      if (discountType === 1) {
        return discountAmount; // Percentage value is already provided.
      } else if (discountType === 2) {
        const percentage = Math.round((discountAmount / salePrice) * 100);
        return percentage;
      }
    }
    return 0; // Default return for unsupported types
  }
  /**
   * STRING FUNCTIONS
   * transformToSlug
   */
  public transformToSlug(value: string, salt?: boolean): string {
    let slug = value
      .trim()
      .replace(/[^A-Z0-9\u0980-\u09FF]+/gi, '-')
      .toLowerCase();

    if (!slug || slug === '-' || slug === '--') {
      slug = 'item-' + Date.now().toString(36);
    } else {
      slug = slug.replace(/^-+|-+$/g, ''); // remove leading/trailing hyphens
    }

    return salt ? `${slug}-${Math.floor(Math.random() * 100000)}` : slug;
  }

  /**
   * RANDOM FUNCTIONS
   */
  getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * PAD LEADING
   */
  padLeadingZeros(num): string {
    return String(num).padStart(4, '0');
  }

  /**
   * METHODS
   * updateProductsOnOfferStart()
   */

  public async updateProductsOnOfferStart(products: any[]) {
    for (const product of products) {
      await this.productModel.updateOne(
        { _id: product.product },
        {
          $set: {
            discountType: product.offerDiscountType,
            discountAmount: product.offerDiscountAmount,
          },
        },
      );
    }
  }

  public async updateProductsOnOfferEnd(products: any[]) {
    for (const product of products) {
      if (product.resetDiscount) {
        await this.productModel.updateOne(
          { _id: product.product },
          {
            $set: {
              discountType: null,
              discountAmount: null,
            },
          },
        );
      }
    }
  }

  /**
   * GENERATE OTP
   * getRandomOtpCode4()
   * getRandomOtpCode6()
   */
  getRandomOtpCode4(): string {
    return (Math.floor(Math.random() * 10000) + 10000).toString().substring(1);
  }

  getRandomOtpCode6(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  addMinuteInCurrentTime(time: number): Date {
    const newDate = moment().tz('Asia/Dhaka').add(time, 'minutes');
    return newDate.toDate();
  }





  transform(product: Product, type: string, quantity?: number): number {

    if (product) {
      switch (type) {
        case 'salePrice': {

          if (product.discountType === DiscountTypeEnum.PERCENTAGE) {
            const disPrice = (product?.discountAmount / 100) * product?.salePrice;

            if (quantity) {
              return Math.floor((product?.salePrice - disPrice) * quantity);
            }
            return Math.floor(product?.salePrice - disPrice);
          } else if (product.discountType === DiscountTypeEnum.CASH) {
            if (quantity) {
              return Math.floor((product?.salePrice - product.discountAmount) * quantity);
            }
            return Math.floor(product?.salePrice - product.discountAmount);
          } else {
            if (quantity) {
              return Math.floor((product?.salePrice) * quantity);
            }
            return Math.floor(product?.salePrice);
          }
        }
        case 'discountAmount': {
          if (product.discountType === DiscountTypeEnum.PERCENTAGE) {
            if (quantity) {
              return Math.floor(((product?.discountAmount / 100) * product?.salePrice) * quantity);
              // return ((product?.discountAmount / 100) * product?.salePrice) * quantity;
            }
            return Math.floor((product?.discountAmount / 100) * product?.salePrice);
            // return ((product?.discountAmount / 100) * product?.salePrice);
          } else if (product.discountType === DiscountTypeEnum.CASH) {
            if (quantity) {
              return product?.discountAmount * quantity;
            }
            return product?.discountAmount;
          } else {
            return 0;
          }
        }
        case 'discountPercentage': {
          if (product.discountType === DiscountTypeEnum.PERCENTAGE) {
            if (quantity) {
              return product?.discountAmount;
            }
            return product?.discountAmount;
          } else if (product.discountType === DiscountTypeEnum.CASH) {
            if (quantity) {
              return Math.round((product?.discountAmount / product?.salePrice) * 100);
            }
            return Math.round((product?.discountAmount / product?.salePrice) * 100);
          } else {
            return 0;
          }
        }
        case 'regularPrice': {
          if (quantity) {
            return Math.floor(product?.salePrice * quantity);
          }
          return Math.floor(product?.salePrice);
        }
        default: {
          return product?.salePrice;
        }
      }
    } else {
      return 0;
    }

  }


  roundNumber(num: number): number {
    const integer = Math.floor(num);
    const fractional = num - integer;

    //Converting the fractional to the integer
    const frac2int = (fractional * 100) / 5;
    const fracCeil = Math.fround(frac2int);

    //transforming inter into fractional
    const FracOut = (fracCeil * 5) / 100;
    const ans = integer + FracOut;

    return Number((Math.round(ans * 100) / 100).toFixed(2));
  }
}
