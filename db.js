const mysql = require("mysql2/promise");

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
};

const initDb = async () => {
  const db = await mysql.createConnection(dbConfig);

  console.log("Terhubung ke MySQL.");

  await db.query("CREATE DATABASE IF NOT EXISTS proyek_mocom");
  await db.query("USE proyek_mocom");

  return db;
};

module.exports = { initDb };