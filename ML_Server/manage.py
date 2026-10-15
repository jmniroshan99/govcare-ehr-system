#!/usr/bin/env python
import os
import sys
from pathlib import Path

# Only local service configuration is loaded; a caller's environment takes precedence.
env_file = Path(__file__).resolve().parent / '.env'
if env_file.is_file():
    for line in env_file.read_text(encoding='utf-8').splitlines():
        key, separator, value = line.strip().partition('=')
        if separator and key in {'GOVCARE_RENAL_JWT_SECRET', 'RENAL_ML_ALLOWED_HOSTS', 'DJANGO_SECRET_KEY'}:
            os.environ.setdefault(key, value.strip().strip('"').strip("'"))

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE','ml_server.settings')
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)
