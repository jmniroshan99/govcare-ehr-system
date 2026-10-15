"""Adapters are registered explicitly in code; artifacts are never auto-loaded."""

from .base import PredictiveRiskAdapter, UnavailableRiskAdapter

__all__ = ["PredictiveRiskAdapter", "UnavailableRiskAdapter"]
