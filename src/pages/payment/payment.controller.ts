import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';

import { PaymentService } from './payment.service';
import { ResponsePayload } from '../../interfaces/core/response-payload.interface';

@Controller('payment')
export class PaymentController {
  private logger = new Logger(PaymentController.name);

  constructor(private paymentService: PaymentService) {}

  /**
   * NAGAD PAYMENT
   * nagadCreatePayment()
   */
  // @Post('/nagad-create-payment')
  // @UsePipes(ValidationPipe)
  // async nagadCreatePayment(@Body() data: any): Promise<ResponsePayload> {
  //   //console.log('otp phone', addOtpDto);
  //   return await this.paymentService.nagadCreatePayment(data);
  // }
  //
  // @Post('/nagad-verify-payment')
  // @UsePipes(ValidationPipe)
  // async nagadVerifyPayment(
  //   @Body()
  //   body: any,
  // ): Promise<ResponsePayload> {
  //   return await this.paymentService.nagadVerifyPayment(body);
  // }

  @Post('/init-ssl')
  @UsePipes(ValidationPipe)
  async getInitSSL(
    @Body()
    body: any,
  ): Promise<ResponsePayload> {
    return await this.paymentService.initSSLPayment(body);
  }

  @Post('/ssl-ipn')
  @UsePipes(ValidationPipe)
  async ipnSSL(
    @Body()
    body: {
      status: string;
      tran_id: string;
      amount: number;
    },
  ): Promise<ResponsePayload> {
    //console.log('otp phone', addOtpDto);
    return await this.paymentService.ipn(body);
  }

  @Post('/create-bkash-payment')
  @UsePipes(ValidationPipe)
  async createBkashPayment(
    @Body()
    body: any,
  ): Promise<ResponsePayload> {
    return await this.paymentService.createBkashPayment(body);
  }

  @Get('/callback-bkash-payment')
  async callbackBkashPayment(
    @Res() res: Response,
    @Query('paymentID') paymentID: string,
    @Query('status') status: string,
  ): Promise<any> {
    return await this.paymentService.callbackBkashPayment(res, paymentID, status);
  }


  @Get('/query-bkash-payment')
  async queryBkashPayment(
    @Query('paymentID') paymentID: string,
  ): Promise<any> {
    return await this.paymentService.queryBkashPayment(paymentID);
  }

  @Post('/refund-bkash-payment')
  @UsePipes(ValidationPipe)
  async refundBkashPayment(
    @Body()
    body: { paymentID: string; trxID: string; amount: string; sku: string; reason: string },
  ): Promise<ResponsePayload> {
    return await this.paymentService.refundBkashPayment(body);
  }
}
