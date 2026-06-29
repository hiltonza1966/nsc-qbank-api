#!/usr/bin/env python3
"""QBank Parser API Wrapper v2.2 - Fixed for batch parser compatibility.

FIXED:
- Added all fields that batch_parser.js expects
- Fixed memo marks extraction
- Fixed memo content extraction
- Version updated to v32
"""
import json
import sys
import os
import warnings

PARSERS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PARSERS_DIR)


def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    """Run parser and return clean JSON with all fields batch_parser expects."""
    try:
        from master_harness_v2 import run_harness_v2
        result = run_harness_v2(qp_path, memo_path, paper_code, output_dir)

        # Ensure all fields that batch_parser.js expects are present
        result['parser_version'] = 'v32'
        result['timestamp'] = __import__('datetime').datetime.now().isoformat()
        result['status'] = 'success'

        # Ensure all required fields exist (batch_parser.js expects these)
        if 'matched' not in result:
            result['matched'] = 0
        if 'qp_only' not in result:
            result['qp_only'] = 0
        if 'memo_only' not in result:
            result['memo_only'] = 0
        if 'total_marks' not in result:
            result['total_marks'] = 0
        if 'target_marks' not in result:
            result['target_marks'] = 150
        if 'variance' not in result:
            result['variance'] = 0
        if 'green_count' not in result:
            result['green_count'] = 0
        if 'yellow_count' not in result:
            result['yellow_count'] = 0
        if 'red_count' not in result:
            result['red_count'] = 0
        if 'green_items' not in result:
            result['green_items'] = []
        if 'yellow_items' not in result:
            result['yellow_items'] = []
        if 'red_items' not in result:
            result['red_items'] = []
        if 'qp_only_items' not in result:
            result['qp_only_items'] = []
        if 'memo_only_items' not in result:
            result['memo_only_items'] = []
        if 'section_totals' not in result:
            result['section_totals'] = {}
        if 'header_map' not in result:
            result['header_map'] = {}

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
            'parser_version': 'v32',
            'matched': 0,
            'qp_only': 0,
            'memo_only': 0,
            'total_marks': 0,
            'target_marks': 150,
            'variance': 0,
            'green_count': 0,
            'yellow_count': 0,
            'red_count': 0,
            'green_items': [],
            'yellow_items': [],
            'red_items': [],
            'qp_only_items': [],
            'memo_only_items': [],
            'section_totals': {},
            'header_map': {}
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

    status['apiVersion'] = 'v32'
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
                'parser_version': 'v32',
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
            print(json.dumps({'status': 'error', 'error': str(e), 'parser_version': 'v32'}))
            sys.stdout.flush()

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.stdout.flush()
