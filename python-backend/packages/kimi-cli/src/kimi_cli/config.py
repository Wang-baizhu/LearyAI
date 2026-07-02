"""该文件职责：定义 kimi-cli 的配置模型，并负责配置文件的加载、校验与保存。"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Self

import tomlkit
from pydantic import BaseModel, Field, SecretStr, ValidationError, field_serializer, model_validator
from tomlkit.exceptions import TOMLKitError

from kimi_cli.exception import ConfigError
from kimi_cli.hooks.config import HookDef
from kimi_cli.llm import ModelCapability, ProviderType
from kimi_cli.share import get_share_dir
from kimi_cli.utils.logging import logger


_TRUE_ENV_VALUES = frozenset({"1", "true", "yes", "on"})
_TURN_MODE_VALUES = frozenset({"normal", "record", "replay"})


def is_wire_simplify_store_enabled() -> bool:
    """Whether wire persistence should store only key messages."""
    raw = os.getenv("KIMI_WIRE_SIMPLIFY_STORE")
    if raw is None:
        return False
    return raw.strip().lower() in _TRUE_ENV_VALUES


def get_turn_mode() -> str:
    """Get the global turn mode from `KIMI_TURN_MODE`."""
    raw = os.getenv("KIMI_TURN_MODE", "normal").strip().lower()
    if raw not in _TURN_MODE_VALUES:
        raise ValueError(f"Invalid KIMI_TURN_MODE value: {raw}")
    return raw


def _env_bool_override(name: str) -> bool | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    return raw.strip().lower() in _TRUE_ENV_VALUES


class LLMProvider(BaseModel):
    """LLM provider configuration."""

    type: ProviderType
    """Provider type"""
    base_url: str
    """API base URL"""
    api_key: SecretStr
    """API key"""
    env: dict[str, str] | None = None
    """Environment variables to set before creating the provider instance"""
    custom_headers: dict[str, str] | None = None
    """Custom headers to include in API requests"""
    oauth: OAuthRef | None = None
    """Optional OAuth token source used instead of the raw api_key."""

    @field_serializer("api_key", when_used="json")
    def dump_secret(self, v: SecretStr):
        return v.get_secret_value()


class OAuthRef(BaseModel):
    """Reference to a persisted OAuth token set."""

    storage: str = Field(default="file", description="OAuth token storage backend.")
    key: str = Field(description="Stable key used to load persisted OAuth tokens.")


class LLMModel(BaseModel):
    """LLM model configuration."""

    provider: str
    """Provider name"""
    model: str
    """Model name"""
    max_context_size: int
    """Maximum context size (unit: tokens)"""
    capabilities: set[ModelCapability] | None = None
    """Model capabilities"""


class LoopControl(BaseModel):
    """Agent loop control configuration."""

    max_steps_per_turn: int = Field(default=100, ge=1, validation_alias="max_steps_per_run")
    """Maximum number of steps in one turn"""
    max_subagent_depth: int = Field(default=1, ge=0)
    """Maximum allowed nested subagent depth. Root agent starts at depth 0."""
    max_retries_per_step: int = Field(default=3, ge=1)
    """Maximum number of retries in one step"""
    max_ralph_iterations: int = Field(default=0, ge=-1)
    """Extra iterations after the first turn in Ralph mode. Use -1 for unlimited."""
    reserved_context_size: int = Field(default=50_000, ge=1000)
    """Reserved token count for LLM response generation. Auto-compaction triggers when
    context_tokens + reserved_context_size >= max_context_size. Default is 50000."""


class MoonshotSearchConfig(BaseModel):
    """Moonshot Search configuration."""

    base_url: str
    """Base URL for Moonshot Search service."""
    api_key: SecretStr
    """API key for Moonshot Search service."""
    custom_headers: dict[str, str] | None = None
    """Custom headers to include in API requests."""
    oauth: OAuthRef | None = None
    """Optional OAuth token source used instead of the raw api_key."""

    @field_serializer("api_key", when_used="json")
    def dump_secret(self, v: SecretStr):
        return v.get_secret_value()


class MoonshotFetchConfig(BaseModel):
    """Moonshot Fetch configuration."""

    base_url: str
    """Base URL for Moonshot Fetch service."""
    api_key: SecretStr
    """API key for Moonshot Fetch service."""
    custom_headers: dict[str, str] | None = None
    """Custom headers to include in API requests."""
    oauth: OAuthRef | None = None
    """Optional OAuth token source used instead of the raw api_key."""

    @field_serializer("api_key", when_used="json")
    def dump_secret(self, v: SecretStr):
        return v.get_secret_value()


class Services(BaseModel):
    """Services configuration."""

    moonshot_search: MoonshotSearchConfig | None = None
    """Moonshot Search configuration."""
    moonshot_fetch: MoonshotFetchConfig | None = None
    """Moonshot Fetch configuration."""


class NotificationConfig(BaseModel):
    """Runtime notification behavior."""

    claim_stale_after_ms: int = Field(default=120_000, ge=1_000)
    llm_batch_size: int = Field(default=8, ge=1, le=100)
    notification_tail_chars: int = Field(default=8_000, ge=256)
    notification_tail_lines: int = Field(default=120, ge=1)


class BackgroundConfig(BaseModel):
    """Background task runtime behavior."""

    enabled: bool = True
    max_running_tasks: int = Field(default=8, ge=1, le=128)
    agent_task_timeout_s: int = Field(default=900, ge=1)
    worker_heartbeat_interval_ms: int = Field(default=1_000, ge=100)
    wait_poll_interval_ms: int = Field(default=500, ge=100)
    kill_grace_period_ms: int = Field(default=3_000, ge=100)


class MCPClientConfig(BaseModel):
    """MCP client configuration."""

    tool_call_timeout_ms: int = 60000
    """Timeout for tool calls in milliseconds."""


class MCPConfig(BaseModel):
    """MCP configuration."""

    client: MCPClientConfig = Field(
        default_factory=MCPClientConfig, description="MCP client configuration"
    )


class Config(BaseModel):
    """Main configuration structure."""

    is_from_default_location: bool = Field(
        default=False,
        description="Whether the config was loaded from the default location",
        exclude=True,
    )
    default_model: str = Field(default="", description="Default model to use")
    default_thinking: bool = Field(default=False, description="Default thinking mode")
    default_yolo: bool = Field(default=False, description="Default auto-approval mode")
    default_plan_mode: bool = Field(default=False, description="Whether to start in plan mode")
    defer_mcp_loading: bool = Field(
        default=True,
        description="Whether MCP tool loading should start in background by default",
    )
    models: dict[str, LLMModel] = Field(default_factory=dict, description="List of LLM models")
    providers: dict[str, LLMProvider] = Field(
        default_factory=dict, description="List of LLM providers"
    )
    loop_control: LoopControl = Field(default_factory=LoopControl, description="Agent loop control")
    services: Services = Field(default_factory=Services, description="Services configuration")
    mcp: MCPConfig = Field(default_factory=MCPConfig, description="MCP configuration")
    notifications: NotificationConfig = Field(
        default_factory=NotificationConfig,
        description="Notification runtime configuration",
    )
    background: BackgroundConfig = Field(
        default_factory=BackgroundConfig,
        description="Background task configuration",
    )
    hooks: list[HookDef] = Field(default_factory=list, description="Hook definitions")

    @model_validator(mode="after")
    def validate_model(self) -> Self:
        if self.default_model and self.default_model not in self.models:
            raise ValueError(f"Default model {self.default_model} not found in models")
        for model in self.models.values():
            if model.provider not in self.providers:
                raise ValueError(f"Provider {model.provider} not found in providers")
        return self


def get_config_file() -> Path:
    """Get the configuration file path."""
    return get_share_dir() / "config.toml"


def get_default_config() -> Config:
    """Get the default configuration."""
    return Config(
        default_model="",
        models={},
        providers={},
        services=Services(),
    )


def load_config(config_file: Path | None = None) -> Config:
    """
    Load configuration from config file.
    If the config file does not exist, create it with default configuration.

    Args:
        config_file (Path | None): Path to the configuration file. If None, use default path.

    Returns:
        Validated Config object.

    Raises:
        ConfigError: If the configuration file is invalid.
    """
    default_config_file = get_config_file()
    if config_file is None:
        config_file = default_config_file
    is_default_config_file = config_file.expanduser().resolve(
        strict=False
    ) == default_config_file.expanduser().resolve(strict=False)
    logger.debug("Loading config from file: {file}", file=config_file)

    # If the user hasn't provided an explicit config path, migrate legacy JSON config once.
    if is_default_config_file and not config_file.exists():
        _migrate_json_config_to_toml()

    if not config_file.exists():
        config = get_default_config()
        logger.debug("No config file found, creating default config: {config}", config=config)
        save_config(config, config_file)
        config.is_from_default_location = is_default_config_file
        return config

    try:
        config_text = config_file.read_text(encoding="utf-8")
        if config_file.suffix.lower() == ".json":
            data = json.loads(config_text)
        else:
            data = tomlkit.loads(config_text)
        config = Config.model_validate(data)
    except json.JSONDecodeError as e:
        raise ConfigError(f"Invalid JSON in configuration file: {e}") from e
    except TOMLKitError as e:
        raise ConfigError(f"Invalid TOML in configuration file: {e}") from e
    except ValidationError as e:
        raise ConfigError(f"Invalid configuration file: {e}") from e
    config.is_from_default_location = is_default_config_file
    background_enabled_override = _env_bool_override("KIMI_BACKGROUND_ENABLED")
    if background_enabled_override is not None:
        config.background.enabled = background_enabled_override
    return config


def load_config_from_string(config_string: str) -> Config:
    """
    Load configuration from a TOML or JSON string.

    Args:
        config_string (str): TOML or JSON configuration text.

    Returns:
        Validated Config object.

    Raises:
        ConfigError: If the configuration text is invalid.
    """
    if not config_string.strip():
        raise ConfigError("Configuration text cannot be empty")

    json_error: json.JSONDecodeError | None = None
    try:
        data = json.loads(config_string)
    except json.JSONDecodeError as exc:
        json_error = exc
        data = None

    if data is None:
        try:
            data = tomlkit.loads(config_string)
        except TOMLKitError as toml_error:
            raise ConfigError(
                f"Invalid configuration text: {json_error}; {toml_error}"
            ) from toml_error

    try:
        config = Config.model_validate(data)
    except ValidationError as e:
        raise ConfigError(f"Invalid configuration text: {e}") from e
    config.is_from_default_location = False
    background_enabled_override = _env_bool_override("KIMI_BACKGROUND_ENABLED")
    if background_enabled_override is not None:
        config.background.enabled = background_enabled_override
    return config


def save_config(config: Config, config_file: Path | None = None):
    """
    Save configuration to config file.

    Args:
        config (Config): Config object to save.
        config_file (Path | None): Path to the configuration file. If None, use default path.
    """
    config_file = config_file or get_config_file()
    logger.debug("Saving config to file: {file}", file=config_file)
    config_file.parent.mkdir(parents=True, exist_ok=True)
    config_data = config.model_dump(mode="json", exclude_none=True)
    with open(config_file, "w", encoding="utf-8") as f:
        if config_file.suffix.lower() == ".json":
            f.write(json.dumps(config_data, ensure_ascii=False, indent=2))
        else:
            f.write(tomlkit.dumps(config_data))  # type: ignore[reportUnknownMemberType]


def _migrate_json_config_to_toml() -> None:
    old_json_config_file = get_share_dir() / "config.json"
    new_toml_config_file = get_share_dir() / "config.toml"

    if not old_json_config_file.exists():
        return
    if new_toml_config_file.exists():
        return

    logger.info(
        "Migrating legacy config file from {old} to {new}",
        old=old_json_config_file,
        new=new_toml_config_file,
    )

    try:
        with open(old_json_config_file, encoding="utf-8") as f:
            data = json.load(f)
        config = Config.model_validate(data)
    except json.JSONDecodeError as e:
        raise ConfigError(f"Invalid JSON in legacy configuration file: {e}") from e
    except ValidationError as e:
        raise ConfigError(f"Invalid legacy configuration file: {e}") from e

    # Write new TOML config, then keep a backup of the original JSON file.
    save_config(config, new_toml_config_file)
    backup_path = old_json_config_file.with_name("config.json.bak")
    old_json_config_file.replace(backup_path)
    logger.info("Legacy config backed up to {file}", file=backup_path)
