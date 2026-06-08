const mysql = require("mysql2/promise");

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
};

<<<<<<< Updated upstream
const initDb = async () => {
  const db = await mysql.createConnection(dbConfig);
=======
let db;

const initDb = async () => {
  db = await mysql.createConnection(dbConfig);
>>>>>>> Stashed changes

  console.log("Terhubung ke MySQL.");

  await db.query("CREATE DATABASE IF NOT EXISTS proyek_mocom");
  await db.query("USE proyek_mocom");

  return db;
};

<<<<<<< Updated upstream
module.exports = { initDb };
=======
module.exports = {
  initDb,
  getDb: () => db
};
>>>>>>> Stashed changes
