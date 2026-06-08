import re

with open('frontend/src/components/wizard/UploadWizard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Add parseMemo function before handleParse
parseMemoFunction = """
  const parseMemo = async (memoFile: File, paperCode: string) => {
    try {
      console.log('Parsing memo file:', memoFile.name);
      
      const arrayBuffer = await memoFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const textItems = [];
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        for (const item of content.items) {
          if ('str' in item) {
            textItems.push({
              text: item.str,
              x: item.transform[4],
              y: item.transform[5],
              width: item.width,
              height: item.height,
              fontName: item.fontName,
              page: pageNum
            });
          }
        }
      }

      console.log('Memo text extracted:', textItems.length, 'items');

      const memoResponse = await fetch('http://localhost:4000/api/wizard/extract-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textItems: textItems,
          paper_code: paperCode,
          subject_name: SUBJECTS.find(s => s.code === paperSpec.subject)?.name || paperSpec.subject,
          paper_no: paperSpec.paper_no,
          exam_year: paperSpec.exam_year,
          exam_session: paperSpec.exam_session
        })
      });

      if (!memoResponse.ok) {
        const errText = await memoResponse.text();
        console.warn('Memo extraction warning:', errText);
        return null;
      }

      const memoResult = await memoResponse.json();
      console.log('Memo extracted:', memoResult.total_items, 'items,', memoResult.linked, 'linked,', memoResult.unlinked, 'unlinked');
      return memoResult;

    } catch (err: any) {
      console.warn('Memo parsing error:', err.message);
      return null;
    }
  };

"""

content = content.replace('const handleParse = async () => {', parseMemoFunction + 'const handleParse = async () => {')

# Step 2: Add memo call after setParseStage('reviewing')
memoCall = """
      // Step 5: Parse Memo if uploaded (STAGE 4)
      if (memoFile) {
        console.log('Processing memo file...');
        await parseMemo(memoFile, paperCode);
      }

"""

content = content.replace("setParseStage('reviewing');", "setParseStage('reviewing');" + memoCall)

with open('frontend/src/components/wizard/UploadWizard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('UploadWizard.tsx updated successfully')
