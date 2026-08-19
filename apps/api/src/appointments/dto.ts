import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PersonInput {
  @IsString() @IsNotEmpty() dni!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
}

export class CreateAppointmentDto {
  @IsString() @IsNotEmpty() professionalId!: string;
  @IsOptional() @IsString() roomId?: string;
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsInt() @Min(5) durationMinutes?: number;
  @IsOptional() @IsString() reason?: string;
  /**
   * Segunda confirmación: se manda sólo después de que el usuario vio el choque y
   * aceptó igual. Sin esto el turno superpuesto se rechaza, como siempre.
   */
  @IsOptional() @IsBoolean() allowOverbook?: boolean;
  @ValidateNested() @Type(() => PersonInput) person!: PersonInput;
}

export class UpdateStatusDto {
  @IsIn(['scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'])
  status!: string;
}
