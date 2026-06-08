import re

with open('routes/memo-parser.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the parsedPaperNo line - it references itself in the else clause
old_line = "const parsedPaperNo = typeof paper_no === 'string' ? parseInt(paper_no.replace('P', '')) || 1 : (parsedPaperNo);"
new_line = "const parsedPaperNo = typeof paper_no === 'string' ? parseInt(paper_no.replace('P', '')) || 1 : (parseInt(paper_no) || 1);"

content = content.replace(old_line, new_line)

# Also fix line 326: parseInt(paper_no) || 1 -> parsedPaperNo
content = content.replace("parseInt(paper_no) || 1, status, null, 1", "parsedPaperNo, status, null, 1")

# And fix line 228: parseInt(paper_no) || 1 -> parsedPaperNo  
content = content.replace("[subject_name, parseInt(paper_no) || 1]", "[subject_name, parsedPaperNo]")

with open('routes/memo-parser.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed memo-parser.js')
