from qp_parser_option_b import extract_qp_items_option_b
items = extract_qp_items_option_b(r'C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\Question Papers\Accounting P1 Nov 2025 Eng.pdf')
print(f"Found {len(items)} items")
for i in items:
    print(f"{i['question_number']}: {i['marks']} marks - {i['question_text'][:60]}...")
