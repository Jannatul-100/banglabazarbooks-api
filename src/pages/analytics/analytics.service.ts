import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AnalyticsService {
  private logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly httpService: HttpService,
  ) { }

  /**
   * Meta Conversion API
   */
  public async trackFbConversionEventClient(
    fbPixelId: string,
    fbPixelAccessToken: string,
    data: any,
  ) {
    const fbEndpoint = `https://graph.facebook.com/v22.0/${fbPixelId}/events`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(fbEndpoint, data, {
          params: { access_token: fbPixelAccessToken },
        }),
      );

      return response.data;
    } catch (error) {
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Unknown error';
      const errorCode =
        error?.response?.data?.error?.code ||
        error?.response?.status ||
        'N/A';
      const errorType =
        error?.response?.data?.error?.type || 'Unknown';

      this.logger.error(
        `Facebook Conversion API Error [${errorCode}]: ${errorType} - ${errorMessage}`,
      );

      return {
        error: true,
        message: errorMessage,
        code: errorCode,
        type: errorType,
      };
    }
  }

  /**
   * TikTok Events API Client
   */
  public async trackTiktokConversionEventClient(
    pixelId: string,
    accessToken: string,
    event: any,
    testCode?: string,
  ) {
    if (!pixelId || !accessToken) {
      return { error: true, message: 'Missing TikTok credentials' };
    }

    const endpoint = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';

    const payload: any = {
      event_source: 'web',
      event_source_id: pixelId,
      data: [
        {
          event: event.event,
          event_id: event.event_id,
          event_time: event.event_time,
          user: event.user || {},
          properties: event.properties || {},
        },
      ],
    };

    if (testCode) {
      payload.test_event_code = testCode;
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post(endpoint, payload, {
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
        }),
      );

      return response.data;
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
      const errorCode = error?.response?.data?.code || error?.response?.status || 'N/A';
      this.logger.error(`TikTok Events API Error [${errorCode}]: ${errorMessage}`);
      return { error: true, message: errorMessage, code: errorCode };
    }
  }
}
