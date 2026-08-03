import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterClinicDto {
  @IsString() @IsNotEmpty() clinicName!: string;
  @IsOptional() @IsString() timezone?: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() fullName!: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() password!: string;
}

export class RefreshDto {
  @IsOptional() @IsString() refreshToken?: string;
}

export class AcceptInviteDto {
  @IsString() @IsNotEmpty() token!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() @IsNotEmpty() fullName!: string;
}
