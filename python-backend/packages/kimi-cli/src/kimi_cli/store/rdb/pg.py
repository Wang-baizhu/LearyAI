"""Responsibilities: asyncpg connection config/pool and schema management."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, AsyncIterator

import asyncpg


@dataclass(frozen=True)
class PgConfig:
    dsn: str | None
    host: str | None
    port: int | None
    user: str | None
    password: str | None
    database: str | None
    pool_max_size: int
    pool_min_size: int

    @staticmethod
    def _env(name: str) -> str | None:
        value = os.getenv(name)
        if value is None:
            return None
        value = value.strip()
        return value if value else None

    @classmethod
    def from_env(cls) -> "PgConfig":
        dsn = cls._env("LEARY_PG_DSN")
        host = cls._env("LEARY_PG_HOST")
        port_raw = cls._env("LEARY_PG_PORT")
        user = cls._env("LEARY_PG_USER")
        password = cls._env("LEARY_PG_PASSWORD")
        database = cls._env("LEARY_PG_DATABASE")
        port = int(port_raw) if port_raw is not None else None
        pool_max_size = cls._parse_positive_int("KIMI_PG_POOL_MAX_SIZE", default=100)
        pool_min_size = cls._parse_non_negative_int("KIMI_PG_POOL_MIN_SIZE", default=2)
        if pool_min_size > pool_max_size:
            raise ValueError("KIMI_PG_POOL_MIN_SIZE cannot be greater than KIMI_PG_POOL_MAX_SIZE")
        if dsn is None:
            missing = [
                name
                for name, value in [
                    ("LEARY_PG_HOST", host),
                    ("LEARY_PG_PORT", port),
                    ("LEARY_PG_USER", user),
                    ("LEARY_PG_PASSWORD", password),
                    ("LEARY_PG_DATABASE", database),
                ]
                if value is None
            ]
            if missing:
                raise ValueError(f"Missing PG config env vars: {', '.join(missing)}")
        return cls(
            dsn=dsn,
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            pool_max_size=pool_max_size,
            pool_min_size=pool_min_size,
        )

    @classmethod
    def _parse_positive_int(cls, name: str, *, default: int) -> int:
        raw = cls._env(name)
        if raw is None:
            return default
        value = int(raw)
        if value <= 0:
            raise ValueError(f"{name} must be greater than 0")
        return value

    @classmethod
    def _parse_non_negative_int(cls, name: str, *, default: int) -> int:
        raw = cls._env(name)
        if raw is None:
            return default
        value = int(raw)
        if value < 0:
            raise ValueError(f"{name} must be greater than or equal to 0")
        return value

    def connect_kwargs(self) -> dict[str, Any]:
        if self.dsn is not None:
            return {"dsn": self.dsn}
        return {
            "host": self.host,
            "port": self.port,
            "user": self.user,
            "password": self.password,
            "database": self.database,
        }


class PgPool:
    def __init__(self, config: PgConfig) -> None:
        self._config = config
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(
            **self._config.connect_kwargs(),
            min_size=self._config.pool_min_size,
            max_size=self._config.pool_max_size,
        )

    async def close(self) -> None:
        if self._pool is None:
            return
        await self._pool.close()
        self._pool = None

    def get_size(self) -> int:
        if self._pool is None:
            return 0
        return self._pool.get_size()

    def get_idle_size(self) -> int:
        if self._pool is None:
            return 0
        return self._pool.get_idle_size()

    async def acquire(self) -> AsyncIterator[asyncpg.Connection]:
        if self._pool is None:
            raise RuntimeError("PG pool is not connected")
        async with self._pool.acquire() as conn:
            yield conn


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS learyai_metadata (
    user_id TEXT NOT NULL DEFAULT 'user',
    id INTEGER NOT NULL,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS sessions (
    user_id TEXT NOT NULL DEFAULT 'user',
    session_id TEXT NOT NULL,
    kb_id TEXT,
    name TEXT DEFAULT '新对话',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    context_next_seq BIGINT NOT NULL DEFAULT 0,
    wire_next_seq BIGINT NOT NULL DEFAULT 0,
    wire_protocol_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, session_id)
);

ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS kb_id TEXT;
ALTER TABLE IF EXISTS sessions
    ALTER COLUMN kb_id DROP DEFAULT;
ALTER TABLE IF EXISTS sessions
    ALTER COLUMN kb_id DROP NOT NULL;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS name TEXT DEFAULT '新对话';
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS context_next_seq BIGINT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS wire_next_seq BIGINT NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS sessions
    ADD COLUMN IF NOT EXISTS wire_protocol_version TEXT;

UPDATE sessions
SET name='新对话'
WHERE name IS NULL;
UPDATE sessions
SET kb_id=NULL
WHERE kb_id::text='';

DO $$
DECLARE
    kb_id_type regtype;
BEGIN
    IF to_regclass('public.knowledge_base') IS NULL THEN
        RETURN;
    END IF;

    SELECT a.atttypid::regtype
    INTO kb_id_type
    FROM pg_attribute AS a
    JOIN pg_class AS c ON c.oid = a.attrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'knowledge_base'
      AND a.attname = 'kb_id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF kb_id_type IS NULL THEN
        RETURN;
    END IF;

    IF kb_id_type::text = 'uuid' THEN
        UPDATE sessions
        SET kb_id=NULL
        WHERE kb_id IS NOT NULL
          AND (
              kb_id::text = ''
              OR kb_id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          );
        ALTER TABLE sessions
            ALTER COLUMN kb_id TYPE uuid USING NULLIF(kb_id::text, '')::uuid;
        UPDATE sessions AS s
        SET kb_id=NULL
        WHERE kb_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.knowledge_base AS kb
              WHERE kb.kb_id = s.kb_id
          );
    ELSE
        ALTER TABLE sessions
            ALTER COLUMN kb_id TYPE text USING kb_id::text;
        UPDATE sessions
        SET kb_id=NULL
        WHERE kb_id='';
        UPDATE sessions AS s
        SET kb_id=NULL
        WHERE kb_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.knowledge_base AS kb
              WHERE kb.kb_id::text = s.kb_id
          );
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.knowledge_base') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'sessions_kb_id_fkey'
              AND conrelid = 'sessions'::regclass
        ) THEN
            ALTER TABLE sessions
                ADD CONSTRAINT sessions_kb_id_fkey
                FOREIGN KEY (kb_id)
                REFERENCES public.knowledge_base (kb_id)
                ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS subagent_sessions (
    user_id TEXT NOT NULL DEFAULT 'user',
    agent_id TEXT NOT NULL,
    parent_session_id TEXT NOT NULL,
    subagent_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    context_next_seq BIGINT NOT NULL DEFAULT 0,
    wire_next_seq BIGINT NOT NULL DEFAULT 0,
    wire_protocol_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, agent_id),
    FOREIGN KEY (user_id, parent_session_id)
        REFERENCES sessions (user_id, session_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS session_context_events (
    user_id TEXT NOT NULL DEFAULT 'user',
    session_id TEXT NOT NULL,
    seq BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, session_id, seq)
);

CREATE TABLE IF NOT EXISTS session_wire_records (
    user_id TEXT NOT NULL DEFAULT 'user',
    session_id TEXT NOT NULL,
    seq BIGINT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, session_id, seq)
);

ALTER TABLE IF EXISTS session_context_events
    DROP CONSTRAINT IF EXISTS session_context_events_user_id_session_id_fkey;
ALTER TABLE IF EXISTS session_wire_records
    DROP CONSTRAINT IF EXISTS session_wire_records_user_id_session_id_fkey;

DO $$
BEGIN
    IF to_regclass('session_context_events') IS NOT NULL THEN
        UPDATE sessions AS s
        SET context_next_seq = GREATEST(
            s.context_next_seq,
            COALESCE((
                SELECT MAX(e.seq) + 1
                FROM session_context_events AS e
                WHERE e.user_id = s.user_id
                  AND e.session_id = s.session_id
            ), 0)
        );
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('session_context_meta') IS NOT NULL THEN
        UPDATE sessions AS s
        SET context_next_seq = GREATEST(s.context_next_seq, scm.next_seq)
        FROM session_context_meta AS scm
        WHERE scm.user_id = s.user_id
          AND scm.session_id = s.session_id;
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('session_wire_records') IS NOT NULL THEN
        UPDATE sessions AS s
        SET wire_next_seq = GREATEST(
            s.wire_next_seq,
            COALESCE((
                SELECT MAX(r.seq) + 1
                FROM session_wire_records AS r
                WHERE r.user_id = s.user_id
                  AND r.session_id = s.session_id
            ), 0)
        );
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('session_wire_meta') IS NOT NULL THEN
        UPDATE sessions AS s
        SET wire_next_seq = GREATEST(s.wire_next_seq, swm.next_seq),
            wire_protocol_version = COALESCE(s.wire_protocol_version, swm.protocol_version)
        FROM session_wire_meta AS swm
        WHERE swm.user_id = s.user_id
          AND swm.session_id = s.session_id;
    END IF;
END $$;

ALTER TABLE IF EXISTS session_context_events
    DROP COLUMN IF EXISTS kb_id;
ALTER TABLE IF EXISTS session_wire_records
    DROP COLUMN IF EXISTS kb_id;

DROP TABLE IF EXISTS session_context_meta;
DROP TABLE IF EXISTS session_wire_meta;

CREATE INDEX IF NOT EXISTS idx_context_events_session
    ON session_context_events (user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_wire_records_session
    ON session_wire_records (user_id, session_id);
"""


class SchemaManager:
    def __init__(self, pool: PgPool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        async for conn in self._pool.acquire():
            await conn.execute(SCHEMA_SQL)
