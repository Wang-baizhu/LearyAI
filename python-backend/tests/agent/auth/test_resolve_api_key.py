"""该文件职责：验证 OAuthManager 在当前 Leary 配置模型下的 API key 解析与刷新行为。"""

from __future__ import annotations

import time
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import SecretStr

from kimi_cli.auth.oauth import OAuthManager, OAuthToken
from kimi_cli.config import (
    Config,
    LLMModel,
    LLMProvider,
    MoonshotFetchConfig,
    MoonshotSearchConfig,
    OAuthRef,
    Services,
)


def _make_config(
    *,
    provider_oauth: bool = True,
    search_oauth: bool = False,
    fetch_oauth: bool = False,
) -> Config:
    provider = LLMProvider(
        type="kimi",
        base_url="https://api.test/v1",
        api_key=SecretStr("provider-fallback"),
        oauth=OAuthRef(storage="file", key="oauth/provider") if provider_oauth else None,
    )
    model = LLMModel(provider="managed:kimi-code", model="test-model", max_context_size=100_000)
    services = Services(
        moonshot_search=MoonshotSearchConfig(
            base_url="https://search.test",
            api_key=SecretStr("search-fallback"),
            oauth=OAuthRef(storage="file", key="oauth/search") if search_oauth else None,
        ),
        moonshot_fetch=MoonshotFetchConfig(
            base_url="https://fetch.test",
            api_key=SecretStr("fetch-fallback"),
            oauth=OAuthRef(storage="file", key="oauth/fetch") if fetch_oauth else None,
        ),
    )
    return Config(
        default_model="managed:kimi-code/test-model",
        providers={"managed:kimi-code": provider},
        models={"managed:kimi-code/test-model": model},
        services=services,
    )


def _make_manager(config: Config, initial_token: OAuthToken | None = None) -> OAuthManager:
    with patch("kimi_cli.auth.oauth.load_tokens", return_value=initial_token):
        return OAuthManager(config)


def test_resolve_api_key_prefers_cached_oauth_token() -> None:
    config = _make_config(provider_oauth=True)
    token = OAuthToken(
        access_token="oauth-token",
        refresh_token="refresh-token",
        expires_at=0.0,
        scope="",
        token_type="Bearer",
    )
    manager = _make_manager(config, initial_token=token)

    result = manager.resolve_api_key(
        SecretStr("fallback"),
        OAuthRef(storage="file", key="oauth/provider"),
    )

    assert result == "oauth-token"


def test_resolve_api_key_falls_back_when_token_missing() -> None:
    config = _make_config(provider_oauth=True)
    manager = _make_manager(config, initial_token=None)

    with patch("kimi_cli.auth.oauth.load_tokens", return_value=None):
        result = manager.resolve_api_key(
            SecretStr("fallback-key"),
            OAuthRef(storage="file", key="oauth/provider"),
        )

    assert result == "fallback-key"


def test_resolve_api_key_supports_service_level_oauth_refs() -> None:
    config = _make_config(provider_oauth=False, search_oauth=True, fetch_oauth=True)
    search_token = OAuthToken(
        access_token="search-token",
        refresh_token="refresh-search",
        expires_at=0.0,
        scope="",
        token_type="Bearer",
    )
    fetch_token = OAuthToken(
        access_token="fetch-token",
        refresh_token="refresh-fetch",
        expires_at=0.0,
        scope="",
        token_type="Bearer",
    )

    with patch(
        "kimi_cli.auth.oauth.load_tokens",
        side_effect=[search_token, fetch_token],
    ):
        manager = OAuthManager(config)

    assert manager.resolve_api_key(
        config.services.moonshot_search.api_key,
        config.services.moonshot_search.oauth,
    ) == "search-token"
    assert manager.resolve_api_key(
        config.services.moonshot_fetch.api_key,
        config.services.moonshot_fetch.oauth,
    ) == "fetch-token"


@pytest.mark.asyncio
async def test_ensure_fresh_updates_cached_token_without_runtime() -> None:
    config = _make_config(provider_oauth=True)
    manager = _make_manager(config, initial_token=None)
    fresh_token = OAuthToken(
        access_token="fresh-access-token",
        refresh_token="refresh-123",
        expires_at=time.time() + 3600,
        scope="",
        token_type="Bearer",
    )

    with patch("kimi_cli.auth.oauth.load_tokens", return_value=fresh_token):
        await manager.ensure_fresh()

    assert manager.resolve_api_key(
        SecretStr("fallback"),
        OAuthRef(storage="file", key="oauth/provider"),
    ) == "fresh-access-token"


@pytest.mark.asyncio
async def test_ensure_fresh_refreshes_expired_token_without_runtime() -> None:
    config = _make_config(provider_oauth=True)
    manager = _make_manager(config, initial_token=None)
    expired_token = OAuthToken(
        access_token="expired-access",
        refresh_token="refresh-123",
        expires_at=time.time() - 100,
        scope="",
        token_type="Bearer",
    )
    refreshed_token = OAuthToken(
        access_token="refreshed-access",
        refresh_token="new-refresh",
        expires_at=time.time() + 3600,
        scope="",
        token_type="Bearer",
    )

    async def fake_refresh(ref, token, runtime, *, force=False):
        manager._cache_access_token(ref, refreshed_token)

    with (
        patch("kimi_cli.auth.oauth.load_tokens", return_value=expired_token),
        patch.object(manager, "_refresh_tokens", new=AsyncMock(side_effect=fake_refresh)) as refresh_mock,
    ):
        await manager.ensure_fresh()

    refresh_mock.assert_awaited_once()
    assert manager.resolve_api_key(
        SecretStr("fallback"),
        OAuthRef(storage="file", key="oauth/provider"),
    ) == "refreshed-access"
