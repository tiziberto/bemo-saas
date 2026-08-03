import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePatientDto {
  @IsString() @IsNotEmpty() dni!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
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
