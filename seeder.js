const { db, initDb } = require("./db");

const runSeeder = async () => {
  try {
    await initDb();

    /* =========================
       ROLES
    ========================= */
    db.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(150) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) return console.error("roles:", err.message);

      /* =========================
         USERS
      ========================= */
      db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role_id INT NOT NULL,
          full_name VARCHAR(100) NOT NULL,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (role_id) REFERENCES roles(id)
        )
      `, (err) => {
        if (err) return console.error("users:", err.message);

        /* =========================
           SCHEDULES
        ========================= */
        db.query(`
          CREATE TABLE IF NOT EXISTS schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            created_by INT NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            location VARCHAR(150),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) return console.error("schedules:", err.message);

          /* =========================
             ASSIGNMENTS
          ========================= */
          db.query(`
            CREATE TABLE IF NOT EXISTS assignments (
              id INT AUTO_INCREMENT PRIMARY KEY,
              schedule_id INT NOT NULL,
              user_id INT NOT NULL,
              role_in_event VARCHAR(50),
              job_desc TEXT,
              status ENUM('pending','accepted','declined','completed') DEFAULT 'pending',
              assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              UNIQUE (schedule_id, user_id),
              FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
              FOREIGN KEY (user_id) REFERENCES users(id)
            )
          `, (err) => {
            if (err) return console.error("assignments:", err.message);

            /* =========================
               ATTENDANCES
            ========================= */
            db.query(`
              CREATE TABLE IF NOT EXISTS attendances (
                id INT AUTO_INCREMENT PRIMARY KEY,
                assignment_id INT NOT NULL,
                check_in DATETIME,
                check_out DATETIME,
                status ENUM('present','late','absent') DEFAULT 'present',
                sync_status ENUM('pending','synced') DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
              )
            `, (err) => {
              if (err) return console.error("attendances:", err.message);

              /* =========================
                 REPLACEMENTS
              ========================= */
              db.query(`
                CREATE TABLE IF NOT EXISTS replacements (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  assignment_id INT NOT NULL,
                  requested_by INT NOT NULL,
                  replacement_user_id INT,
                  reason TEXT,
                  status ENUM('pending','approved','rejected') DEFAULT 'pending',
                  approved_by INT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
                  FOREIGN KEY (requested_by) REFERENCES users(id),
                  FOREIGN KEY (replacement_user_id) REFERENCES users(id),
                  FOREIGN KEY (approved_by) REFERENCES users(id)
                )
              `, (err) => {
                if (err) return console.error("replacements:", err.message);

                /* =========================
                   AI RECOMMENDATIONS
                ========================= */
                db.query(`
                  CREATE TABLE IF NOT EXISTS ai_recommendations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    schedule_id INT NOT NULL,
                    recommended_user_id INT NOT NULL,
                    score FLOAT,
                    reason TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (schedule_id, recommended_user_id),
                    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
                    FOREIGN KEY (recommended_user_id) REFERENCES users(id)
                  )
                `, (err) => {
                  if (err) return console.error("ai_recommendations:", err.message);

                  /* =========================
                     NOTIFICATIONS
                  ========================= */
                  db.query(`
                    CREATE TABLE IF NOT EXISTS notifications (
                      id INT AUTO_INCREMENT PRIMARY KEY,
                      user_id INT NOT NULL,
                      title VARCHAR(150),
                      message TEXT,
                      type ENUM('assignment','replacement','announcement','general'),
                      is_read BOOLEAN DEFAULT FALSE,
                      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                      FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                  `, (err) => {
                    if (err) return console.error("notifications:", err.message);

                    /* =========================
                       RESOURCES
                    ========================= */
                    db.query(`
                      CREATE TABLE IF NOT EXISTS resources (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        schedule_id INT,
                        title VARCHAR(150),
                        content TEXT,
                        file_url VARCHAR(255),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
                      )
                    `, (err) => {
                      if (err) return console.error("resources:", err.message);

                      /* =========================
                         ANNOUNCEMENTS
                      ========================= */
                      db.query(`
                        CREATE TABLE IF NOT EXISTS announcements (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          title VARCHAR(150) NOT NULL,
                          message TEXT NOT NULL,
                          created_by INT NOT NULL,
                          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                          FOREIGN KEY (created_by) REFERENCES users(id)
                        )
                      `, (err) => {
                        if (err) return console.error("announcements:", err.message);

                        console.log("Semua tabel berhasil dibuat");

                        /* =========================
                           INSERT DATA
                        ========================= */

                        db.query(
                          "INSERT INTO roles (role_name) VALUES ?",
                          [[["admin"], ["staff"], ["member"]]],
                          () => {

                            db.query(
                              "INSERT INTO users (role_id, full_name, username, email, password) VALUES ?",
                              [[
                                [1, "Admin", "admin", "admin@mail.com", "123456"],
                                [2, "Staff 1", "staff1", "staff1@mail.com", "123456"],
                                [2, "Staff 2", "staff2", "staff2@mail.com", "123456"]
                              ]],
                              () => {

                                db.query(
                                  "INSERT INTO schedules (created_by, title, description, date, start_time, end_time, location) VALUES ?",
                                  [[
                                    [1, "Morning Shift", "Daily Ops", "2025-01-01", "08:00:00", "12:00:00", "Room A"]
                                  ]],
                                  () => {

                                    db.query(
                                      "INSERT INTO assignments (schedule_id, user_id, role_in_event, job_desc) VALUES ?",
                                      [[[1, 2, "staff", "Handle session"]]],
                                      () => {

                                        db.query(
                                          "INSERT INTO notifications (user_id, title, message, type) VALUES ?",
                                          [[[2, "Assignment", "You got assigned", "assignment"]]],
                                          () => {

                                            db.query(
                                              "INSERT INTO announcements (title, message, created_by) VALUES ?",
                                              [[["Welcome", "System ready", 1]]],
                                              () => {

                                                console.log("🎉 SEEDING SELESAI!");
                                                db.end();

                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );

                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });

  } catch (err) {
    console.error("Seeder error:", err);
    db.end();
  }
};

runSeeder();