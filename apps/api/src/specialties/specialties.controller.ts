import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { SpecialtiesService } from './specialties.service';
import { SetClinicSpecialtiesDto, SetUserSpecialtiesDto } from './dto';

@ApiTags('specialties')
@ApiBearerAuth()
@Controller()
export class SpecialtiesController {
  constructor(private readonly especialidades: SpecialtiesService) {}

  /**
   * Catálogo completo. SIN guard a propósito: la pantalla de registro lo necesita
   * antes de que exista la sesión, y no expone nada de ninguna clínica — es la
   * misma lista para todo el mundo.
   */
  @Get('specialties')
  catalogo() {
    return this.especialidades.catalogo();
  }

  @Get('clinic/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  deLaClinica(@CurrentUser() user: AuthUser) {
    return this.especialidades.deLaClinica(user);
  }

  @Put('clinic/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  setClinica(@CurrentUser() user: AuthUser, @Body() dto: SetClinicSpecialtiesDto) {
    return this.especialidades.setClinica(user, dto.specialtyIds);
  }

  @Get('users/:id/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  deProfesional(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.especialidades.deProfesional(user, id);
  }

  /**
   * Un profesional edita las suyas; el admin, las de cualquiera del equipo.
   * La comprobación va en el servicio para poder devolver un mensaje que diga
   * qué falta, no un 403 pelado.
   */
  @Put('users/:id/specialties')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'professional')
  setProfesional(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SetUserSpecialtiesDto,
  ) {
    const propio = id === user.userId;
    if (!propio && !user.roles.includes('admin')) {
      return this.especialidades.deProfesional(user, id);
    }
    return this.especialidades.setProfesional(user, id, dto.specialtyIds);
  }
}
