import {
  Body,
  Controller,
  Get,
  Logger,
  Put,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { SettingService } from './setting.service';
import { UpdateSettingDto } from '../../../dto/setting.dto';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';

@Controller('setting')
export class SettingController {
  private logger = new Logger(SettingController.name);

  constructor(private settingService: SettingService) {}

  @Version(VERSION_NEUTRAL)
  @Get('/get-setting')
  async getSetting(): Promise<ResponsePayload> {
    return await this.settingService.getSetting();
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update-setting')
  @UsePipes(ValidationPipe)
  async updateSetting(
    @Body() updateSettingDto: UpdateSettingDto,
  ): Promise<ResponsePayload> {
    return await this.settingService.updateSetting(updateSettingDto);
  }
}
