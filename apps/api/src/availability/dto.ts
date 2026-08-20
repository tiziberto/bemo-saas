import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateBlockDto {
  @IsOptional() @IsString() professionalId?: string; // admin puede setear otro
  @IsOptional() @IsString() roomId?: string;
  @IsInt() @Min(0) @Max(6) weekday!: number; // 0 = domingo .. 6 = sábado
  @Matches(TIME, { message: 'startTime debe ser HH:MM' }) startTime!: string;
  @Matches(TIME, { message: 'endTime debe ser HH:MM' }) endTime!: string;
  @IsOptional() @IsInt() @Min(5) @Max(360) slotMinutes?: number;
  @IsOptional() @IsString() validFrom?: string;
  @IsOptional() @IsString() validTo?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bloqueo o apertura puntual de agenda.
 * - `remove` sin horario = el día entero (vacaciones, feriado).
 * - `remove` con horario = un rato (una reunión, media jornada).
 * - `add` con horario = horas extra fuera de la semana tipo.
 */
export class CreateExceptionDto {
  @IsOptional() @IsString() professionalId?: string;
  @Matches(DATE, { message: 'date debe ser YYYY-MM-DD' }) date!: string;
  /** Fin del rango, inclusive. Si no viene, el bloqueo es de un solo día. */
  @IsOptional() @Matches(DATE, { message: 'dateTo debe ser YYYY-MM-DD' }) dateTo?: string;
  @IsIn(['remove', 'add']) kind!: 'remove' | 'add';
  @IsOptional() @Matches(TIME, { message: 'startTime debe ser HH:MM' }) startTime?: string;
  @IsOptional() @Matches(TIME, { message: 'endTime debe ser HH:MM' }) endTime?: string;
}
