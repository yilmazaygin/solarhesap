# ./backend/app/core/logger.py
"""Configurable logging system with file and optional stream handlers."""

import logging
from pathlib import Path
from datetime import datetime

from app.core.settings import settings

# Log format constants
LOG_FORMAT = (
    "%(asctime)s | %(levelname)-8s | %(name)-12s "
    "| %(filename)s:%(lineno)d | %(message)s"
)
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
LOG_TMP_DIR = "_tmp_backend_logs"
LOG_FILE_NAME_TEMPLATE = "{date}{ext}"
LOG_FILENAME_DATE_FORMAT = "%Y-%m-%d"
LOG_FILE_EXTENSION = ".log"
LOG_ENCODING = "utf-8"


def get_log_path() -> Path:
    """Determine the log directory from settings or use a temp fallback."""
    env_log_dir = settings.LOG_DIR

    if env_log_dir and env_log_dir.strip():
        target_path = Path(env_log_dir)
        if not target_path.is_absolute():
            target_path = BACKEND_ROOT / env_log_dir
    else:
        target_path = BACKEND_ROOT / LOG_TMP_DIR

    target_path.mkdir(parents=True, exist_ok=True)
    return target_path


def create_logger(
    name: str = "unnamed_logger",
    level: str = settings.LOG_BASE_LEVEL,
) -> logging.Logger:
    """Create and configure a logger with file (and optional stream) handler."""
    logger = logging.getLogger(name)

    # Fall back to DEBUG if the level string is invalid
    numeric_level = getattr(logging, level.upper(), logging.DEBUG)
    logger.setLevel(numeric_level)
    logger.propagate = False

    if not logger.handlers:
        formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

        log_folder = get_log_path()
        today = datetime.now().strftime(LOG_FILENAME_DATE_FORMAT)
        log_filename = LOG_FILE_NAME_TEMPLATE.format(
            date=today, ext=LOG_FILE_EXTENSION,
        )

        file_handler = logging.FileHandler(
            filename=log_folder / log_filename,
            encoding=LOG_ENCODING,
        )
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

        if settings.LOG_STREAM_HANDLER:
            console_handler = logging.StreamHandler()
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)

    return logger


# Singleton logger instance
alogger = create_logger("main_logger", "debug")
alogger.info(
    "Logger %s initialized with log level %s.",
    alogger.name, logging.getLevelName(alogger.level),
)
alogger.debug("'%s' logs will be stored in: %s", alogger.name, get_log_path())
