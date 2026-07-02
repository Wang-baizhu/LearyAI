-- 当前文件职责：在 PostgreSQL 首次初始化时启用 pg_jieba 扩展并创建 jieba 全文检索配置。
CREATE EXTENSION IF NOT EXISTS pg_jieba;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_ts_config
        WHERE cfgname = 'jieba'
    ) THEN
        CREATE TEXT SEARCH CONFIGURATION jieba (PARSER = jieba);
    END IF;
END $$;

ALTER TEXT SEARCH CONFIGURATION jieba
    ADD MAPPING FOR
    eng, nz, n, m, i, l, d, s, t, mq, nr, j, a, r, b, f, nrt, v, z, ns, q, vn, c, nt, u, o,
    zg, nrfg, df, p, g, y, ad, vg, ng, x, ul, k, ag, dg, rr, rg, an, vq, e, uv, tg, mg, ud,
    vi, vd, uj, uz, h, ug, rz
    WITH simple;
