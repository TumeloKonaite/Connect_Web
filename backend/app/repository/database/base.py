"""Declarative base for repository database tables."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class for all database table mappings."""
