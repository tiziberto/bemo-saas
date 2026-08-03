import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { loadEnv } from '../config/env';
import { AuthUser, CurrentUser } from '../security/current-user.decorator';
import { JwtAuthGuard } from '../security/jwt-auth.guard';
import { Roles, RolesGuard } from '../security/roles.guard';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('patients/:personId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('professional')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: loadEnv().maxUploadMb * 1024 * 1024, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('note') note?: string,
  ) {
    return this.attachments.upload(user, personId, file, note);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('personId') personId: string) {
    return this.attachments.list(user, personId);
  }

  // El contenido sale por la API, nunca por una URL pública: acá se verifica el
  // permiso y se audita cada lectura.
  @Get(':id/content')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const row = await this.attachments.getForDownload(user, personId, id);
    res.setHeader('Content-Type', row.mime);
    res.setHeader('Content-Length', row.size_bytes);
    // `inline`: el navegador la muestra; el nombre va entre comillas por si trae espacios.
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${row.filename.replace(/"/g, '')}"`,
    );
    res.setHeader('Cache-Control', 'private, no-store');
    this.attachments.stream(row.storage_key!).pipe(res);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('personId') personId: string,
    @Param('id') id: string,
  ) {
    return this.attachments.remove(user, personId, id);
  }
}
