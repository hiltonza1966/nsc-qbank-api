const mysql = require('mysql2/promise');
const c = mysql.createPool({host:'localhost',user:'root',password:'Hilton@66',database:'nsc_qbank'});
async function run() {
  // Check if 1.1.6 has a parent_item_id
  const [r1] = await c.query("SELECT item_id, question_number, parent_question, parent_item_id, source_paper_code FROM item_master WHERE item_id = 'e554351d-755d-11f1-956d-cc483aa10da5'");
  console.log('Item 1.1.6 parent info:', r1[0]);
  
  // Check if parent 1.1 has attachments
  const [r2] = await c.query("SELECT item_id, question_number FROM item_master WHERE source_paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG' AND question_number = '1.1'");
  console.log('Parent 1.1 records:', r2.length);
  if (r2.length > 0) {
    const [r3] = await c.query("SELECT file_name, file_path FROM item_attachments WHERE item_id = ?", [r2[0].item_id]);
    console.log('Attachments for parent 1.1:', r3.length);
    r3.forEach(x => console.log(x.file_name, x.file_path));
  }
  
  // Check ALL LIFE SCIENCES ENG attachments
  const [r4] = await c.query("SELECT a.file_name, a.file_path, i.question_number FROM item_attachments a JOIN item_master i ON a.item_id = i.item_id WHERE i.source_paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG' ORDER BY i.question_number");
  console.log('All LIFE SCIENCES ENG attachments:', r4.length);
  r4.forEach(x => console.log(x.question_number, x.file_name));
  
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
