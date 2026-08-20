import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoomDto {
  @IsString() @IsNotEmpty() name!: string;
}

/** Editar un consultorio. Los dos campos son opcionales: se manda lo que cambió. */
export class UpdateRoomDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  /** Desactivar en vez de borrar: hay turnos que referencian la sala. */
  @IsOptional() @IsBoolean() isActive?: boolean;
}
