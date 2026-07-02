"""该文件职责：把原始 token usage 统一换算为积分口径。"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

from kosong.chat_provider import TokenUsage


@dataclass(slots=True, frozen=True)
class TokenUsageWeights:
    input_other: Decimal = Decimal("1.0")
    input_cache_read: Decimal = Decimal("0.2")
    input_cache_creation: Decimal = Decimal("0.5")
    output: Decimal = Decimal("4.0")

    def as_strings(self) -> dict[str, str]:
        return {
            "inputOther": str(self.input_other),
            "inputCacheRead": str(self.input_cache_read),
            "inputCacheCreation": str(self.input_cache_creation),
            "output": str(self.output),
        }


@dataclass(slots=True, frozen=True)
class BillingResult:
    points: int
    rule_version: str
    weights: TokenUsageWeights
    input_other: int
    input_cache_read: int
    input_cache_creation: int
    output: int
    total_input: int
    total_tokens: int


def calculate_billing_points(
    usage: TokenUsage,
    *,
    rule_version: str = "v1",
    weights: TokenUsageWeights = TokenUsageWeights(),
) -> BillingResult:
    total = (
        Decimal(usage.input_other) * weights.input_other
        + Decimal(usage.input_cache_read) * weights.input_cache_read
        + Decimal(usage.input_cache_creation) * weights.input_cache_creation
        + Decimal(usage.output) * weights.output
    )
    points = int(total.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    return BillingResult(
        points=points,
        rule_version=rule_version,
        weights=weights,
        input_other=usage.input_other,
        input_cache_read=usage.input_cache_read,
        input_cache_creation=usage.input_cache_creation,
        output=usage.output,
        total_input=usage.input,
        total_tokens=usage.total,
    )
