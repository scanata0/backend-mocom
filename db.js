const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
});

const initDb = () => {
  return new Promise((resolve, reject) => {
    db.connect((err) => {
      if (err) {
        console.error("Gagal menyambung ke MySQL:", err.message);
        return reject(err);
      }
      console.log("Terhubung ke MySQL.");

      db.query("CREATE DATABASE IF NOT EXISTS proyek_mocom", (err) => {
        if (err) {
          console.error("Gagal membuat DB:", err.message);
          return reject(err);
        }

        db.changeUser({ database: "proyek_mocom" }, (err) => {
          if (err) {
            console.error("Gagal menggunakan DB:", err.message);
            return reject(err);
          }
          resolve();
        });
      });
    });
  });
};

module.exports = { db, initDb };
