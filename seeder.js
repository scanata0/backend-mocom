const { initDb } = require("./db");

let db;

const runSeeder = async () => {
  try {
    db = await initDb();

    /* =========================
       ROLES
    ========================= */
    await db.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_name VARCHAR(150) NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query(
      "INSERT INTO roles (role_name) VALUES ?",
      [[
        ["admin"],
        ["staff"],
        ["member"]
      ]]
    );

    /* =========================
       COMPANIES
    ========================= */
    await db.execute(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_name VARCHAR(150) NOT NULL,
        email VARCHAR(100) NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone_number VARCHAR(100) NOT NULL,
        address VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await db.query(
      "INSERT INTO companies (company_name, email, password, phone_number, address) VALUES ?",
      [[
        [
          "PT Maju Jaya",
          "admin@majujaya.com",
          "majujaya123",
          "08123456789",
          "Surabaya"
        ],
        [
          "PT Sejahtera Abadi",
          "admin@sejahtera.com",
          "adminsejahtera123",
          "08234567890",
          "Jakarta"
        ]
      ]]
    );

    /* =========================
       USERS
    ========================= */
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        company_id INT NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (company_id) REFERENCES companies(id)
      )
    `);

    await db.query(
      "INSERT INTO users (role_id, company_id, full_name, username, email, password) VALUES ?",
      [[
        // Company 1 - Admin
        [1, 1, "Budi Santoso", "budi", "budi@majujaya.com", "123456"],

        // Company 1 - Staff
        [2, 1, "Siti Aminah", "siti", "siti@majujaya.com", "123456"],

        // Company 2 - Admin
        [1, 2, "Andi Wijaya", "andi", "andi@sejahtera.com", "123456"],

        // Company 2 - Staff
        [2, 2, "Rina Putri", "rina", "rina@sejahtera.com", "123456"],

        // Member contoh
        [3, 1, "Guest User", "guest", "guest@mail.com", "123456"]
      ]]
    );

    /* =========================
       SCHEDULES
    ========================= */
    await db.execute(`
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
    `);

    await db.query(
      "INSERT INTO schedules (created_by, title, description, start_time, end_time, location) VALUES ?",
      [[
        [
          1,
          "Morning Shift",
          "Daily Operations Support",
          "2025-01-01 08:00:00",
          "2025-01-01 12:00:00",
          "Office A"
        ],
        [
          3,
          "Server Maintenance",
          "Weekly backend maintenance",
          "2025-01-02 22:00:00",
          "2025-01-03 02:00:00",
          "Data Center"
        ]
      ]]
    );

    /* =========================
       ASSIGNMENTS
    ========================= */
    await db.execute(`
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
    `);

    await db.query(
      "INSERT INTO assignments (schedule_id, user_id, role_in_event, job_desc) VALUES ?",
      [[
        [1, 2, "staff", "Handle customer support chat"],
        [2, 4, "staff", "Monitor server logs"]
      ]]
    );

    /* =========================
       ATTENDANCES
    ========================= */
    await db.execute(`
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
    `);

    await db.query(`
      INSERT INTO attendances (assignment_id, check_in, check_out, status, sync_status)
      VALUES 
      (1, '2025-01-01 08:05:00', '2025-01-01 12:00:00', 'present', 'synced'),
      (2, '2025-01-02 22:10:00', NULL, 'late', 'pending')
    `);

    /* =========================
       NOTIFICATIONS
    ========================= */
    await db.execute(`
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
    `);

    await db.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES ?",
      [[
        [2, "New Assignment", "You got assigned to Morning Shift", "assignment"],
        [4, "Server Task", "You got assigned to maintenance job", "assignment"]
      ]]
    );

    /* =========================
       ANNOUNCEMENTS
    ========================= */
    await db.execute(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        created_by INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await db.query(
      "INSERT INTO announcements (title, message, created_by) VALUES ?",
      [[
        ["System Launch", "Welcome to the system!", 1],
        ["Maintenance Notice", "System maintenance at midnight", 3]
      ]]
    );

    await db.execute(`
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
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT,
        title VARCHAR(150),
        content TEXT,
        file_url VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
      )
    `);

    await db.execute(`
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
    `);

    console.log("SEEDING SELESAI - SEMUA DATA MASUK!");

    await db.end();

  } catch (err) {
    console.error("Seeder error:", err);
    if (db) await db.end();
  }
};

runSeeder();