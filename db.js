const mysql = require("mysql2/promise");

const dbConfig = {
  host: "mysql-mocom-mysql-mocom.c.aivencloud.com",
  user: "avnadmin",
  password: "AVNS_otQvI_yGfq2rd9FdcDa",
};

let db;

const initDb = async () => {
  db = await mysql.createConnection(dbConfig);

  console.log("Terhubung ke MySQL.");

  await db.query("CREATE DATABASE IF NOT EXISTS proyek_mocom");
  await db.query("USE proyek_mocom");

  return db;
};

module.exports = {
  initDb,
  getDb: () => db
};
