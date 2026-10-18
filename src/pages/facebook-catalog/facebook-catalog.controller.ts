import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { FacebookCatalogService } from './facebook-catalog.service';

@Controller('facebook-catalog')
export class FacebookCatalogController {
  constructor(private readonly fbCatalogService: FacebookCatalogService) {}

  @Get('datafeed.csv')
  async getCsvFeed(@Res() res: Response) {
    const csv = await this.fbCatalogService.generateCsvFeed();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="facebook-catalog-datafeed.csv"',
    );
    res.status(200).send(csv);
  }

  @Get('datafeed.xml')
  async getXmlFeed(@Res() res: Response) {
    const xml = await this.fbCatalogService.generateXmlFeed();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(xml);
  }

  @Get('status')
  async getStatus() {
    return await this.fbCatalogService.getStatus();
  }
}
