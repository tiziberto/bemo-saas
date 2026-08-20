import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CreatePatientDto {
  @IsString() @IsNotEmpty() dni!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsIn(['F', 'M', 'X']) sex?: string;
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'birthdate debe ser AAAA-MM-DD' })
  birthdate?: string;
}

export class ClinicalEntryDto {
  @IsIn(['note', 'diagnosis', 'treatment', 'prescription']) type!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsString() entryDate?: string;
}

export class ShareDto {
  @IsString() @IsNotEmpty() sharedWithProfessionalId!: string;
}

export class ImportDto {
  @IsString() @IsNotEmpty() csv!: string;
}
