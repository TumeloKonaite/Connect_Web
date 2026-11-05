"""Password hashing helpers."""

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    """Return a salted Argon2 hash for a plain-text password."""
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    """Check a plain-text password against a stored password hash."""
    return password_hash.verify(password, hashed_password)
