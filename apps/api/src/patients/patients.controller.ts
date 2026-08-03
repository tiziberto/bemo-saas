import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { PatientsService } from './patients.service';
import {
  ClinicalEntryDto,
  CreatePatientDto,
  ImportDto,
  ShareDto,
} from './dto';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('professional')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientDto) {
    return this.patients.create(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.patients.list(user);
  }

  @Post('import')
  import(@CurrentUser() user: AuthUser, @Body() dto: ImportDto) {
    return this.patients.importCsv(user, dto);
  }

  @Post(':personId/clinical-entries')
  addEntry(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
    @Body() dto: ClinicalEntryDto,
  ) {
    return this.patients.addEntry(user, personId, dto);
  }

  @Get(':personId/clinical-entries')
  getEntries(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
  ) {
    return this.patients.getEntries(user, personId);
  }

  @Post(':personId/shares')
  share(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
    @Body() dto: ShareDto,
  ) {
    return this.patients.share(user, personId, dto);
  }

  @Delete(':personId/shares/:shareId')
  revoke(
    @CurrentUser() user: AuthUser,
    @Param('shareId') shareId: string,
  ) {
    return this.patients.revokeShare(user, shareId);
  }
}
