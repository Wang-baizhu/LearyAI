-- 职责：重置 stress_test 压测用户范围内的 usage 事实与额度状态，供 prepare 脚本复跑使用。
-- 用法：psql -v user_id_min=1 -v user_id_max=100 -f scripts/sql/reset_stress_usage_state.sql

BEGIN;

DELETE FROM usage_commit_outbox
WHERE user_id BETWEEN :user_id_min AND :user_id_max
  AND metric = 'ai_chat_tokens';

DELETE FROM usage_event
WHERE user_id BETWEEN :user_id_min AND :user_id_max
  AND metric = 'ai_chat_tokens';

DELETE FROM subscription_cycle
WHERE user_id BETWEEN :user_id_min AND :user_id_max
  AND metric = 'ai_chat_tokens';

COMMIT;
