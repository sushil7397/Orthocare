"""Distributed slot lock to prevent double-booking during the booking handshake.

Uses Redis SET NX EX when REDIS_URL is reachable; otherwise an in-process
fallback (single-worker dev only). The DB UNIQUE(doctor_id, starts_at)
constraint is the final source of truth either way.
"""
import threading
import time

from ..config import settings

_local_locks: dict[str, float] = {}
_local_guard = threading.Lock()

try:
    import redis  # type: ignore
    _r = redis.from_url(settings.redis_url, socket_connect_timeout=0.5)
    _r.ping()
    _REDIS_OK = True
except Exception:
    _r = None
    _REDIS_OK = False


def _key(doctor_id: str, starts_at_iso: str) -> str:
    return f"slot_lock:{doctor_id}:{starts_at_iso}"


def acquire_slot(doctor_id: str, starts_at_iso: str) -> bool:
    ttl = settings.slot_hold_minutes * 60
    key = _key(doctor_id, starts_at_iso)
    if _REDIS_OK:
        return bool(_r.set(key, "1", nx=True, ex=ttl))
    # In-process fallback
    now = time.time()
    with _local_guard:
        exp = _local_locks.get(key)
        if exp and exp > now:
            return False
        _local_locks[key] = now + ttl
        return True


def release_slot(doctor_id: str, starts_at_iso: str) -> None:
    key = _key(doctor_id, starts_at_iso)
    if _REDIS_OK:
        _r.delete(key)
    else:
        with _local_guard:
            _local_locks.pop(key, None)


def backend_name() -> str:
    return "redis" if _REDIS_OK else "in-process"
