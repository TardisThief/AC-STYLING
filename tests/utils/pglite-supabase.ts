import type { PGlite, Transaction } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ApiRole } from './pglite-db';

/**
 * A supabase-js-shaped client over PGlite, so the real server code — not a
 * mock of it — runs against the live schema's constraints, unique indexes and
 * RLS.
 *
 * Deliberately small and deliberately strict. It implements the query-builder
 * calls the code under test actually makes and THROWS on anything else,
 * including an option it does not understand. A permissive adapter that
 * approximated an unfamiliar call would be one more thing that agrees with the
 * code instead of testing it.
 *
 * Semantics copied from PostgREST where they matter to the code under test:
 *   - an error comes back as `{ data: null, error: { code, message } }` with
 *     the Postgres SQLSTATE (so `23505` checks are exercised for real);
 *   - `maybeSingle()` on 0 rows is `data: null`, on >1 rows an error;
 *   - `upsert(..., { ignoreDuplicates: true }).select()` returns only the rows
 *     actually inserted — the property the webhook's idempotency gate relies on;
 *   - timestamps come back as ISO strings, not Date objects.
 *
 * Each statement runs in its own transaction as `role` (service_role by
 * default, which is what createAdminClient() is). Two awaits in the code under
 * test are two transactions, so a read-then-write race is reproducible.
 */

type Filter = { column: string; op: '=' | 'IS' | 'IS NOT' | 'IN' | '>' | '<'; value: unknown };
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number | null };

const IDENT = /^[a-z_][a-z0-9_]*$/;

function ident(name: string): string {
    if (!IDENT.test(name)) throw new Error(`pglite-supabase: unsupported identifier "${name}"`);
    return `"${name}"`;
}

function columnList(columns: string): string {
    const trimmed = columns.trim();
    if (trimmed === '*' || trimmed === '') return '*';
    return trimmed.split(',').map(c => ident(c.trim())).join(', ');
}

function checkValue(value: unknown): unknown {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
    // A plain object can only be bound for a jsonb column; Postgres parses the
    // text against the column type. Arrays are refused: they may be text[].
    if (typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype) {
        return JSON.stringify(value);
    }
    throw new Error(`pglite-supabase: unsupported value ${JSON.stringify(value)} (array columns are not implemented)`);
}

function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
    return out;
}

function onlyKnownOptions(options: Record<string, unknown> | undefined, known: string[], where: string) {
    for (const key of Object.keys(options ?? {})) {
        if (!known.includes(key)) throw new Error(`pglite-supabase: unsupported ${where} option "${key}"`);
    }
}

