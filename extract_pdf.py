import sys
try:
    import PyPDF2
    reader = PyPDF2.PdfReader(sys.argv[1])
    text = ""
    for page in reader.pages[:5]:  # First 5 pages
        text += page.extract_text() + "\n"
    print(text[:3000])  # First 3000 chars
except Exception as e:
    print(f"Error: {e}")
