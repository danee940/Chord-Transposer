"""Gunicorn configuration exposing server lifecycle events in the logs."""
# pylint: disable=invalid-name,missing-function-docstring

import os
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from gunicorn.glogging import Logger
    from gunicorn.workers.base import Worker


class _Server(Protocol):
    """The slice of gunicorn's untyped Arbiter that the hooks below use."""

    log: "Logger"


bind = f"0.0.0.0:{os.environ.get('PORT', '8080')}"
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
threads = int(os.environ.get("GUNICORN_THREADS", "4"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "150"))
worker_class = "gthread"

accesslog = "-"
errorlog = "-"
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "info")


def on_starting(server: _Server) -> None:
    server.log.info(
        "gunicorn master starting: bind=%s workers=%s timeout=%ss", bind, workers, timeout
    )


def when_ready(server: _Server) -> None:
    server.log.info("gunicorn ready and accepting connections on %s", bind)


def worker_int(worker: "Worker") -> None:
    worker.log.warning("worker %s received SIGINT/SIGQUIT, shutting down", worker.pid)


def worker_abort(worker: "Worker") -> None:
    worker.log.error("worker %s aborted (likely request timeout after %ss)", worker.pid, timeout)


def worker_exit(server: _Server, worker: "Worker") -> None:
    server.log.info("worker %s exited", worker.pid)


def on_exit(server: _Server) -> None:
    server.log.warning("gunicorn master shutting down; container is stopping")
