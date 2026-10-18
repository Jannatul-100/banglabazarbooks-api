import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID, createHash } from 'crypto';
import { Request } from 'express';
import { Model } from 'mongoose';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';
import { AnalyticsService } from './analytics.service';
import { UtilsService } from '../../shared/utils/utils.service';
import { Setting } from '../../interfaces/common/setting.interface';

@Injectable()
export class GtmService {
  private logger = new Logger(GtmService.name);

  constructor(
    @InjectModel('Setting')
    private readonly settingModel: Model<Setting>,
    private readonly analyticsService: AnalyticsService,
    private readonly utilsService: UtilsService,
  ) { }

  private normalizeEventTime(payload: any): void {
    const now = Math.floor(Date.now() / 1000);
    const raw = Number(payload?.event_time);
    if (!Number.isFinite(raw) || raw <= 0) {
      payload.event_time = now;
      return;
    }
    payload.event_time = raw > 1_000_000_000_000 ? Math.floor(raw / 1000) : raw;
    if (payload.event_time > now + 60 || payload.event_time < now - 7 * 24 * 60 * 60) {
      payload.event_time = now;
    }
  }

  private normalizeFbc(userData: any): void {
    if (!userData?.fbc) return;
    const raw = String(userData.fbc);
    const match = /^fb\.1\.(\d{10,17})\.(.+)$/.exec(raw);
    if (!match) {
      delete userData.fbc;
      return;
    }
    const tsRaw = match[1];
    const fbclid = match[2];
    const n = Number(tsRaw);
    const ms = tsRaw.length <= 10 ? Math.floor(n * 1000) : Math.floor(n);
    userData.fbc = `fb.1.${ms}.${fbclid}`;
  }

