  require('dotenv').config();
  const express = require("express");
  const cors = require("cors");
  const { initDb } = require("./db");

  const app = express();

  let db;

  app.use(cors());
  app.use(express.json());

  /* =========================
    ROLES
  ========================= */

  app.post("/api/insertRoles", (req, res) => {
    const { role_name } = req.body;

    db.query(
      "INSERT INTO roles (role_name) VALUES (?)",
      [role_name],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          role_name
        });
      }
    );
  });

  app.get("/api/getAllRoles", (req, res) => {

    db.query(
      "SELECT * FROM roles",
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  // REVISI: Mengubah ke Async/Await agar sinkron dengan koneksi database utama
  // PASTIKAN ENDPOINT INI ADA DAN SUDAH BERBASIS ASYNC/AWAIT
  app.get("/api/getAllStaffCompany/:company_id", async (req, res) => {
    try {
      const { company_id } = req.params;

      console.log(`\n📥 REQUEST MASUK: Mengambil data staf khusus untuk Company ID #${company_id}`);

      // Mengeksekusi query SQL terfilter berdasarkan ID perusahaan sang admin
      const [results] = await db.query(
        "SELECT id, full_name, username, email, role_id, company_id FROM users WHERE company_id = ?",
        [parseInt(company_id)]
      );

      console.log(`🚀 Sukses memfilter dan mengirimkan ${results.length} data staf ke Laravel.`);

      // Mengembalikan data berupa array JSON ke Laravel
      return res.json(results);

    } catch (err) {
      console.error("❌ BACKEND ERROR pada getAllStaffCompany:", err.message);
      return res.status(500).json({ error: "Gagal memfilter data staf: " + err.message });
    }
  });

  // REGISTER COMPANY
  // REVISI TOTAL: Terapkan gaya Async/Await agar sinkron dengan koneksi initDb()
  app.post("/api/registerCompany", async (req, res) => {
    try {
      const { company_name, email, password, phone_number, address } = req.body;

      console.log("=========================================");
      console.log("📥 REQUEST MASUK DARI LARAVEL PANEL");
      console.log("Mendaftarkan Perusahaan:", company_name);

      // 1. Jalankan Query Pertama: Masukkan data ke tabel companies (Menggunakan Await)
      const [companyResult] = await db.query(
        `INSERT INTO companies 
        (company_name, email, password, phone_number, address) 
        VALUES (?, ?, ?, ?, ?)`,
        [company_name, email, password, phone_number, address]
      );

      // Ambil ID otomatis dari hasil insert barusan
      // Catatan: Jika menggunakan mysql2/promise, ID didapat dari properti insertId
      const companyId = companyResult.insertId;
      console.log(`✅ Sukses Insert Table Companies. ID Terbakar: #${companyId}`);

      // 2. Jalankan Query Kedua: Membuat akun admin utama otomatis di tabel users
      // PENTING: Pastikan kolom database (fullname, username, dll) namanya sama dengan MySQL kamu!
      const usernameAwal = email.split('@')[0];
      const fullNameAdmin = company_name + " Admin";

      await db.query(
        `INSERT INTO users 
        (full_name, username, email, password, role_id, company_id) 
        VALUES (?, ?, ?, ?, 1, ?)`,
        [fullNameAdmin, usernameAwal, email, password, companyId]
      );

      console.log(`✅ Sukses Membuat Akun Login Admin Default untuk @${usernameAwal}`);
      console.log("=========================================");

      // 3. KIRIM RESPONS SUKSES LANGSUNG KE LARAVEL
      return res.json({
        id: companyId,
        company_name,
        email,
        phone_number,
        address,
        message: "Company and Admin User successfully created using Async/Await."
      });

    } catch (err) {
      // Apabila ada nama kolom database yang salah ketik, blok CATCH ini akan langsung menangkapnya
      console.error("❌ BACKEND DATABASE ERROR:", err.message);

      // Kirim respons status 500 dalam hitungan milidetik agar Laravel tidak mengalami Timeout 30 detik
      return res.status(500).json({
        error: "Gagal memproses registrasi pada database pusat: " + err.message
      });
    }
  });

  // ENDPOINT: MENGAMBIL DETAIL SATU PERUSAHAAN BERDASARKAN ID
  // ENDPOINT: MENGAMBIL DETAIL SATU PERUSAHAAN BERDASARKAN ID (Async/Await Style)
  app.get("/api/getCompanyDetail/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const [results] = await db.query(
        "SELECT id, company_name, email, phone_number, address FROM companies WHERE id = ?",
        [id]
      );

      if (results.length === 0) {
        return res.status(404).json({ error: "Data perusahaan tidak ditemukan." });
      }

      return res.json(results[0]);
    } catch (err) {
      console.error("❌ BACKEND ERROR pada getCompanyDetail:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/getAllCompanies", (req, res) => {
    db.query("SELECT id, company_name, email, phone_number, address FROM companies", (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    });
  });



  /* =========================
    AUTH
  ========================= */
  // REGISTER
  app.post("/api/register", async (req, res) => {
    try {
      const {
        full_name,
        username,
        email,
        password,
        role_id,
        company_id
      } = req.body;

      console.log("=========================================");
      console.log(`📥 REQUEST MASUK: Mendaftarkan Staff Baru untuk Company ID #${company_id}`);
      console.log(`Nama: ${full_name} | Username: @${username}`);

      // Eksekusi query dengan gaya await promise
      // PASTIKAN nama kolom database di bawah ini (full_name, username, dll) sudah sesuai dengan isi tabel MySQL kamu!
      const [result] = await db.query(
        `INSERT INTO users 
        (full_name, username, email, password, role_id, company_id)
        VALUES (?, ?, ?, ?, ?, ?)`,
        [
          full_name,
          username,
          email,
          password,
          parseInt(role_id),
          parseInt(company_id)
        ]
      );

      console.log(`✅ Staff Baru Berhasil Disimpan. User ID Terbakar: #${result.insertId}`);
      console.log("=========================================");

      // Kirim respons sukses berupa JSON secara instan ke Laravel
      return res.json({
        id: result.insertId,
        full_name,
        username,
        email,
        password,
        role_id,
        company_id,
        message: "Staff account successfully created using Async/Await."
      });

    } catch (err) {
      // Apabila terjadi error (misal username/email duplikat atau nama kolom salah ketik)
      console.error("❌ BACKEND DATABASE ERROR pada /api/register:", err.message);

      // Kirim respons status 500 dalam hitungan milidetik agar Laravel tidak mengalami Timeout 30 detik
      return res.status(500).json({
        error: "Gagal menyimpan data staff baru ke database pusat: " + err.message
      });
    }
  });

  // LOGIN
  app.post("/api/login", async (req, res) => {
    try {
      const { email, username, password } = req.body;

      console.log("EMAIL =", email);
      console.log("PASSWORD =", password);

    const [results] = await db.query(
      `SELECT
        u.id,
        u.company_id,
        u.full_name,
        u.username,
        u.email,
        u.role_id
      FROM users u
      WHERE (u.email = ? OR u.username = ?) AND u.password = ?`,
      [email, username, password]
    );

      if (results.length === 0) {
        return res.status(401).json({
          message: "Login gagal"
        });
      }

      res.json(results[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: err.message
      });
    }
  });

  // LOGIN
  app.post("/api/loginCompany", (req, res) => {

    const { email, password } = req.body;

    db.query(
      `SELECT 
        id
        company_name,
        email,
        phone_number,
        address
      FROM companies
      WHERE email = ? AND password = ?`,
      [email, password],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        if (results.length === 0) {
          return res.status(401).json({
            message: "Login gagal"
          });
        }

        res.json(results[0]);
      }
    );
  });

  // LOGIN
  app.post("/api/loginCompany", (req, res) => {

    const { email, password } = req.body;

    db.query(
      `SELECT 
        id
        company_name,
        email,
        phone_number,
        address
      FROM companies
      WHERE email = ? AND password = ?`,
      [email, password],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        if (results.length === 0) {
          return res.status(401).json({
            message: "Login gagal"
          });
        }

        res.json(results[0]);
      }
    );
  });

  // PROFILE
  app.get("/api/getUserProfile/:id", (req, res) => {

    const { id } = req.params;

    db.query(
      `SELECT 
        id,
        full_name,
        username,
        email,
        role_id
      FROM users
      WHERE id = ?`,
      [id],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results[0]);
      }
    );
  });

  /* =========================
    USERS
  ========================= */

  app.get("/api/getAllUsers", (req, res) => {
    const timestamp = new Date().toLocaleString("id-ID");
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getAllUsers`);
    console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

    db.query(
      "SELECT * FROM users",
      (err, results) => {
        if (err) {
          console.error(`[${timestamp}] ❌ Database Error:`, err.message);

          return res.status(500).json({
            error: err.message
          });
        }

        // === PERBAIKAN LOG UNTUK MENAMPILKAN SEMUA DATA ===
        console.log(`[${timestamp}] 🚀 Sukses mengambil ${results.length} data dari database.`);
        console.log(`[${timestamp}] 📋 DAFTAR DATA YANG DIKIRIM KE ANDROID:`);

        if (results.length === 0) {
          console.log(`[${timestamp}] ⚠️  Tabel kosong, mengirim array kosong [].`);
        } else {
          console.table(results);
        }

        res.json(results);
      }
    );
  });

  app.get("/api/getAllStaff", (req, res) => {
    const timestamp = new Date().toLocaleString("id-ID");
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getStaff`);
    console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

    db.query(
      "SELECT * FROM users",
      (err, results) => {
        if (err) {
          console.error(`[${timestamp}] ❌ Database Error:`, err.message);

          return res.status(500).json({
            error: err.message
          });
        }

        // === PERBAIKAN LOG UNTUK MENAMPILKAN SEMUA DATA ===
        console.log(`[${timestamp}] 🚀 Sukses mengambil ${results.length} data dari database.`);
        console.log(`[${timestamp}] 📋 DAFTAR DATA YANG DIKIRIM KE ANDROID:`);

        if (results.length === 0) {
          console.log(`[${timestamp}] ⚠️  Tabel kosong, mengirim array kosong [].`);
        } else {
          console.table(results);
        }

        res.json(results);
      }
    );
  });

  app.get("/api/getAllMember", (req, res) => {
    const timestamp = new Date().toLocaleString("id-ID");
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getMember`);
    console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

    db.query(
      "SELECT * FROM users",
      (err, results) => {
        if (err) {
          console.error(`[${timestamp}] ❌ Database Error:`, err.message);

          return res.status(500).json({
            error: err.message
          });
        }

        // === PERBAIKAN LOG UNTUK MENAMPILKAN SEMUA DATA ===
        console.log(`[${timestamp}] 🚀 Sukses mengambil ${results.length} data dari database.`);
        console.log(`[${timestamp}] 📋 DAFTAR DATA YANG DIKIRIM KE ANDROID:`);

        if (results.length === 0) {
          console.log(`[${timestamp}] ⚠️  Tabel kosong, mengirim array kosong [].`);
        } else {
          console.table(results);
        }

        res.json(results);
      }
    );
  });

  /* =========================
    SCHEDULES
  ========================= */

  app.post("/api/insertSchedules", (req, res) => {
    const {
      created_by,
      title,
      description,
      start_time,
      end_time,
      location
    } = req.body;

    db.query(
      `INSERT INTO schedules 
      (created_by, title, description, start_time, end_time, location) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        created_by,
        title,
        description,
        start_time,
        end_time,
        location
      ],
      (err, result) => {
        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          created_by,
          title,
          description,
          start_time,
          end_time,
          location
        });
      }
    );
  });

  app.get("/api/getAllSchedules", (req, res) => {
    const timestamp = new Date().toLocaleString("id-ID");
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getAllSchedules`);
    console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

    db.query(
      "SELECT * FROM schedules",
      (err, results) => {
        if (err) {
          console.error(`[${timestamp}] ❌ Database Error:`, err.message);

          return res.status(500).json({
            error: err.message
          });
        }

        // === PERBAIKAN LOG UNTUK MENAMPILKAN SEMUA DATA ===
        console.log(`[${timestamp}] 🚀 Sukses mengambil ${results.length} data dari database.`);
        console.log(`[${timestamp}] 📋 DAFTAR DATA YANG DIKIRIM KE ANDROID:`);

        if (results.length === 0) {
          console.log(`[${timestamp}] ⚠️  Tabel kosong, mengirim array kosong [].`);
        } else {
          // Opsi 1: Cetak bentuk Tabel rapi di terminal (Sangat direkomendasikan untuk debugging)
          console.table(results);

          // Opsi 2: Jika ingin melihat dalam bentuk format JSON teks mentah murni:
          // console.log(JSON.stringify(results, null, 2));
        }
        // ==================================================

        res.json(results);
      }
    );
  });

app.get("/api/getSchedulesByCompanyId/:company_id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Tangkap company_id dari parameter URL
  const companyId = req.params.company_id;

  console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getSchedulesByCompanyId/${companyId}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  // Validasi jika companyId bukan angka atau tidak valid
  if (!companyId || isNaN(companyId)) {
    console.log(`[${timestamp}] ⚠️  Request ditolak: Company ID tidak valid.`);
    return res.status(400).json({
      message: "Company ID tidak valid atau harus berupa angka."
    });
  }

  try {
    // Jalankan query MySQL untuk memfilter jadwal berdasarkan company_id
    // Kolom-kolom di-select agar namanya pas dengan variabel di ScheduleJson Android
    const [results] = await db.query(
      `SELECT *
       FROM schedules 
       WHERE company_id = ? 
       ORDER BY start_time ASC`,
      [companyId]
    );

    // Kirim response data berupa Array/List (meskipun datanya kosong [])
    // Hal ini agar di sisi Android (Retrofit) tidak memicu error parsing List<ScheduleJson>
    console.log(`[${timestamp}] 🚀 Sukses menarik data. Menemukan ${results.length} jadwal.`);
    
    if (results.length > 0) {
      console.table(results); // Menampilkan data tabel di terminal server secara rapi
    }

    res.json(results);

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    res.status(500).json({
      error: "Terjadi kesalahan internal pada server database.",
      details: err.message
    });
  }
});

// === UPDATE (EDIT) SCHEDULE BY ID ===
app.put("/api/updateSchedule/:id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const scheduleId = req.params.id;

  // Tangkap data request body dari Android
  const { created_by, company_id, title, description, start_time, end_time, location } = req.body;

  console.log(`\n[${timestamp}] 📝 PUT Request masuk ke /api/updateSchedule/${scheduleId}`);

  try {
    // Jalankan perintah UPDATE SQL
    const [result] = await db.query(
      `UPDATE schedules 
       SET 
         created_by = ?, 
         company_id = ?, 
         title = ?, 
         description = ?, 
         start_time = ?, 
         end_time = ?, 
         location = ? 
       WHERE id = ?`,
      [created_by, company_id, title, description, start_time, end_time, location, scheduleId]
    );

    // Jika id jadwal tidak ditemukan di tabel database
    if (result.affectedRows === 0) {
      console.log(`[${timestamp}] ⚠️ Gagal update: Jadwal ID ${scheduleId} tidak ditemukan.`);
      return res.status(404).json({
        message: `Gagal memperbarui, jadwal dengan ID ${scheduleId} tidak ditemukan.`
      });
    }

    console.log(`[${timestamp}] ✅ Sukses memperbarui jadwal ID: ${scheduleId}`);
    res.json({
      message: "Jadwal berhasil diperbarui secara sukses!",
      id: scheduleId
    });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    res.status(500).json({
      error: "Terjadi gangguan internal saat mengupdate data database.",
      details: err.message
    });
  }
});

  /* ========================================================
    ATTENDANCE REAL-TIME LOG & AI REPORT GENERATOR (HTTP REST)
  ======================================================== */
  app.get("/api/getAttendanceReport/:company_id", async (req, res) => {
    try {
      const { company_id } = req.params;
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

      console.log(`\n📊 [HTTP REST API] Memproses data laporan absensi Company ID #${company_id}`);

      // 1. Ambil data gabungan absensi
      const [attendanceLogs] = await db.query(
        `SELECT 
          a.id as attendance_id, u.full_name, u.username, s.title as shift_title,
          s.start_time, s.end_time, a.check_in, a.check_out
        FROM attendances a
        JOIN assignments am ON a.assignment_id = am.id
        JOIN schedules s ON am.schedule_id = s.id
        JOIN users u ON am.user_id = u.id
        WHERE u.company_id = ? AND DATE(a.check_in) = CURDATE()`,
        [parseInt(company_id)]
      );

      if (attendanceLogs.length === 0) {
        return res.json({ logs: [], ai_summary: "Tidak ada aktivitas absensi atau shift yang berjalan pada hari ini." });
      }

      // PERBAIKAN: Ubah v1 menjadi v1beta agar mendukung penuh properti response_mime_type
      const GEMINI_URL =
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const dataMentahAbsen = JSON.stringify(attendanceLogs);
      
      const instructionPrompt = `
        Kamu adalah Manajer Operasional HRD Senior. Di bawah ini adalah data mentah log absensi shift karyawan hari ini dalam format JSON.
        Tugasmu adalah menganalisis data tersebut dan memberikan 1 paragraf ringkasan eksekutif (maksimal 4 kalimat) dalam Bahasa Indonesia resmi mengenai performa kehadiran hari ini, apakah ada keterlambatan, atau semua berjalan optimal.
        
        Data Mentah Log Absensi:
        ${dataMentahAbsen}
      `;

      // Laporan PDF membutuhkan teks paragraf bebas, jadi generation_config dikosongkan saja
      const payloadReport = {
        contents: [{ parts: [{ text: instructionPrompt }] }]
      };

      const aiResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadReport) // ⬅️ Pastikan nama variabel sinkron
      });

      let aiSummaryText = "Gagal memuat ringkasan otomatis AI.";

      if (aiResponse.ok) {
        const aiDataParsed = await aiResponse.json();
        aiSummaryText = aiDataParsed.candidates[0].content.parts[0].text.trim();
      } else {
        console.error("⚠️ Google Gemini API (PDF) merespon dengan error:", await aiResponse.text());
      }

      return res.json({ logs: attendanceLogs, ai_summary: aiSummaryText });

    } catch (err) {
      console.error("❌ BACKEND REPORT ERROR:", err.message);
      return res.status(500).json({ error: "Gagal memproses laporan: " + err.message });
    }
  });

  /* =========================
    ASSIGNMENTS
  ========================= */

  app.post("/api/insertAssignments", (req, res) => {

    const {
      schedule_id,
      user_id,
      role_in_event,
      job_desc
    } = req.body;

    db.query(
      `INSERT INTO assignments
      (schedule_id, user_id, role_in_event, job_desc)
      VALUES (?, ?, ?, ?)`,
      [
        schedule_id,
        user_id,
        role_in_event,
        job_desc
      ],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        // auto notification
        db.query(
          `INSERT INTO notifications
          (user_id, title, message, type)
          VALUES (?, 'New Assignment', 'You got a new assignment', 'assignment')`,
          [user_id]
        );

        res.json({
          id: result.insertId,
          schedule_id,
          user_id,
          role_in_event,
          job_desc
        });
      }
    );
  });



  app.get("/api/getAssignmentsByUserId/:user_id", (req, res) => {

    const { user_id } = req.params;

    db.query(
      `SELECT
        a.*,
        s.title,
        s.start_time,
        s.end_time,
        s.location
      FROM assignments a
      JOIN schedules s ON a.schedule_id = s.id
      WHERE a.user_id = ?`,
      [user_id],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  /* =========================
    ATTENDANCES
  ========================= */

  app.post("/api/insertAttendance/checkin", (req, res) => {

    const { assignment_id } = req.body;

    db.query(
      `INSERT INTO attendances
      (assignment_id, check_in)
      VALUES (?, NOW())`,
      [assignment_id],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          assignment_id,
          check_in: new Date()
        });
      }
    );
  });

  app.post("/api/updateAttendance/checkout", (req, res) => {

    const { assignment_id } = req.body;

    db.query(
      `UPDATE attendances
      SET check_out = NOW()
      WHERE assignment_id = ?`,
      [assignment_id],
      (err) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          assignment_id,
          check_out: new Date(),
          message: "Check-out success"
        });
      }
    );
  });

  /* =========================
    REPLACEMENTS
  ========================= */

  app.post("/api/insertReplacements", (req, res) => {

    const {
      assignment_id,
      requested_by,
      reason
    } = req.body;

    db.query(
      `INSERT INTO replacements
      (assignment_id, requested_by, reason)
      VALUES (?, ?, ?)`,
      [
        assignment_id,
        requested_by,
        reason
      ],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          assignment_id,
          requested_by,
          reason
        });
      }
    );
  });

  /* =========================
    AI RECOMMENDATIONS
  ========================= */

  app.post("/api/insertAi-recommendations", (req, res) => {

    const {
      schedule_id,
      recommended_user_id,
      score,
      reason
    } = req.body;

    db.query(
      `INSERT INTO ai_recommendations
      (schedule_id, recommended_user_id, score, reason)
      VALUES (?, ?, ?, ?)`,
      [
        schedule_id,
        recommended_user_id,
        score,
        reason
      ],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          schedule_id,
          recommended_user_id,
          score,
          reason
        });
      }
    );
  });

  app.get("/api/getAi-recommendations/:schedule_id", (req, res) => {

    const { schedule_id } = req.params;

    db.query(
      "SELECT * FROM ai_recommendations WHERE schedule_id = ?",
      [schedule_id],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  // REVISI ENDPOINT: Amankan konversi string data text & tracking log
  app.get("/api/getLeaveRequestsCompany/:company_id", async (req, res) => {
    try {
      const { company_id } = req.params;

      console.log(`\n🔍 [TRACKING] Laravel sedang meminta data izin untuk Company ID: ${company_id}`);

      // Kita gunakan CAST atau jamin kolom text terkonversi menjadi string biasa
      const [results] = await db.query(
        `SELECT 
          r.id,
          r.assignment_id,
          r.requested_by,
          r.reason,
          r.is_valid,
          IFNULL(r.ai_reason, 'Tidak ada catatan analisis AI.') as ai_reason,
          r.status,
          u.full_name,
          u.username
        FROM replacements r
        JOIN users u ON r.requested_by = u.id
        WHERE u.company_id = ?
        ORDER BY r.id DESC`,
        [parseInt(company_id)]
      );

      // PENTING: Pantau di terminal Node.js kamu apakah array ini ada isinya atau []
      console.log("📦 Data yang berhasil diambil dari MySQL:", results);

      return res.json(results);
    } catch (err) {
      console.error("❌ ERROR pada getLeaveRequestsCompany:", err.message);
      return res.status(500).json({ error: err.message });
    }
  });

  /* ========================================================
    AI LEAVE VALIDATION - VERSI REST API HTTP MURNI (NO SDK)
  ======================================================== */
  app.post("/api/analyze-leave-request", async (req, res) => {
    try {
      const { reason } = req.body;
      const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

      if (!reason) {
        return res.status(400).json({ success: false, error: "Teks alasan izin tidak boleh kosong." });
      }

      console.log(`\n🤖 [HTTP REST API] Memproses analisis manual via REST murni untuk: "${reason}"`);

      // PERBAIKAN: Ubah v1 menjadi v1beta agar mendukung penuh properti response_mime_type
      const GEMINI_URL =
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

      const systemInstruction = `
        Anda adalah seorang HRD profesional dan sistem kecerdasan buatan penilai kedaruratan. 
        Analisis alasan izin kerja/shift staf berikut secara objektif.
        
        Aturan Penilaian:
        - Berikan nilai 1 (Valid) jika alasan berupa: Sakit medis, kecelakaan fisik, keluarga inti tertimpa musibah/meninggal, bencana alam, atau urusan dokumen negara darurat.
        - Berikan nilai 0 (Tidak Valid) jika alasan berupa: Kesiangan, kelelahan akibat hiburan pribadi (nonton konser, main game), macet biasa, urusan keluarga non-inti yang bisa ditunda, atau malas.

        Anda WAJIB memberikan output HANYA dalam format JSON murni seperti struktur di bawah ini tanpa penjelasan teks biasa/markdown di luar JSON:
        {
          "is_valid": 1 atau 0,
          "ai_reason": "Berikan 1-2 kalimat argumen penjelasan logis dalam Bahasa Indonesia resmi mengapa alasan tersebut valid atau tidak valid."
        }
      `;

      const payloadAnalyze = {
        contents: [
          { 
            parts: [
              { text: `Aturan Evaluasi:\n${systemInstruction}\n\nNilailah teks pengajuan izin ini: "${reason}"` } 
            ] 
          }
        ],
        generation_config: {           
          response_mime_type: "application/json" // Sekarang 100% didukung karena URL sudah beralih ke v1beta
        }
      };

      const apiResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadAnalyze) // ⬅️ Sinkron dengan variabel payload di atas
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        throw new Error(`Google API merespon dengan status ${apiResponse.status}: ${errorText}`);
      }

      const aiDataParsed = await apiResponse.json();
      const rawJsonText = aiDataParsed.candidates[0].content.parts[0].text.trim();
      const aiResult = JSON.parse(rawJsonText); 

      console.log("🧠 Hasil Analisis Sukses Berbasis REST:", aiResult);

      return res.json({
        success: true,
        is_valid: aiResult.is_valid,
        ai_reason: aiResult.ai_reason
      });

    } catch (err) {
      console.error("❌ BACKEND ANALYSIS ERROR:", err.message);
      return res.status(500).json({ success: false, error: "Gagal memproses analisis AI.", details: err.message });
    }
  });


  /* ========================================================
   ACTION: ADMIN MEMUTUSKAN STATUS PERMOHONAN IZIN (APPROVE / REJECT)
======================================================== */
app.post("/api/respond-leave-request", async (req, res) => {
  try {
    const { replacement_id, action, ai_reason } = req.body;

    if (!replacement_id || !action) {
      return res.status(400).json({ success: false, error: "Data yang dikirimkan tidak lengkap." });
    }

    // 1. Ambil informasi detail permohonan terlebih dahulu
    const [leaveData] = await db.query(
      "SELECT requested_by, reason FROM replacements WHERE id = ?",
      [parseInt(replacement_id)]
    );

    if (leaveData.length === 0) {
      return res.status(404).json({ success: false, error: "Data pengajuan izin tidak ditemukan." });
    }

    const { requested_by, reason } = leaveData[0];
    const statusFinal = action === 'approve' ? 'approved' : 'rejected';
    const statusTextIndo = action === 'approve' ? 'DISETUJUI' : 'DITOLAK';

    console.log(`\n⚖️ [ACTION ADMIN] Memproses status baru untuk Permohonan ID #${replacement_id}: ${statusFinal}`);

    // 2. Update status permohonan beserta simpan catatan hasil evaluasi AI tadi ke database
    await db.query(
      `UPDATE replacements 
       SET status = ?, ai_reason = ? 
       WHERE id = ?`,
      [statusFinal, ai_reason || '', parseInt(replacement_id)]
    );

    // 3. Suntik Notifikasi Otomatis ke Tabel 'notifications' untuk Staff Terkait
    const judulNotif = `Pengajuan Izin ${statusTextIndo}`;
    const pesanNotif = `Permohonan izin Anda dengan alasan "${reason.substring(0, 50)}..." telah ${statusFinal} oleh Admin.`;

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type) 
       VALUES (?, ?, ?, 'assignment')`,
      [requested_by, judulNotif, pesanNotif]
    );

    console.log(`🔔 Notifikasi berhasil dikirimkan ke User ID #${requested_by}`);

    return res.json({
      success: true,
      message: `Permohonan berhasil ${statusFinal} dan notifikasi telah dikirimkan ke staff.`
    });

  } catch (err) {
    console.error("❌ BACKEND RESPOND LEAVE ERROR:", err.message);
    return res.status(500).json({ success: false, error: "Gagal memproses keputusan admin: " + err.message });
  }
});


  /* =========================
    NOTIFICATIONS
  ========================= */

  app.get("/api/getNotificationsByUserId/:user_id", (req, res) => {

    const { user_id } = req.params;

    db.query(
      `SELECT *
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [user_id],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  app.put("/api/updateNotifications/:id/read", (req, res) => {

    const { id } = req.params;

    db.query(
      `UPDATE notifications
      SET is_read = TRUE
      WHERE id = ?`,
      [id],
      (err) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id,
          is_read: true,
          message: "Marked as read"
        });
      }
    );
  });

  /* =========================
    RESOURCES
  ========================= */

  app.post("/api/insertResources", (req, res) => {

    const {
      schedule_id,
      title,
      content,
      file_url
    } = req.body;

    db.query(
      `INSERT INTO resources
      (schedule_id, title, content, file_url)
      VALUES (?, ?, ?, ?)`,
      [
        schedule_id,
        title,
        content,
        file_url
      ],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          schedule_id,
          title,
          content,
          file_url
        });
      }
    );
  });

  app.get("/api/getResources/:schedule_id", (req, res) => {

    const { schedule_id } = req.params;

    db.query(
      "SELECT * FROM resources WHERE schedule_id = ?",
      [schedule_id],
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  /* =========================
    ANNOUNCEMENTS
  ========================= */

  app.post("/api/insertAnnouncements", (req, res) => {

    const {
      title,
      message,
      created_by
    } = req.body;

    db.query(
      `INSERT INTO announcements
      (title, message, created_by)
      VALUES (?, ?, ?)`,
      [
        title,
        message,
        created_by
      ],
      (err, result) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          id: result.insertId,
          title,
          message,
          created_by
        });
      }
    );
  });

  app.get("/api/getAllAnnouncements", (req, res) => {

    db.query(
      "SELECT * FROM announcements",
      (err, results) => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json(results);
      }
    );
  });

  /* =========================
    SERVER
  ========================= */

  const PORT = 3000;

  initDb()
    .then((connection) => {

      db = connection;

      app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
      });

    })
    .catch((err) => {
      console.error("Server error:", err);
    });