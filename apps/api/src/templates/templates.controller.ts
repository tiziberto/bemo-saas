import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';

@ApiTags('clinical-templates')
@ApiBearerAuth()
@Controller('clinical-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
// Sólo quien escribe historia clínica usa preinformes. Recepción no informa.
@Roles('professional')
export class TemplatesController {
  constructor(private readonly plantillas: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.plantillas.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTemplateDto) {
    return this.plantillas.create(user, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.plantillas.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.plantillas.remove(user, id);
  }
}
