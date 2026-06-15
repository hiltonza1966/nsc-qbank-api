#!/usr/bin/env python3
import sys
import json
import hashlib
import re

try:
    import fitz
except ImportError:
    print(json.dumps({"error": "PyMuPDF not installed"}))
    sys.exit(1)

QUESTION_RE = re.compile(r'^\s*(\d+(?:\.\d+){1,3})\b')
MARKS_RE = re.compile(r'\((\d{1,2})\)')
MARKS_FACTOR_RE = re.compile(r'\((\d+)\s*x\s*(\d+)\)')

def parse_pdf(path, is_memo=False):
    doc = fitz.open(path)
    file_hash = hashlib.md5(open(path, 'rb').read()).hexdigest()
    results = {}

    for page in doc:
        lines = page.get_text("text").split('\n')
        for i, line in enumerate(lines):
            m = QUESTION_RE.match(line)
            if not m:
                continue

            qnum = m.group(1)
            parts = qnum.split('.')

            if len(parts) == 2:
                continue

            if qnum in results and len(results[qnum]['question_text']) > 15:
                continue

            text_lines = []
            current_text = re.sub(r'^\s*\d+(?:\.\d+)+\s*', '', line).strip()
            if current_text and not re.match(r'^\(\d+', current_text):
                text_lines.append(current_text)

            j = i + 1
            while j < len(lines) and j < i + 8:
                next_line = lines[j].strip()
                if QUESTION_RE.match(next_line):
                    break
                if not next_line and len(text_lines) > 0:
                    break
                if re.match(r'^\(\d+', next_line):
                    j += 1
                    continue
                if is_memo and re.match(r'^[A-DYZ]\s*\(\d+\)', next_line):
                    j += 1
                    continue
                if next_line:
                    text_lines.append(next_line)
                j += 1

            qtext = ' '.join(text_lines)

            context = ' '.join(lines[i:i+8])[:300]
            marks = 0
            
            all_marks = list(MARKS_RE.finditer(context))
            for mm in all_marks:
                if mm.start() < 200:
                    val = int(mm.group(1))
                    if val <= 25 and val > marks:
                        marks = val

            mf = MARKS_FACTOR_RE.search(context)
            if mf and mf.start() < 200:
                factor = int(mf.group(1))
                unit = int(mf.group(2))
                total = factor * unit
                if total <= 25 and total > marks:
                    marks = total

            qtext = re.sub(r'\s*\(\d+\s*x\s*\d+\)\s*$', '', qtext)
            qtext = re.sub(r'\s*\(\d+\)\s*$', '', qtext).strip()

            answer = ''
            if is_memo:
                buf = []
                j = i + 1
                while j < len(lines) and not QUESTION_RE.match(lines[j]) and len(buf) < 10:
                    if lines[j].strip():
                        buf.append(lines[j].strip())
                    j += 1
                answer = ' '.join(buf)

            results[qnum] = {
                'question_number': qnum,
                'question_text': qtext[:500],
                'parser_extracted_marks': marks,
                'answer_text': answer[:500] if is_memo else '',
                'page': page.number + 1
            }

    doc.close()
    return list(results.values()), file_hash

def compare_qp_memo(qp_items, mg_items):
    red_flags = []
    all_keys = sorted(set(qp_items.keys()) | set(mg_items.keys()),
                      key=lambda x: [int(p) for p in x.split('.')])

    for key in all_keys:
        qp = qp_items.get(key, {})
        mg = mg_items.get(key, {})

        qp_marks = qp.get('parser_extracted_marks', 0) or 0
        mg_marks = mg.get('parser_extracted_marks', 0) or 0
        
        final_marks = mg_marks if mg_marks > 0 else qp_marks
        
        variance = qp_marks - mg_marks
        is_red = (qp_marks > 0 and mg_marks > 0 and qp_marks != mg_marks) or not qp.get('question_text') or not mg.get('answer_text')

        red_flags.append({
            'question_number': key,
            'qp_text': qp.get('question_text', '')[:120],
            'mg_text': mg.get('answer_text', '')[:120],
            'qp_marks': qp_marks,
            'mg_marks': mg_marks,
            'final_marks': final_marks,
            'variance': variance,
            'is_red_flag': is_red,
            'qp_page': qp.get('page'),
            'mg_page': mg.get('page')
        })

    return red_flags

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: extract_dbe_paper.py <pdf_path> <mode> [paper_code]"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    mode = sys.argv[2]
    paper_code = sys.argv[3] if len(sys.argv) > 3 else ''

    try:
        is_memo = (mode == 'memo')
        items_list, file_hash = parse_pdf(pdf_path, is_memo=is_memo)

        result = {
            'paper_code': paper_code,
            'items': items_list,
            'total_items': len(items_list),
            'total_marks': sum(item['parser_extracted_marks'] for item in items_list),
            'file_hash': file_hash[:8]
        }

        print(json.dumps(result))
    except Exception as e:
        import traceback
        print(json.dumps({'error': str(e), 'traceback': traceback.format_exc()}))
