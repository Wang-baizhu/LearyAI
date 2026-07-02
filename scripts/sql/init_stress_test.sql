-- 职责：初始化 stress_test 库中的 auth_user 与 subscription_cycle 测试数据。
-- 适用：PostgreSQL
-- 默认密码：123456
-- 可选变量：
--   quota                默认 15000
--   user_id_min          默认 1
--   user_id_max          默认 100

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

\if :{?quota}
\else
\set quota 15000
\endif

\if :{?user_id_min}
\else
\set user_id_min 1
\endif

\if :{?user_id_max}
\else
\set user_id_max 100
\endif

DELETE FROM subscription_cycle
WHERE user_id BETWEEN :user_id_min AND :user_id_max
  AND metric = 'ai_chat_tokens';

DELETE FROM auth_user
WHERE id BETWEEN :user_id_min AND :user_id_max;

INSERT INTO auth_user (
    id,
    name,
    email,
    phone,
    password_hash,
    status,
    user_mode,
    created_at,
    last_login_at
)
SELECT
    gs AS id,
    ('u' || gs::text) AS name,
    ('user' || gs::text || '@test.com') AS email,
    ('139' || lpad(gs::text, 8, '0')) AS phone,
    crypt('123456', gen_salt('bf', 10)) AS password_hash,
    'ACTIVE' AS status,
    'FREE' AS user_mode,
    NOW() AS created_at,
    NOW() AS last_login_at
FROM generate_series(:user_id_min, :user_id_max) AS gs;

WITH cycle_seed AS (
    SELECT COALESCE(MAX(id), 0) AS base_id
    FROM subscription_cycle
),
cycle_users AS (
    SELECT
        gs AS user_id,
        row_number() OVER (ORDER BY gs) AS row_no
    FROM generate_series(:user_id_min, :user_id_max) AS gs
)
INSERT INTO subscription_cycle (
    id,
    created_at,
    metric,
    plan_id,
    quota,
    status,
    updated_at,
    user_id,
    valid_from,
    valid_to
)
SELECT
    cycle_seed.base_id + cycle_users.row_no AS id,
    TIMESTAMPTZ '2026-06-20 13:05:37.872357+00:00' AS created_at,
    'ai_chat_tokens' AS metric,
    'manual-admin' AS plan_id,
    :quota AS quota,
    'ACTIVE' AS status,
    TIMESTAMPTZ '2026-06-20 13:05:37.872357+00:00' AS updated_at,
    cycle_users.user_id,
    TIMESTAMPTZ '2026-06-20 13:05:00+00:00' AS valid_from,
    TIMESTAMPTZ '2026-07-20 13:05:00+00:00' AS valid_to
FROM cycle_seed
CROSS JOIN cycle_users;

SELECT setval(
    pg_get_serial_sequence('auth_user', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM auth_user), 1),
    true
);

SELECT setval(
    pg_get_serial_sequence('subscription_cycle', 'id'),
    GREATEST((SELECT COALESCE(MAX(id), 1) FROM subscription_cycle), 1),
    true
);

COMMIT;
