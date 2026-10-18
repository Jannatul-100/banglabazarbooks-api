import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Put,
  Query,
  UsePipes,
  ValidationPipe,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  AddTranslatorDto,
  FilterAndPaginationTranslatorDto,
  OptionTranslatorDto,
  UpdateTranslatorDto,
} from '../../../dto/translator.dto';
import { ResponsePayload } from '../../../interfaces/core/response-payload.interface';
import { MongoIdValidationPipe } from '../../../pipes/mongo-id-validation.pipe';
import { TranslatorService } from './translator.service';

@Controller('translator')
export class TranslatorController {
  private logger = new Logger(TranslatorController.name);

  constructor(private translatorService: TranslatorService) {}

  @Version(VERSION_NEUTRAL)
  @Post('/add')
  async addTranslator(
    @Body() addTranslatorDto: AddTranslatorDto,
  ): Promise<ResponsePayload> {
    return await this.translatorService.addTranslator(addTranslatorDto);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/insert-many')
  @UsePipes(ValidationPipe)
  async insertManyTranslator(
    @Body()
    body: {
      data: AddTranslatorDto[];
      option: OptionTranslatorDto;
    },
  ): Promise<ResponsePayload> {
    return await this.translatorService.insertManyTranslator(body.data, body.option);
  }

  @Version(VERSION_NEUTRAL)
  @Post('/get-all')
  @UsePipes(ValidationPipe)
  async getAllTranslators(
    @Body() filterTranslatorDto: FilterAndPaginationTranslatorDto,
    @Query('q') searchString: string,
  ): Promise<ResponsePayload> {
    return this.translatorService.getAllTranslators(filterTranslatorDto, searchString);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/get-all-basic')
  async getAllTranslatorsBasic(): Promise<ResponsePayload> {
    return await this.translatorService.getAllTranslatorsBasic();
  }

  @Version(VERSION_NEUTRAL)
  @Get('/:id')
  async getTranslatorById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.translatorService.getTranslatorById(id, select);
  }

  @Version(VERSION_NEUTRAL)
  @Get('/get-by-slug/:slug')
  async getTranslatorBySlug(
    @Param('slug') slug: string,
    @Query() select: string,
  ): Promise<ResponsePayload> {
    return await this.translatorService.getTranslatorBySlug(slug, select);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update/:id')
  async updateTranslatorById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Body() updateTranslatorDto: UpdateTranslatorDto,
  ): Promise<ResponsePayload> {
    return await this.translatorService.updateTranslatorById(id, updateTranslatorDto);
  }

  @Version(VERSION_NEUTRAL)
  @Put('/update-multiple')
  @UsePipes(ValidationPipe)
  async updateMultipleTranslatorById(
    @Body() updateTranslatorDto: UpdateTranslatorDto,
  ): Promise<ResponsePayload> {
    return await this.translatorService.updateMultipleTranslatorById(
      updateTranslatorDto.ids,
      updateTranslatorDto,
    );
  }

  @Version(VERSION_NEUTRAL)
  @Delete('/delete/:id')
  async deleteTranslatorById(
    @Param('id', MongoIdValidationPipe) id: string,
    @Query('checkUsage') checkUsage: boolean,
  ): Promise<ResponsePayload> {
    return await this.translatorService.deleteTranslatorById(id, Boolean(checkUsage));
  }

  @Version(VERSION_NEUTRAL)
  @Post('/delete-multiple')
  @UsePipes(ValidationPipe)
  async deleteMultipleTranslatorById(
    @Body() data: { ids: string[] },
    @Query('checkUsage') checkUsage: boolean,
  ): Promise<ResponsePayload> {
    return await this.translatorService.deleteMultipleTranslatorById(
      data.ids,
      Boolean(checkUsage),
    );
  }
}
