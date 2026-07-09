#!/usr/bin/env python3
"""QBank Parser API Wrapper v3.0 - Uses v3 harness with hierarchy, MCQ, tables."""
import json, sys, os, warnings

PARSERS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, PARSERS_DIR)

def run_parser(qp_path, memo_path, paper_code, output_dir=None):
    try:
        from master_harness_v3 import run_harness_v3
        harness_result = run_harness_v3(qp_path, memo_path, paper_code, output_dir)

        # Map harness output to batch_parser expected fields
        items = harness_result.get('items', [])
        section_totals = harness_result.get('section_totals', {})

        # Compute expected fields
        total_marks = sum(item.get('marks', 0) or 0 for item in items)
        green_items = [item for item in items if (item.get('marks', 0) or 0) > 0]
        yellow_items = [item for item in items if (item.get('marks', 0) or 0) == 0 and not item.get('is_header', 0)]
        red_items = []

        # Build header_map from items
        header_map = {}
        for item in items:
            if item.get('is_header', 0):
                header_map[item['question_number']] = {
                    'marks': item.get('marks', 0),
                    'level': item.get('header_level', 2)
                }

        result = {
            'parser_version': 'v39',
            'timestamp': __import__('datetime').datetime.now().isoformat(),
            'status': 'success',
            'paper_code': paper_code,
            'matched': len(items),
            'qp_only': 0,
            'memo_only': 0,
            'total_marks': total_marks,
            'target_marks': sum(section_totals.values()) if section_totals else 150,
            'variance': 0,
            'green_count': len(green_items),
            'yellow_count': len(yellow_items),
            'red_count': len(red_items),
            'green_items': green_items,
            'yellow_items': yellow_items,
            'red_items': red_items,
            'qp_only_items': [],
            'memo_only_items': [],
            'section_totals': section_totals,
            'header_map': header_map,
            'items': items,
            'validation': harness_result.get('validation', {})
        }

        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            with open(os.path.join(output_dir, f'parser_result_{paper_code}.json'), 'w') as f:
                json.dump(result, f, indent=2, default=str)

        return result
    except Exception as e:
        import traceback
        return {
            'status': 'error',
            'error': str(e),
            'traceback': traceback.format_exc(),
            'paper_code': paper_code,
            'parser_version': 'v39',
            'matched': 0, 'qp_only': 0, 'memo_only': 0,
            'total_marks': 0, 'target_marks': 150, 'variance': 0,
            'green_count': 0, 'yellow_count': 0, 'red_count': 0,
            'green_items': [], 'yellow_items': [], 'red_items': [],
            'qp_only_items': [], 'memo_only_items': [],
            'section_totals': {}, 'header_map': {}
        }

def get_parser_status():
    status = {
        'python_version': sys.version,
        'parsers_dir': PARSERS_DIR,
        'parsers_available': {}
    }
    for parser in ['bilingual_cleaner.py', 'qp_content_parser.py', 'memo_content_parser.py',
                   'qp_marks_parser.py', 'memo_marks_parser.py', 'master_harness_v2.py', 'master_harness_v3.py']:
        status['parsers_available'][parser] = os.path.exists(os.path.join(PARSERS_DIR, parser))

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

    status['apiVersion'] = 'v39'
    return status

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command specified'}))
        sys.stdout.flush()
        sys.exit(1)

    command = sys.argv[1]

    if command == 'parse':
        if len(sys.argv) < 5:
            print(json.dumps({'error': 'Usage: parse <qp> <memo> <paper_code> [output_dir]'}))
            sys.stdout.flush()
            sys.exit(1)
        result = run_parser(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
        print(json.dumps(result, default=str))
        sys.stdout.flush()

    elif command == 'parse-qp':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'Usage: parse-qp <qp> <paper_code> [output_dir]'}))
            sys.stdout.flush()
            sys.exit(1)
        try:
            from qp_content_parser import extract_qp_content
            items = extract_qp_content(sys.argv[2], sys.argv[4] if len(sys.argv) > 4 else None)
            result = {
                'status': 'success',
                'parser_version': 'v39',
                'paper_code': sys.argv[3],
                'qp_items': len(items),
                'items': items
            }
            if len(sys.argv) > 4:
                os.makedirs(sys.argv[4], exist_ok=True)
                with open(os.path.join(sys.argv[4], f'qp_result_{sys.argv[3]}.json'), 'w') as f:
                    json.dump(result, f, indent=2, default=str)
            print(json.dumps(result, default=str))
            sys.stdout.flush()
        except Exception as e:
            import traceback
            print(json.dumps({
                'status': 'error',
                'error': str(e),
                'traceback': traceback.format_exc(),
                'parser_version': 'v39'
            }))
            sys.stdout.flush()

    else:
        print(json.dumps({'error': f'Unknown command: {command}'}))
        sys.stdout.flush()
