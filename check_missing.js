const mysql = require("mysql2/promise");
async function check() {
  const conn = await mysql.createConnection({host:"localhost",user:"root",password:"Hilton@66",database:"nsc_qbank"});
  const [rows] = await conn.execute("SELECT DISTINCT SUBSTRING_INDEX(paper_code, \u0027_\u0027, 1) as code FROM parse_sessions WHERE SUBSTRING_INDEX(paper_code, \u0027_\u0027, 1) NOT IN (SELECT subject_alpha_code FROM lookup_subjects)");
  console.log("Missing subjects:");
  rows.forEach(r => console.log(r.code));
  await conn.end();
}
check().catch(e=>console.error(e.message));
