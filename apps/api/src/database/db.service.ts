import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { PG_POOL } from './database.constants';

export interface TenantCtx {
  clinicId: string;
  userId: string;
}

/**
 * Errores transitorios de Postgres: la transacción no llegó a aplicarse y
 * reintentarla es correcto (no hay efectos parciales, la transacción abortó).
 * - 40001 serialization_failure
 * - 40P01 deadlock_detected
 */
const TRANSIENT_CODES = new Set(['40001', '40P01']);
const MAX_RETRIES = 3;

function isTransient(err: unknown): boolean {
  return TRANSIENT_CODES.has((err as { code?: string })?.code ?? '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class DbService {
  private readonly logger = new Logger('db');

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params as never[]);
  }

  /**
   * Ejecuta `fn` en una transacción con el contexto de tenant seteado.
   * Las policies RLS filtran por app.current_clinic_id => sin esto no se ve nada.
   *
   * Reintenta ante deadlocks. Con varias reservas simultáneas al mismo horario,
   * el constraint EXCLUDE hace que las transacciones se esperen entre sí y el
   * grafo de esperas puede ciclar: Postgres mata una con 40P01. Sin reintento
   * eso salía como 500 en vez del 409 que corresponde.
   */
  async withTenant<T>(
    ctx: TenantCtx,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.runInTransaction(ctx, fn);
      } catch (err) {
        if (attempt >= MAX_RETRIES || !isTransient(err)) throw err;
        this.logger.warn(
          `transacción reintentada (${(err as { code?: string }).code}) intento ${attempt}/${MAX_RETRIES}`,
        );
        // Espera corta y creciente para deshacer el empate entre competidores.
        await sleep(10 * attempt + Math.floor(Math.random() * 15));
      }
    }
  }

  private async runInTransaction<T>(
    ctx: TenantCtx,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.current_clinic_id', $1, true)", [
        ctx.clinicId,
      ]);
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [
        ctx.userId,
      ]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
