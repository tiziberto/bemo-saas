import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { AvailabilityService } from './availability.service';
import { CreateBlockDto, CreateExceptionDto } from './dto';

@ApiTags('availability')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  // === Semana tipo ===

  @Post('availability-blocks')
  @Roles('admin', 'professional')
  createBlock(@CurrentUser() user: AuthUser, @Body() dto: CreateBlockDto) {
    return this.availability.createBlock(user, dto);
  }

  @Get('availability-blocks')
  listBlocks(
    @CurrentUser() user: AuthUser,
    @Query('professionalId') professionalId?: string,
  ) {
    return this.availability.listBlocks(user, professionalId);
  }

  @Delete('availability-blocks/:id')
  @Roles('admin', 'professional')
  deleteBlock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availability.deleteBlock(user, id);
  }

  // === Bloqueos y aperturas puntuales ===

  @Post('availability-exceptions')
  @Roles('admin', 'professional')
  createException(@CurrentUser() user: AuthUser, @Body() dto: CreateExceptionDto) {
    return this.availability.createException(user, dto);
  }

  @Get('availability-exceptions')
  listExceptions(
    @CurrentUser() user: AuthUser,
    @Query('professionalId') professionalId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.availability.listExceptions(user, professionalId, from, to);
  }

  @Delete('availability-exceptions/:id')
  @Roles('admin', 'professional')
  deleteException(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.availability.deleteException(user, id);
  }

  // === Huecos libres (lo que ve la recepción al agendar) ===
  // Acepta un día (`date`) o un rango (`from`/`to`), que es lo que necesita el
  // calendario semanal del asistente de reserva.
  @Get('availability')
  freeSlots(
    @CurrentUser() user: AuthUser,
    @Query('professionalId') professionalId: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const desde = from ?? date!;
    const hasta = to ?? date ?? from!;
    return this.availability.freeSlots(user, professionalId, desde, hasta);
  }
}
