const mysql = require('mysql2/promise');
const c = mysql.createPool({host:'localhost',user:'root',password:'Hilton@66',database:'nsc_qbank'});
async function run() {
  const [r1] = await c.query("SELECT COUNT(*) as cnt FROM item_attachments WHERE file_path LIKE '%LIFESCIENCES%'");
  console.log('LIFE SCIENCES attachments:', r1[0].cnt);
  const [r2] = await c.query("SELECT DISTINCT i.item_id, i.question_number, i.paper_code FROM item_attachments a JOIN item_master i ON a.item_id = i.item_id WHERE i.paper_code LIKE '%LIFESCIENCES%' LIMIT 10");
  console.log('Items with attachments:', r2.length);
  r2.forEach(x => console.log(x.item_id, x.question_number, x.paper_code));
  const [r3] = await c.query("SELECT item_id, question_number, paper_code FROM item_master WHERE paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG' AND question_number = '1.1.6'");
  console.log('Item 1.1.6 records:', r3.length);
  r3.forEach(x => console.log(x.item_id, x.question_number, x.paper_code));
  const [r4] = await c.query("SELECT a.file_name, a.file_path FROM item_attachments a JOIN item_master i ON a.item_id = i.item_id WHERE i.paper_code = 'LIFESCIENCES_P1_2025_NOV_ENG' AND i.question_number = '1.1.6'");
  console.log('Attachments for 1.1.6:', r4.length);
  r4.forEach(x => console.log(x.file_name, x.file_path));
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
