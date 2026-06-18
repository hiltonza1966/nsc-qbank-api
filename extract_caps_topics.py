import fitz  # PyMuPDF
import re
import json

def extract_caps_topics(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    
    for page in doc:
        text += page.get_text("text") + "\n"
    
    doc.close()
    
    # Clean the text - remove /MTxx artifacts
    text = re.sub(r'/MT\d+', '', text)
    text = re.sub(r'\s+', ' ', text)
    
    # Find Section 2.4 - Focus of Content Areas
    section2_4_match = re.search(r'2\.4.*?Focus of Content areas?(.*?)(?:2\.5|3\.|SECTION 3)', text, re.IGNORECASE | re.DOTALL)
    topics = []
    
    if section2_4_match:
        section_text = section2_4_match.group(1)
        # Extract numbered topics
        topic_matches = re.findall(r'(\d+)\.\s+([A-Z][a-zA-Z\s,]+?)(?=\d+\.|$)', section_text)
        for num, topic_name in topic_matches:
            topics.append({
                'topic_name': topic_name.strip(),
                'topic_number': int(num),
                'source': 'section_2.4'
            })
    
    # Find Section 3.2.3 - Topic allocation per term
    section3_2_3_match = re.search(r'3\.2\.3.*?Topic allocation per term(.*?)(?:4\.|SECTION 4|Assessment)', text, re.IGNORECASE | re.DOTALL)
    term_topics = []
    
    if section3_2_3_match:
        section_text = section3_2_3_match.group(1)
        # Extract grade/term/topic allocations
        grade_matches = re.findall(r'Grade\s+(10|11|12)\s+Term:\s+(\d+)\s*(.*?)(?=Grade\s+\d+\s+Term:|$)', section_text, re.IGNORECASE | re.DOTALL)
        for grade, term, content in grade_matches:
            topic_parts = [p.strip() for p in content.split(',') if p.strip() and p.strip().lower() not in ['revision', 'exams', 'assessment']]
            for part in topic_parts:
                if len(part) > 3:
                    term_topics.append({
                        'grade': int(grade),
                        'term': int(term),
                        'topic_name': part,
                        'source': 'section_3.2.3'
                    })
    
    return {
        'subject': 'MATHEMATICS',
        'topics_from_overview': topics,
        'topics_from_teaching_plan': term_topics,
        'total_topics': len(topics),
        'total_term_allocations': len(term_topics)
    }

result = extract_caps_topics(r"C:\Users\visagie.h\Downloads\GIA PROTOCOL START FILES\Qbank\CAPS Documents\CAPS FET _ MATHEMATICS _ GR 10-12 _ Web_1133.pdf")
print(json.dumps(result, indent=2))
