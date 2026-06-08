import re

with open('routes/memo-parser.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace parseMemoItem with improved version
old_func = '''function parseMemoItem(text, questionNumber) {
  // Pattern 1: "1.1.1 C (2)" - MCQ with answer and marks
  const mcqMatch = text.match(/^(\\d+\\.\\d+\\.\\d+)\\s+([A-D])\\s*\\((\\d+)\\)/);
  if (mcqMatch) {
    return {
      question_number: mcqMatch[1],
      answer_text: mcqMatch[2],
      marks: parseInt(mcqMatch[3]),
      type: 'MCQ'
    };
  }

  // Pattern 2: "1.2.1 Progesterone (1)" - Short answer with marks
  const shortMatch = text.match(/^(\\d+\\.\\d+\\.\\d+)\\s+(.+?)\\s*\\((\\d+)\\)/);
  if (shortMatch) {
    return {
      question_number: shortMatch[1],
      answer_text: shortMatch[2].trim(),
      marks: parseInt(shortMatch[3]),
      type: 'Short'
    };
  }

  // Pattern 3: "2.1.1 -Explanation (3)" - Extended with marks
  const extendedMatch = text.match(/^(\\d+\\.\\d+\\.\\d+)\\s+[-–]\\s*(.+?)\\s*\\((\\d+)\\)/);
  if (extendedMatch) {
    return {
      question_number: extendedMatch[1],
      answer_text: extendedMatch[2].trim(),
      marks: parseInt(extendedMatch[3]),
      type: 'Extended'
    };
  }

  // Pattern 4: "2.2.1(a) C -Testis (2)" - Sub-part with letter, answer, marks
  const subPartMatch = text.match(/^(\\d+\\.\\d+\\.\\d+)\\s*\\(([a-z])\\)\\s+([A-Z])?\\s*[-–]?\\s*(.+?)\\s*\\((\\d+)\\)/);
  if (subPartMatch) {
    return {
      question_number: subPartMatch[1] + '(' + subPartMatch[2] + ')',
      answer_text: (subPartMatch[3] ? subPartMatch[3] + ' - ' : '') + subPartMatch[4].trim(),
      marks: parseInt(subPartMatch[5]),
      type: 'SubPart'
    };
  }

  // Pattern 5: Parent item marks "1.4 (8)" - total marks for parent
  const parentMatch = text.match(/^(\\d+\\.\\d+)\\s*\\((\\d+)\\)/);
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

new_func = '''function parseMemoItem(text) {
  // Clean text
  const cleanText = text.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, ' ').replace(/\\s+/g, ' ').trim();
  
  // Skip batch totals like "(10 x 2)(20)"
  if (cleanText.match(/^\\(\\d+\\s*x\\s*\\d+\\)\\s*\\(\\d+\\)$/)) return null;
  
  // Skip section totals like "[50]"
  if (cleanText.match(/^\\[(\\d+)\\]$/)) return null;
  
  // Skip parent totals like "1.4 (8)" - QP already has these marks
  if (cleanText.match(/^\\d+\\.\\d+\\s*\\(\\d+\\)$/)) return null;
  
  // Pattern 1: "1.1.1 C (2)" - MCQ with answer letter
  const mcqMatch = cleanText.match(/^(\\d+\\.\\d+\\.\\d+)\\s+([A-D])\\s*\\((\\d+)\\)/);
  if (mcqMatch) {
    return {
      question_number: mcqMatch[1],
      answer_text: mcqMatch[2],
      marks: parseInt(mcqMatch[3]),
      type: 'MCQ'
    };
  }
  
  // Pattern 2: "1.2.1 Progesterone (1)" - Short answer
  const shortMatch = cleanText.match(/^(\\d+\\.\\d+\\.\\d+)\\s+(.+?)\\s*\\((\\d+)\\)/);
  if (shortMatch) {
    const answerText = shortMatch[2].trim();
    // Skip batch totals disguised as items
    if (!answerText.match(/^\\d+\\s*x\\s*\\d+/)) {
      return {
        question_number: shortMatch[1],
        answer_text: answerText,
        marks: parseInt(shortMatch[3]),
        type: 'Short'
      };
    }
  }
  
  // Pattern 3: "2.1.1 -Explanation (3)" - Extended
  const extendedMatch = cleanText.match(/^(\\d+\\.\\d+\\.\\d+)\\s+[-–]\\s*(.+?)\\s*\\((\\d+)\\)/);
  if (extendedMatch) {
    return {
      question_number: extendedMatch[1],
      answer_text: extendedMatch[2].trim(),
      marks: parseInt(extendedMatch[3]),
      type: 'Extended'
    };
  }
  
  // Pattern 4: "2.2.1(a) C -Testis (2)" - Sub-part with letter
  const subPartMatch = cleanText.match(/^(\\d+\\.\\d+\\.\\d+)\\s*\\(([a-z])\\)\\s+([A-Z])?\\s*[-–]?\\s*(.+?)\\s*\\((\\d+)\\)/);
  if (subPartMatch) {
    return {
      question_number: subPartMatch[1] + '(' + subPartMatch[2] + ')',
      answer_text: (subPartMatch[3] ? subPartMatch[3] + ' - ' : '') + subPartMatch[4].trim(),
      marks: parseInt(subPartMatch[5]),
      type: 'SubPart'
    };
  }
  
  return null;
}'''

content = content.replace(old_func, new_func)

with open('routes/memo-parser.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('memo-parser.js updated successfully')
