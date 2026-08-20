import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsISO8601,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PersonInput {
  @IsString() @IsNotEmpty() dni!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsIn(['F', 'M', 'X']) sex?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthdate debe ser AAAA-MM-DD' })
  birthdate?: string;
}

export class CreateAppointmentDto {
  @IsString() @IsNotEmpty() professionalId!: string;
  @IsOptional() @IsString() roomId?: string;
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsInt() @Min(5) @Max(360) durationMinutes?: number;
  @IsOptional() @IsString() reason?: string;
  /**
   * Segunda confirmación: se manda sólo después de que el usuario vio el choque y
   * aceptó igual. Sin esto el turno superpuesto se rechaza, como siempre.
   */
  @IsOptional() @IsBoolean() allowOverbook?: boolean;
  @ValidateNested() @Type(() => PersonInput) person!: PersonInput;
}

export class UpdateStatusDto {
  @IsIn(['scheduled', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'])
  status!: string;
}
