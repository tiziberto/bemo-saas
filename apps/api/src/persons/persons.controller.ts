import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { RolesGuard } from '../security/roles.guard';
import { PersonsService } from './persons.service';

@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  // Cualquiera autenticado de la clínica: la recepción es la que más lo usa.
  @Get()
  search(
    @CurrentUser() user: AuthUser,
    @Query('dni') dni?: string,
    @Query('q') q?: string,
  ) {
    return this.persons.search(user, dni, q);
  }
}
