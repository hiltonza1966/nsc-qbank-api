#!/usr/bin/env python3
"""QBank Parser API Wrapper v2 - Clean JSON Output for Four Parser Architecture

FIXED for PythonShell compatibility:
- Outputs single-line JSON (no indent) for mode: 'json' parsing
- Removed io.StringIO stdout/stderr redirection (breaks PythonShell)
- Deferred all heavy imports (fitz) to prevent import hangs
- Added explicit flush() after every print()
"""
import json
import sys
import os
import warnings

PARSERS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PARSERS_DIR)

def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    """Run parser and return clean JSON."""
    try:
        from master_harness_v2 import run_harness_v2
        result = run_harness_v2(qp_path, memo_path, paper_code, output_dir)

        result['parser_version'] = 'v30'
        result['timestamp'] = __import__('datetime').datetime.now().isoformat()
        result['status'] = 'success'

        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_file = os.path.join(output_dir, f'parser_result_{paper_code}.json')
            with open(output_file, 'w') as f:
                json.dump(result, f, indent=2)

        return result
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e),
            'paper_code': paper_code,
            'parser_version': 'v30'
        }

def get_parser_status():
    """Check parser dependencies."""
    status = {
        'python_version': sys.version,
        'parsers_dir': PARSERS_DIR,
        'parsers_available': {}
    }

    parsers = [
        'bilingual_cleaner.py',
        'qp_content_parser.py', 'memo_content_parser.py',
        'qp_marks_parser.py', 'memo_marks_parser.py',
        'master_harness_v2.py'
    ]

    for parser in parsers:
        path = os.path.join(PARSERS_DIR, parser)
        status['parsers_available'][parser] = os.path.exists(path)

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
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

    status['apiVersion'] = 'v30'
    return status

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command specified'}))
        sys.stdout.flush()
        sys.exit(1)

    command = sys.argv[1]

    if command == 'status':
        print(json.dumps(get_parser_status()))
        sys.stdout.flush()

    elif command == 'parse':
        if len(sys.argv) < 5:
            print(json.dumps({'error': 'Usage: python parser_api_v2.py parse <qp_path> <memo_path> <paper_code> [output_dir]'}))
            sys.stdout.flush()
            sys.exit(1)

        qp_path = sys.argv[2]
        memo_path = sys.argv[3]
        paper_code = sys.argv[4]
        output_dir = sys.argv[5] if len(sys.argv) > 5 else None

        result = run_parser(qp_path, memo_path, paper_code, output_dir)
        print(json.dumps(result))
        sys.stdout.flush()

    elif command == 'parse-qp':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'Usage: python parser_api_v2.py parse-qp <qp_path> <paper_code> [output_dir]'}))
            sys.stdout.flush()
            sys.exit(1)
        qp_path = sys.argv[2]
        paper_code = sys.argv[3]
        output_dir = sys.argv[4] if len(sys.argv) > 4 else None
        try:
            from qp_content_parser import extract_qp_content
            items = extract_qp_content(qp_path, output_dir)
            result = {
                'status': 'success',
                'parser_version': 'v30',
                'paper_code': paper_code,
                'qp_items': len(items),
                'items': items,
                'timestamp': __import__('datetime').datetime.now().isoformat()
            }
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                with open(os.path.join(output_dir, f'qp_result_{paper_code}.json'), 'w') as f:
                    json.dump(result, f, indent=2)
            print(json.dumps(result))
            sys.stdout.flush()
        except Exception as e:
            print(json.dumps({'status': 'error', 'error': str(e), 'parser_version': 'v30'}))
            sys.stdout.flush()

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.stdout.flush()
