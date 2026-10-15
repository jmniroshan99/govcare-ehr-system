"""Compatibility entry point: ``uvicorn app:app`` remains supported."""

from .main import app, create_app

__all__ = ["app", "create_app"]