  private finalizeFacebookCapiEventId(fbApiPayload: any, dto: any): void {
    if (!fbApiPayload) return;
    const eventName = String(fbApiPayload.event_name || '');
    const mustHaveId = new Set(['Purchase', 'StartTrial', 'Subscribe']);

    const pick = (...vals: any[]): string | undefined => {
      for (const v of vals) {
        if (v == null) continue;
        const s = String(v).trim();
        if (s) return s.slice(0, 64);
      }
      return undefined;
    };

    const resolved = pick(
      fbApiPayload.event_id,
      dto?.event_id,
      dto?.eventId,
      fbApiPayload.custom_data?.transaction_id,
      dto?.transaction_id,
    );

    if (resolved) {
      fbApiPayload.event_id = resolved;
      return;
    }

    if (!mustHaveId.has(eventName)) return;

    const t = Math.floor(Date.now() / 1000);
    const id = `${eventName}_${t}_${randomUUID()}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    fbApiPayload.event_id = id.slice(0, 64);
  }

  private hashData(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const cleanStr = value.trim().toLowerCase();
    if (!cleanStr) return undefined;
    return createHash('sha256').update(cleanStr).digest('hex');
  }

  async trackFbEvent(req: Request, addGtmEventDto: any): Promise<ResponsePayload> {
    try {
      const clientIpAddress = this.utilsService.getClientIp(req);
      const clientUserAgent = req.headers['user-agent'];
      const fSetting = await this.settingModel.findOne({});

      // Hash user data fields if present
      const incomingUserData = addGtmEventDto.user_data || {};
      const hashedUserData: any = {
        client_ip_address: clientIpAddress || undefined,
        client_user_agent: clientUserAgent || undefined,
        fbc: incomingUserData.fbc,
        fbp: incomingUserData.fbp,
      };

      if (incomingUserData.em) hashedUserData.em = this.hashData(incomingUserData.em);
      if (incomingUserData.ph) {
        // Strip non-numeric characters for phone number
        const cleanPhone = String(incomingUserData.ph).replace(/\D/g, '');
        // For Bangladesh, if it starts with '01', add country code '880' if not present
        const finalPhone = cleanPhone.startsWith('01') && cleanPhone.length === 11 ? `88${cleanPhone}` : cleanPhone;
        hashedUserData.ph = this.hashData(finalPhone);
      }
      if (incomingUserData.fn) hashedUserData.fn = this.hashData(incomingUserData.fn);
      if (incomingUserData.ln) hashedUserData.ln = this.hashData(incomingUserData.ln);
      if (incomingUserData.ct) hashedUserData.ct = this.hashData(incomingUserData.ct);
      if (incomingUserData.st) hashedUserData.st = this.hashData(incomingUserData.st);
      if (incomingUserData.zp) hashedUserData.zp = this.hashData(incomingUserData.zp);
      if (incomingUserData.country) hashedUserData.country = this.hashData(incomingUserData.country);

      const fbApiPayload: any = {
        event_name: addGtmEventDto.event_name,
        event_time: addGtmEventDto.event_time ? Number(addGtmEventDto.event_time) : Math.floor(Date.now() / 1000),
        event_id: addGtmEventDto.event_id || addGtmEventDto.eventId,
        action_source: addGtmEventDto.action_source || 'website',
        event_source_url: addGtmEventDto.event_source_url,
        user_data: hashedUserData,
        custom_data: {
          ...(addGtmEventDto.custom_data || {}),
          value: addGtmEventDto.custom_data?.value ?? addGtmEventDto.value,
          currency: addGtmEventDto.custom_data?.currency || addGtmEventDto.currency || 'BDT',
        },
      };

      this.finalizeFacebookCapiEventId(fbApiPayload, addGtmEventDto);
      this.normalizeEventTime(fbApiPayload);
      this.normalizeFbc(fbApiPayload.user_data);

      if (fSetting?.analytics?.facebookPixelId && fSetting?.analytics?.facebookPixelAccessToken) {
        const payloadData = {
          data: [fbApiPayload],
          ...(fSetting.analytics.isEnablePixelTestEvent && fSetting.analytics.facebookPixelTestEventId && { test_event_code: fSetting.analytics.facebookPixelTestEventId })
        };
        await this.analyticsService.trackFbConversionEventClient(
          fSetting.analytics.facebookPixelId,
          fSetting.analytics.facebookPixelAccessToken,
          payloadData,
        );
      }

      return { success: true, message: 'Success' };
    } catch (error) {
      this.logger.error('Error in trackFbEvent:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async trackTiktokEvent(req: Request, bodyData: any): Promise<ResponsePayload> {
    try {
      const clientIpAddress = this.utilsService.getClientIp(req);
      const clientUserAgent = req.headers['user-agent'];
      const fSetting = await this.settingModel.findOne({});

      const tiktokPayload: any = {
        event: bodyData.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: bodyData.event_id || bodyData.eventId,
        user: {
          ip_address: clientIpAddress || undefined,
          user_agent: clientUserAgent || undefined,
          ...(bodyData.user || {}),
        },
        properties: bodyData.properties || {},
      };

      if (fSetting?.analytics?.tiktokPixelId && fSetting?.analytics?.tiktokAccessToken) {
        await this.analyticsService.trackTiktokConversionEventClient(
          fSetting.analytics.tiktokPixelId,
          fSetting.analytics.tiktokAccessToken,
          tiktokPayload,
          fSetting.analytics.tiktokTestEventCode,
        );
      }

      return { success: true, message: 'Success' };
    } catch (error) {
      this.logger.error('Error in trackTiktokEvent:', error);
      throw new InternalServerErrorException(error.message);
    }
  }

  async trackThemePageView(req: Request, bodyData: any): Promise<ResponsePayload> {
    const eventData = { ...bodyData, event_name: 'PageView' };
    await this.trackTiktokEvent(req, { event: 'PageView', ...bodyData });
    return await this.trackFbEvent(req, eventData);
  }

  async trackThemeViewContent(req: Request, bodyData: any): Promise<ResponsePayload> {
    const eventData = {
      ...bodyData,
      event_name: 'ViewContent',
      custom_data: {
        content_ids: bodyData.contentId ? [bodyData.contentId] : bodyData.custom_data?.content_ids,
        content_name: bodyData.contentName || bodyData.custom_data?.content_name,
        content_category: bodyData.contentCategory || bodyData.custom_data?.content_category,
        value: bodyData.value || bodyData.custom_data?.value,
        currency: bodyData.currency || bodyData.custom_data?.currency || 'BDT',
        ...(bodyData.custom_data || {})
      }
    };
    await this.trackTiktokEvent(req, { event: 'ViewContent', ...bodyData });
    return await this.trackFbEvent(req, eventData);
  }

  async trackThemeAddToCart(req: Request, bodyData: any): Promise<ResponsePayload> {
    const eventData = {
      ...bodyData,
      event_name: 'AddToCart',
      custom_data: {
        content_ids: bodyData.contentId ? [bodyData.contentId] : bodyData.custom_data?.content_ids,
        content_name: bodyData.contentName || bodyData.custom_data?.content_name,
        content_category: bodyData.contentCategory || bodyData.custom_data?.content_category,
        value: bodyData.value || bodyData.custom_data?.value,
        currency: bodyData.currency || bodyData.custom_data?.currency || 'BDT',
        ...(bodyData.custom_data || {})
      }
    };
    await this.trackTiktokEvent(req, { event: 'AddToCart', ...bodyData });
    return await this.trackFbEvent(req, eventData);
  }

  async trackThemeInitialCheckout(req: Request, bodyData: any): Promise<ResponsePayload> {
    const eventData = {
      ...bodyData,
      event_name: 'InitiateCheckout',
      custom_data: {
        value: bodyData.value || bodyData.custom_data?.value,
        currency: bodyData.currency || bodyData.custom_data?.currency || 'BDT',
        num_items: bodyData.num_items || bodyData.custom_data?.num_items,
        ...(bodyData.custom_data || {})
      }
    };
    await this.trackTiktokEvent(req, { event: 'InitiateCheckout', ...bodyData });
    return await this.trackFbEvent(req, eventData);
  }

  async trackThemePurchase(req: Request, bodyData: any): Promise<ResponsePayload> {
    const eventData = {
      ...bodyData,
      event_name: 'Purchase',
      custom_data: {
        value: bodyData.value || bodyData.custom_data?.value,
        currency: bodyData.currency || bodyData.custom_data?.currency || 'BDT',
        content_ids: bodyData.content_ids || bodyData.custom_data?.content_ids,
        transaction_id: bodyData.transactionId || bodyData.transaction_id || bodyData.custom_data?.transaction_id,
        ...(bodyData.custom_data || {})
      }
    };
    await this.trackTiktokEvent(req, { event: 'PlaceAnOrder', ...bodyData }); // TikTok uses PlaceAnOrder instead of Purchase
    return await this.trackFbEvent(req, eventData);
  }
}
