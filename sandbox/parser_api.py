#!/usr/bin/env python3
"""QBank Parser API Wrapper - Clean JSON Output
FIX: Proper stdout suppression to prevent print statements from corrupting JSON output.
"""
import json
import sys
import os
import io

# Add sandbox parsers to path
SANDBOX_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'sandbox')
sys.path.insert(0, SANDBOX_DIR)

def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    """Run parser and return clean JSON."""
    try:
        # Suppress ALL stdout/stderr from harness and parsers
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()

        from master_harness import run_harness
        result = run_harness(qp_path, memo_path, paper_code)

        # Restore stdout/stderr
        sys.stdout = old_stdout
        sys.stderr = old_stderr

        result['parser_version'] = 'v21'
        result['timestamp'] = __import__('datetime').datetime.now().isoformat()
        result['status'] = 'success'

        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, f'parser_result_{paper_code}.json')
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)

        return result
    except Exception as e:
        # Restore stdout/stderr on error
        sys.stdout = old_stdout if 'old_stdout' in dir() else sys.stdout
        sys.stderr = old_stderr if 'old_stderr' in dir() else sys.stderr
        return {
            'status': 'error',
            'error': str(e),
            'paper_code': paper_code,
            'parser_version': 'v21'
        }

def get_parser_status():
    """Check parser dependencies."""
    status = {
        'python_version': sys.version,
        'sandbox_dir_exists': os.path.exists(SANDBOX_DIR),
        'parsers_available': {}
    }

    parsers = [
        'bilingual_cleaner.py', 'docx_extractor.py', 'unified_qp_parser.py',
        'qp_parser_option_a.py', 'qp_parser_option_b.py',
        'memo_parser_option_b.py', 'master_harness.py'
    ]

    for parser in parsers:
        path = os.path.join(SANDBOX_DIR, parser)
        status['parsers_available'][parser] = os.path.exists(path)

    try:
        import PyPDF2
        status['pypdf2'] = True
    except ImportError:
        status['pypdf2'] = False

    try:
        import docx
        status['python-docx'] = True
    except ImportError:
        status['python-docx'] = False

    return status

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command specified'}))
        sys.exit(1)

    command = sys.argv[1]

    if command == 'status':
        print(json.dumps(get_parser_status(), indent=2))

    elif command == 'parse':
        if len(sys.argv) < 5:
            print(json.dumps({'error': 'Usage: python parser_api.py parse <qp_path> <memo_path> <paper_code> [output_dir]'}))
            sys.exit(1)

        qp_path = sys.argv[2]
        memo_path = sys.argv[3]
        paper_code = sys.argv[4]
        output_dir = sys.argv[5] if len(sys.argv) > 5 else None

        result = run_parser(qp_path, memo_path, paper_code, output_dir)
        print(json.dumps(result, indent=2))

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))

