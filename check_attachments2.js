const mysql = require('mysql2/promise');
const c = mysql.createPool({host:'localhost',user:'root',password:'Hilton@66',database:'nsc_qbank'});
async function run() {
  // Check item_master columns
  const [cols] = await c.query("DESCRIBE item_master");
  console.log('item_master columns:', cols.map(x => x.Field).join(', '));
  
  // Check item_attachments columns
  const [acols] = await c.query("DESCRIBE item_attachments");
  console.log('item_attachments columns:', acols.map(x => x.Field).join(', '));
  
  // Find LIFE SCIENCES items with attachments using correct columns
  const [r2] = await c.query("SELECT DISTINCT i.item_id, i.question_number, i.source_paper_code FROM item_attachments a JOIN item_master i ON a.item_id = i.item_id WHERE i.source_paper_code LIKE '%LIFESCIENCES%' LIMIT 10");
  console.log('Items with attachments:', r2.length);
  r2.forEach(x => console.log(x.item_id, x.question_number, x.source_paper_code));
  
  // Check item 1.1.6
  const [r3] = await c.query("SELECT item_id, question_number, source_paper_code FROM item_master WHERE source_paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG' AND question_number = '1.1.6'");
  console.log('Item 1.1.6 records:', r3.length);
  r3.forEach(x => console.log(x.item_id, x.question_number, x.source_paper_code));
  
  // Check attachments for this item
  if (r3.length > 0) {
    const itemId = r3[0].item_id;
    const [r4] = await c.query("SELECT file_name, file_path FROM item_attachments WHERE item_id = ?", [itemId]);
    console.log('Attachments for 1.1.6:', r4.length);
    r4.forEach(x => console.log(x.file_name, x.file_path));
  }
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
