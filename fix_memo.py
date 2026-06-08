import re

with open('routes/memo-parser.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Replace parseMemoItem function with improved version
old_func = '''function parseMemoItem(text, questionNumber) {
  // Pattern 1: "1.1.1 C (2)" - MCQ with answer and marks
  const mcqMatch = text.match(/^(\d+\.\d+\.\d+)\s+([A-D])\s*\((\d+)\)/);
  if (mcqMatch) {
    return {
      question_number: mcqMatch[1],
      answer_text: mcqMatch[2],
      marks: parseInt(mcqMatch[3]),
      type: 'MCQ'
    };
  }

  // Pattern 2: "1.2.1 Progesterone (1)" - Short answer with marks
  const shortMatch = text.match(/^(\d+\.\d+\.\d+)\s+(.+?)\s*\((\d+)\)/);
  if (shortMatch) {
    return {
      question_number: shortMatch[1],
      answer_text: shortMatch[2].trim(),
      marks: parseInt(shortMatch[3]),
      type: 'Short'
    };
  }

  // Pattern 3: "2.1.1 -Explanation (3)" - Extended with marks
  const extendedMatch = text.match(/^(\d+\.\d+\.\d+)\s+[-–]\s*(.+?)\s*\((\d+)\)/);
  if (extendedMatch) {
    return {
      question_number: extendedMatch[1],
      answer_text: extendedMatch[2].trim(),
      marks: parseInt(extendedMatch[3]),
      type: 'Extended'
    };
  }

  // Pattern 4: Parent item marks "1.4 (8)" - total marks for parent
  const parentMatch = text.match(/^(\d+\.\d+)\s*\((\d+)\)/);
  if (parentMatch) {
    return {
      question_number: parentMatch[1],
      answer_text: '',
      marks: parseInt(parentMatch[2]),
      type: 'Parent'
    };
  }

  return null;
}'''

new_func = '''function parseMemoItem(text, questionNumber) {
  // Clean text: remove special characters, normalize spaces
  const cleanText = text.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, ' ').replace(/\\s+/g, ' ').trim();

  // Pattern 1: "1.1.1 C (2)" or "1.1.1 C  (2)" - MCQ with answer and marks
  const mcqMatch = cleanText.match(/^(\d+\.\d+\.\d+)\s+([A-D])\s*\((\d+)\)/);
  if (mcqMatch) {
    return {
      question_number: mcqMatch[1],
      answer_text: mcqMatch[2],
      marks: parseInt(mcqMatch[3]),
      type: 'MCQ'
    };
  }

  // Pattern 2: "1.2.1 Progesterone (1)" or "1.2.1 Progesterone  (1)" - Short answer with marks
  const shortMatch = cleanText.match(/^(\d+\.\d+\.\d+)\s+(.+?)\s*\((\d+)\)/);
  if (shortMatch) {
    return {
      question_number: shortMatch[1],
      answer_text: shortMatch[2].trim(),
      marks: parseInt(shortMatch[3]),
      type: 'Short'
    };
  }

  // Pattern 3: "2.1.1 -Explanation (3)" or "2.1.1 Explanation (3)" - Extended with marks
  const extendedMatch = cleanText.match(/^(\d+\.\d+\.\d+)\s+[-–]?\\s*(.+?)\s*\((\d+)\)/);
  if (extendedMatch) {
    return {
      question_number: extendedMatch[1],
      answer_text: extendedMatch[2].trim(),
      marks: parseInt(extendedMatch[3]),
      type: 'Extended'
    };
  }

  // Pattern 4: "2.2.1(a) C -Testis (2)" - Sub-part with letter, answer, marks
  const subPartMatch = cleanText.match(/^(\d+\.\d+\.\d+)\s*\(([a-z])\)\s+([A-Z])?\s*[-–]?\\s*(.+?)\s*\((\d+)\)/);
  if (subPartMatch) {
    return {
      question_number: subPartMatch[1] + '(' + subPartMatch[2] + ')',
      answer_text: (subPartMatch[3] ? subPartMatch[3] + ' - ' : '') + subPartMatch[4].trim(),
      marks: parseInt(subPartMatch[5]),
      type: 'SubPart'
    };
  }

  // Pattern 5: Parent item marks "1.4 (8)" or "1.4  (8)" - total marks for parent
  const parentMatch = cleanText.match(/^(\d+\.\d+)\s*\((\d+)\)/);
  if (parentMatch) {
    return {
      question_number: parentMatch[1],
      answer_text: '',
      marks: parseInt(parentMatch[2]),
      type: 'Parent'
    };
  }

  // Pattern 6: "2.5.1 Height (1)" - Simple answer with marks
  const simpleMatch = cleanText.match(/^(\d+\.\d+\.\d+)\s+(.+?)\s*\((\d+)\)/);
  if (simpleMatch) {
    return {
      question_number: simpleMatch[1],
      answer_text: simpleMatch[2].trim(),
      marks: parseInt(simpleMatch[3]),
      type: 'Simple'
    };
  }

  return null;
}'''

content = content.replace(old_func, new_func)

# Fix 2: paper_no should be numeric
content = content.replace("paper_no || 1", "parseInt(paper_no) || 1")
content = content.replace("paper_no || 'P1'", "parseInt(paper_no) || 1")

with open('routes/memo-parser.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('memo-parser.js updated successfully')
