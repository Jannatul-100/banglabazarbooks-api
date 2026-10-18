import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Admin } from '../interfaces/admin/admin.interface';

export const GetAdmin = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Admin => {
    const request = ctx.switchToHttp().getRequest();
    return request.admin;
  },
);
