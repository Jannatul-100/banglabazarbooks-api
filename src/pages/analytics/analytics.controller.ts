import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { Request } from 'express';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { GtmService } from './gtm.service';

@Controller('analytics')
export class AnalyticsController {
  private logger = new Logger(AnalyticsController.name);

  constructor(private gtmService: GtmService) { }

  @Version(VERSION_NEUTRAL)
  @Post('/track-fb-event')
  @UsePipes(ValidationPipe)
  async trackFbEvent(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackFbEvent(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-tt-event')
  @UsePipes(ValidationPipe)
  async trackTiktokEvent(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackTiktokEvent(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-theme-page-view')
  @UsePipes(ValidationPipe)
  async trackThemePageView(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackThemePageView(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-theme-view-content')
  @UsePipes(ValidationPipe)
  async trackThemeViewContent(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackThemeViewContent(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-theme-add-to-cart')
  @UsePipes(ValidationPipe)
  async trackThemeAddToCart(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackThemeAddToCart(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-theme-initial-checkout')
  @UsePipes(ValidationPipe)
  async trackThemeInitialCheckout(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackThemeInitialCheckout(req, bodyData);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/track-theme-purchase')
  @UsePipes(ValidationPipe)
  async trackThemePurchase(
    @Req() req: Request,
    @Body() bodyData: any,
  ): Promise<ResponsePayload> {
    return await this.gtmService.trackThemePurchase(req, bodyData);
  }
}
