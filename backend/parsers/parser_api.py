#!/usr/bin/env python3
"""QBank Parser API Wrapper - Clean JSON Output"""
import json
import sys
import os
import io

# Add backend/parsers to path for imports
PARSERS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PARSERS_DIR)

def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    """Run parser and return clean JSON."""
    try:
        # Suppress ALL stdout/stderr from harness
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()

        from master_harness import run_harness
        result = run_harness(qp_path, memo_path, paper_code, output_dir)

        # Restore stdout/stderr
        sys.stdout = old_stdout
        sys.stderr = old_stderr

        result['parser_version'] = 'v29'
        result['timestamp'] = __import__('datetime').datetime.now().isoformat()
        result['status'] = 'success'

        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, f'parser_result_{paper_code}.json')
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)

        return result
    except Exception as e:
        sys.stdout = old_stdout if 'old_stdout' in dir() else sys.stdout
        sys.stderr = old_stderr if 'old_stderr' in dir() else sys.stderr
        return {
            'status': 'error',
            'error': str(e),
            'paper_code': paper_code,
            'parser_version': 'v29'
        }

def get_parser_status():
    """Check parser dependencies."""
    status = {
        'python_version': sys.version,
        'parsers_dir': PARSERS_DIR,
        'parsers_available': {}
    }

    parsers = [
        'bilingual_cleaner.py', 'qp_parser_option_b.py',
        'memo_parser_option_b.py', 'master_harness.py'
    ]

    for parser in parsers:
        path = os.path.join(PARSERS_DIR, parser)
        status['parsers_available'][parser] = os.path.exists(path)

    try:
        import fitz
        status['pymupdf'] = True
    except ImportError:
        status['pymupdf'] = False

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

    elif command == 'parse-qp':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'Usage: python parser_api.py parse-qp <qp_path> <paper_code> [output_dir]'}))
            sys.exit(1)
        qp_path = sys.argv[2]
        paper_code = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else None
        try:
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            sys.stdout = io.StringIO()
            sys.stderr = io.StringIO()
            from qp_parser_option_b import extract_qp_items_enhanced
            items = extract_qp_items_enhanced(qp_path, output_dir)
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            result = {
                'status': 'success',
                'parser_version': 'v29',
                'paper_code': paper_code,
                'qp_items': len(items),
                'items': items,
                'timestamp': __import__('datetime').datetime.now().isoformat()
            }
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                with open(os.path.join(output_dir, f'qp_result_{paper_code}.json'), 'w') as f:
                    json.dump(result, f, indent=2)
            print(json.dumps(result, indent=2))
        except Exception as e:
            sys.stdout = old_stdout if 'old_stdout' in dir() else sys.stdout
            sys.stderr = old_stderr if 'old_stderr' in dir() else sys.stderr
            print(json.dumps({'status': 'error', 'error': str(e), 'parser_version': 'v29'}))

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
