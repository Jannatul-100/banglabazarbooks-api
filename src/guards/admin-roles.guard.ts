import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES_KEY } from '../core/global-variables';
import { ADMIN_PERMISSIONS_KEY } from '../decorator/admin-permissions.decorator';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>(
      ADMIN_ROLES_KEY,
      context.getHandler(),
    );
    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    let user;
    // *Important* When the user jwt strategy get data from request.user
    // *Important* When the admin jwt strategy get data from request.admin
    if (request.admin) {
      user = request.admin;
    } else if (request.user) {
      user = request.user;
    } else {
      user = undefined;
    }

    if (user?.role === 'super_admin') {
      return true;
    }

    if (roles.includes(user?.role)) {
      return true;
    }

    const permissions = this.reflector.get<string[]>(
      ADMIN_PERMISSIONS_KEY,
      context.getHandler(),
    );

    if (permissions && user?.permissions?.includes(permissions[0])) {
      return true;
    }

    throw new UnauthorizedException(
      'This role does not have permission for this action.',
    );
  }
}
