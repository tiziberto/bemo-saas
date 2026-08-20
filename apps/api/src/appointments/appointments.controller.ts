import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateStatusDto } from './dto';

@ApiTags('appointments')
@ApiBearerAuth()
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appts: AppointmentsService) {}

  @Post()
  @Roles('admin', 'receptionist')
  book(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.appts.book(user, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('professionalId') professionalId?: string,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const n = Number(limit);
    const acotado = Number.isInteger(n) && n > 0 ? Math.min(n, 500) : undefined;
    return this.appts.list(user, professionalId, date, acotado);
  }

  @Patch(':id/status')
  // El profesional tiene que poder marcar "Llegó" y "Atender" de SUS turnos:
  // sin esto la sala de espera no la puede operar quien atiende. El servicio se
  // encarga de que no toque los de otro.
  @Roles('admin', 'receptionist', 'professional')
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.appts.updateStatus(user, id, dto.status);
  }
}
