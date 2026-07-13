const fs = require('fs');
const filePath = 'frontend/src/pages/QPMemoRegister.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find a good place to insert the useEffect - after the existing useEffects
// Look for the useEffect that fetches items for the paper (line 128-139)
const marker = "  // Fetch items for the paper when CRUD panel opens (needed for hierarchy dropdowns)";
const idx = content.indexOf(marker);
if (idx === -1) {
  console.error('Marker not found');
  process.exit(1);
}

// Find the end of that useEffect block
const endOfEffect = content.indexOf("  });", idx);
if (endOfEffect === -1) {
  console.error('End of useEffect not found');
  process.exit(1);
}
const insertPos = endOfEffect + 5; // After "  });"

const newEffect = `

  // Fetch attachments when crudItem changes
  useEffect(() => {
    if (crudItem?.item_id) {
      fetchAttachments(crudItem.item_id, crudItem.source_paper_code, crudItem.question_number);
    }
  }, [crudItem?.item_id]);`;

const newContent = content.substring(0, insertPos) + newEffect + content.substring(insertPos);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Added useEffect for initial attachment loading');
