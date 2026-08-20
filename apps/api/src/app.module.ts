import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { SecurityModule } from './security/security.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { SpecialtiesModule } from './specialties/specialties.module';
import { TemplatesModule } from './templates/templates.module';
import { AvailabilityModule } from './availability/availability.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PatientsModule } from './patients/patients.module';
import { StorageModule } from './storage/storage.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ReportsModule } from './reports/reports.module';
import { PersonsModule } from './persons/persons.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: loadEnv().throttleLimit }]),
    DatabaseModule,
    SecurityModule,
    HealthModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    SpecialtiesModule,
    TemplatesModule,
    AvailabilityModule,
    AppointmentsModule,
    PatientsModule,
    StorageModule,
    AttachmentsModule,
    ReportsModule,
    PersonsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
