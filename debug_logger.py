import codecs
import datetime
import os

LOG_FILE = os.path.join(os.path.dirname(__file__), 'debug.log')

def log_error(req, error_type, message, stack=None):
    timestamp = datetime.datetime.now().isoformat()
    entry = f'[{timestamp}] {error_type}: {message}'
    if stack:
        entry += f'\nStack: {stack}'
    if req:
        entry += f'\nMethod: {req.method} URL: {req.url}'
    entry += '\n' + '='*50 + '\n'
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(entry)

def log_request(req, res, duration_ms):
    timestamp = datetime.datetime.now().isoformat()
    entry = f'[{timestamp}] {req.method} {req.url} -> {res.statusCode} ({duration_ms}ms)\n'
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(entry)

print(f'Debug logger initialized: {LOG_FILE}')
