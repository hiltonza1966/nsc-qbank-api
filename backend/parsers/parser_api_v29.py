#!/usr/bin/env python3
"""
QBank Parser API Wrapper
Integrates sandbox parsers into the backend Node.js environment.
Called via child_process from Express routes.
"""

import json
import sys
import os

# Add sandbox parsers to path
SANDBOX_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'sandbox')
sys.path.insert(0, SANDBOX_DIR)

def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    """Run the complete parser pipeline and return structured results."""
    try:
        from master_harness import run_harness
        result = run_harness(qp_path, memo_path, paper_code)
        result['parser_version'] = 'v20'
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
            'parser_version': 'v20'
        }

def get_parser_status():
    """Check if parser dependencies are available."""
    status = {
        'python_version': sys.version,
        'sandbox_dir_exists': os.path.exists(SANDBOX_DIR),
        'parsers_available': {}
    }

    parsers = [
        'bilingual_cleaner.py',
        'docx_extractor.py',
        'unified_qp_parser.py',
        'qp_parser_option_a.py',
        'qp_parser_option_b.py',
        'memo_parser_option_b.py',
        'master_harness.py'
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
