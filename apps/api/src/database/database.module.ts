import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { loadEnv } from '../config/env';
import { DbService } from './db.service';
import { PG_POOL } from './database.constants';

export { PG_POOL } from './database.constants';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () => new Pool({ connectionString: loadEnv().databaseUrl }),
    },
    DbService,
  ],
  exports: [PG_POOL, DbService],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  // Cierra las conexiones al apagar: sin esto el proceso queda colgado
  // (y en producción, con conexiones abiertas contra Postgres).
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
