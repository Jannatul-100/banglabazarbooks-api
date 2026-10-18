import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting } from '../../../interfaces/common/setting.interface';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import {
  UpdateSettingDto,
} from '../../../dto/setting.dto';

@Injectable()
export class SettingService {
  private logger = new Logger(SettingService.name);

  constructor(
    @InjectModel('Setting') private readonly settingModel: Model<Setting>,
  ) {}

  /**
   * getSetting
   */
  async getSetting(): Promise<ResponsePayload> {
    try {
      const data = await this.settingModel.findOne({});
      return {
        success: true,
        message: 'Success',
        data,
      } as ResponsePayload;
    } catch (err) {
      throw new InternalServerErrorException(err.message);
    }
  }

  /**
   * updateSetting
   */
  async updateSetting(
    updateSettingDto: UpdateSettingDto,
  ): Promise<ResponsePayload> {
    try {
      const updateData: any = { ...updateSettingDto };
      delete updateData._id;
      delete updateData.__v;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const data = await this.settingModel.findOne({});
      if (!data) {
        const newData = new this.settingModel(updateData);
        await newData.save();
      } else {
        await this.settingModel.findByIdAndUpdate(data._id, {
          $set: updateData,
        });
      }
      return {
        success: true,
        message: 'Success',
      } as ResponsePayload;
    } catch (err) {
      this.logger.error('Failed to update setting', err);
      throw new InternalServerErrorException(err.message);
    }
  }
}
