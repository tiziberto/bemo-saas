import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { UsersService } from './users.service';
import { InviteDto } from './dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('invite')
  @Roles('admin')
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteDto) {
    return this.users.invite(user, dto);
  }

  @Get()
  @Roles('admin')
  list(@CurrentUser() user: AuthUser) {
    return this.users.list(user);
  }

  // Cualquiera autenticado puede listar profesionales (la recepción los necesita para agendar).
  @Get('professionals')
  listProfessionals(@CurrentUser() user: AuthUser) {
    return this.users.listProfessionals(user);
  }
}