class Builder implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' | null = null;
    private columns = '*';
    private returning: string | null = null;
    private values: Record<string, unknown>[] = [];
    private filters: Filter[] = [];
    private conflict: string | null = null;
    private ignoreDuplicates = false;
    private countExact = false;
    private head = false;
    private cardinality: 'many' | 'maybe' | 'one' = 'many';
    private ordering: { column: string; ascending: boolean }[] = [];
    private rowLimit: number | null = null;

    constructor(private db: PGlite, private role: ApiRole, private userId: string | null, private table: string) {
        ident(table);
    }

    select(columns = '*', options?: { count?: string; head?: boolean }) {
        onlyKnownOptions(options, ['count', 'head'], 'select');
        if (options?.count && options.count !== 'exact') throw new Error('pglite-supabase: only count: "exact" is supported');
        if (this.op === null) {
            this.op = 'select';
            this.columns = columns;
            this.countExact = options?.count === 'exact';
            this.head = options?.head === true;
        } else {
            if (options) throw new Error('pglite-supabase: select() options after a write are not supported');
            this.returning = columns;
        }
        return this;
    }

    insert(values: Record<string, unknown> | Record<string, unknown>[]) {
        this.op = 'insert';
        this.values = Array.isArray(values) ? values : [values];
        return this;
    }

    upsert(values: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        onlyKnownOptions(options, ['onConflict', 'ignoreDuplicates'], 'upsert');
        if (!options?.onConflict) throw new Error('pglite-supabase: upsert() requires onConflict');
        this.op = 'upsert';
        this.values = Array.isArray(values) ? values : [values];
        this.conflict = options.onConflict;
        this.ignoreDuplicates = options.ignoreDuplicates === true;
        return this;
    }

    update(values: Record<string, unknown>) {
        this.op = 'update';
        this.values = [values];
        return this;
    }

    delete() {
        this.op = 'delete';
        return this;
    }

    eq(column: string, value: unknown) { this.filters.push({ column, op: '=', value: checkValue(value) }); return this; }
    gt(column: string, value: unknown) { this.filters.push({ column, op: '>', value: checkValue(value) }); return this; }
    lt(column: string, value: unknown) { this.filters.push({ column, op: '<', value: checkValue(value) }); return this; }
    is(column: string, value: null) {
        if (value !== null) throw new Error('pglite-supabase: only is(column, null) is supported');
        this.filters.push({ column, op: 'IS', value: null });
        return this;
    }
    not(column: string, operator: string, value: null) {
        if (operator !== 'is' || value !== null) throw new Error('pglite-supabase: only not(column, "is", null) is supported');
        this.filters.push({ column, op: 'IS NOT', value: null });
        return this;
    }
    order(column: string, options?: { ascending?: boolean }) {
        onlyKnownOptions(options, ['ascending'], 'order');
        ident(column);
        // PostgREST's default direction is ascending, nulls last.
        this.ordering.push({ column, ascending: options?.ascending !== false });
        return this;
    }
    limit(count: number) {
        if (!Number.isInteger(count) || count < 0) throw new Error('pglite-supabase: limit() needs a non-negative integer');
        this.rowLimit = count;
        return this;
    }
    in(column: string, values: unknown[]) { this.filters.push({ column, op: 'IN', value: values.map(checkValue) }); return this; }

    maybeSingle() { this.cardinality = 'maybe'; return this; }
    single() { this.cardinality = 'one'; return this; }

    then<A = Result, B = never>(onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
        return this.execute().then(onfulfilled, onrejected);
    }

    private where(params: unknown[]): string {
        if (this.filters.length === 0) return '';
        const parts = this.filters.map(f => {
            if (f.op === 'IS') return `${ident(f.column)} IS NULL`;
            if (f.op === 'IS NOT') return `${ident(f.column)} IS NOT NULL`;
            params.push(f.value);
            return f.op === 'IN'
                ? `${ident(f.column)} = ANY($${params.length})`
                : `${ident(f.column)} ${f.op} $${params.length}`;
        });
        return ` WHERE ${parts.join(' AND ')}`;
    }

    private build(): { sql: string; params: unknown[] } {
        const params: unknown[] = [];
        const table = `public.${ident(this.table)}`;
        const returning = this.returning === null ? '' : ` RETURNING ${columnList(this.returning)}`;

        if (this.op === 'select') {
            const cols = this.countExact && this.head ? 'count(*)::int AS count' : columnList(this.columns);
            if (this.countExact && !this.head) throw new Error('pglite-supabase: count without head is not implemented');
            const order = this.ordering.length
                ? ` ORDER BY ${this.ordering.map(o => `${ident(o.column)} ${o.ascending ? 'ASC' : 'DESC'} NULLS LAST`).join(', ')}`
                : '';
            const limit = this.rowLimit === null ? '' : ` LIMIT ${this.rowLimit}`;
            return { sql: `SELECT ${cols} FROM ${table}${this.where(params)}${order}${limit}`, params };
        }
        if (this.ordering.length || this.rowLimit !== null) throw new Error('pglite-supabase: order()/limit() are only supported on select');
        if (this.op === 'delete') return { sql: `DELETE FROM ${table}${this.where(params)}${returning}`, params };
        if (this.op === 'update') {
            const sets = Object.entries(this.values[0]).map(([k, v]) => { params.push(checkValue(v)); return `${ident(k)} = $${params.length}`; });
            return { sql: `UPDATE ${table} SET ${sets.join(', ')}${this.where(params)}${returning}`, params };
        }
        if (this.op === 'insert' || this.op === 'upsert') {
            if (this.filters.length) throw new Error('pglite-supabase: filters on insert are not supported');
            const keys = Object.keys(this.values[0]);
            const rows = this.values.map(row => {
                if (Object.keys(row).join() !== keys.join()) throw new Error('pglite-supabase: rows with differing keys are not supported');
                return `(${keys.map(k => { params.push(checkValue(row[k])); return `$${params.length}`; }).join(', ')})`;
            });
            let sql = `INSERT INTO ${table} (${keys.map(ident).join(', ')}) VALUES ${rows.join(', ')}`;
            if (this.op === 'upsert') {
                const target = this.conflict!.split(',').map(c => ident(c.trim())).join(', ');
                sql += this.ignoreDuplicates
                    ? ` ON CONFLICT (${target}) DO NOTHING`
                    : ` ON CONFLICT (${target}) DO UPDATE SET ${keys.map(k => `${ident(k)} = EXCLUDED.${ident(k)}`).join(', ')}`;
            }
            return { sql: sql + returning, params };
        }
        throw new Error('pglite-supabase: no operation (call select/insert/update/upsert/delete)');
    }

    private async execute(): Promise<Result> {
        const { sql, params } = this.build();
        let rows: Record<string, unknown>[];
        try {
            rows = await this.db.transaction(async (tx: Transaction) => {
                await tx.exec(`SET LOCAL ROLE ${this.role}`);
                await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [this.userId ?? '', this.role]);
                return (await tx.query<Record<string, unknown>>(sql, params)).rows;
            });
        } catch (e) {
            const err = e as { code?: string; message: string };
            if (!err.code) throw e; // not a database error: a bug in the adapter or the test
            return { data: null, error: { code: err.code, message: err.message } };
        }

        if (this.op === 'select' && this.countExact && this.head) {
            return { data: null, error: null, count: rows[0].count as number };
        }
        const isWrite = this.op !== 'select';
        if (isWrite && this.returning === null) return { data: null, error: null };

        const data = rows.map(normaliseRow);
        if (this.cardinality === 'many') return { data, error: null };
        if (data.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
        if (data.length === 0) {
            return this.cardinality === 'maybe'
                ? { data: null, error: null }
                : { data: null, error: { code: 'PGRST116', message: 'no rows returned' } };
        }
        return { data: data[0], error: null };
    }
}

