"""
recursive_memory/identity.py

Per-node cryptographic identity using Ed25519 (fast, small, modern signatures).

Each node owns a private key (stored locally, never sent anywhere) and a public
key (published / pinned at central). When a node creates an entry it SIGNS the
entry id with its private key. Central stores the public key once, then verifies
every entry's signature.

This adds AUTHENTICITY on top of the hash chain's INTEGRITY:
  - hash chain proves the content/order were not altered
  - signature proves WHO authored it and that the author's key approved this id

Honest scope:
  - signatures bind an entry to a key, not to a real-world legal identity. Trust
    in "who" is only as good as how the public key was registered/pinned.
"""
from __future__ import annotations
import base64
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization


def generate_keypair() -> tuple[str, str]:
    """Returns (private_key_b64, public_key_b64)."""
    sk = ed25519.Ed25519PrivateKey.generate()
    pk = sk.public_key()
    sk_b = sk.private_bytes(serialization.Encoding.Raw,
                            serialization.PrivateFormat.Raw,
                            serialization.NoEncryption())
    pk_b = pk.public_bytes(serialization.Encoding.Raw,
                           serialization.PublicFormat.Raw)
    return base64.b64encode(sk_b).decode(), base64.b64encode(pk_b).decode()


def public_from_private(private_b64: str) -> str:
    sk_b = base64.b64decode(private_b64)
    sk = ed25519.Ed25519PrivateKey.from_private_bytes(sk_b)
    pk_b = sk.public_key().public_bytes(serialization.Encoding.Raw,
                                        serialization.PublicFormat.Raw)
    return base64.b64encode(pk_b).decode()


def sign(private_b64: str, message: str) -> str:
    sk = ed25519.Ed25519PrivateKey.from_private_bytes(base64.b64decode(private_b64))
    return base64.b64encode(sk.sign(message.encode())).decode()


def verify(public_b64: str, message: str, signature_b64: str) -> bool:
    try:
        pk = ed25519.Ed25519PublicKey.from_public_bytes(base64.b64decode(public_b64))
        pk.verify(base64.b64decode(signature_b64), message.encode())
        return True
    except Exception:
        return False
