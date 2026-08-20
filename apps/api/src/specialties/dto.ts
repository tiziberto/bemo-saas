import { ArrayUnique, IsArray, IsString } from 'class-validator';

/** Qué especialidades ofrece la clínica. Se manda la lista completa, no un delta. */
export class SetClinicSpecialtiesDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) specialtyIds!: string[];
}

/** Qué hace un profesional. Restringidas a las que ofrece su clínica. */
export class SetUserSpecialtiesDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) specialtyIds!: string[];
}