/** A client that behaves like `createAdminClient()` (or a user's client, via `role`). */
export function pgliteSupabase(db: PGlite, role: ApiRole = 'service_role', userId: string | null = null): SupabaseClient {
    const client = {
        from: (table: string) => new Builder(db, role, userId, table),
        /**
         * `select public.fn(arg => $1, ...)` as `role`, named arguments only,
         * returning the scalar as `data` — what supabase-js gives for a
         * function returning a single value. Set-returning functions are not
         * implemented.
         */
        rpc: async (fn: string, args: Record<string, unknown> = {}): Promise<Result> => {
            ident(fn);
            const keys = Object.keys(args);
            const params = keys.map(k => checkValue(args[k]));
            const call = `SELECT public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(', ')}) AS result`;
            try {
                const rows = await db.transaction(async (tx: Transaction) => {
                    await tx.exec(`SET LOCAL ROLE ${role}`);
                    await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [userId ?? '', role]);
                    return (await tx.query<{ result: unknown }>(call, params)).rows;
                });
                const value = rows[0]?.result;
                return { data: value instanceof Date ? value.toISOString() : value ?? null, error: null };
            } catch (e) {
                const err = e as { code?: string; message: string };
                if (!err.code) throw e;
                return { data: null, error: { code: err.code, message: err.message } };
            }
        },
    };
    return new Proxy(client, {
        get(target, prop) {
            if (prop in target) return target[prop as keyof typeof target];
            if (prop === 'then') return undefined; // not a thenable
            throw new Error(`pglite-supabase: client.${String(prop)} is not implemented`);
        },
    }) as unknown as SupabaseClient;
}
