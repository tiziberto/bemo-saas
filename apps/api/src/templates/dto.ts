import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

const TIPOS = ['note', 'diagnosis', 'treatment', 'prescription'];

export class CreateTemplateDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsIn(TIPOS) type!: string;
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

/** Editar. Todo opcional: se manda lo que cambió. */
export class UpdateTemplateDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsIn(TIPOS) type?: string;
  @IsOptional() @IsString() @IsNotEmpty() content?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}
