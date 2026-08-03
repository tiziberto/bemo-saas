import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// JwtModule viene del SecurityModule global; DbService del DatabaseModule global.
@Module({
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
