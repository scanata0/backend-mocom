  require('dotenv').config();
  const express = require("express");
  const cors = require("cors");
  const { initDb } = require("./db");

  const app = express();

  let db;

  app.use(cors({
      origin: 'http://127.0.0.1:8000',
      credentials: true
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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



// Pastikan rute ini ada di dalam file index.js Express kamu
app.get("/api/getAllCompanies", async (req, res) => {
  try {
    const [results] = await db.query("SELECT id, company_name, email, phone_number, address FROM companies");
    return res.json(results);
  } catch (err) {
    console.error("❌ ERROR pada getAllCompanies:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/getUsersByCompanyId/:company_id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const companyId = req.params.company_id;

  console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getUsersByCompanyId/${companyId}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  if (!companyId || isNaN(companyId)) {
    console.log(`[${timestamp}] ⚠️  Request ditolak: Company ID tidak valid.`);
    return res.status(400).json({ message: "Company ID tidak valid atau harus berupa angka." });
  }

  try {
    const [results] = await db.query(
      // 💡 PERHATIKAN TANDA KOMA SETELAH is_active DI BAWAH INI:
      `SELECT id, role_id, company_id, full_name, username, email, password, is_active,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, 
        DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM users 
       WHERE company_id = ? AND role_id != 1
       ORDER BY created_at ASC`, 
      [parseInt(companyId)]
    );

    console.log(`[${timestamp}] 🚀 Sukses menarik data. Menemukan ${results.length} blueprint user.`);
    return res.json(results);

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: "Terjadi kesalahan internal pada server database.", details: err.message });
  }
});

// 1. ENDPOINT UNTUK MELIHAT STAFF BERDASARKAN COMPANY
// app.get("/api/getUsersByCompanyId/:company_id", async (req, res) => {
//   try {
//     const { company_id } = req.params;
    
//     // Query SQL kamu sudah sangat bagus & aman dari SQL Injection (menggunakan ?)
//     const [rows] = await db.query(
//       "SELECT id, full_name, email, role_id, is_active FROM users WHERE company_id = ? AND role_id = 2", // 💡 Tips: Ikut sertakan is_active untuk badge status di UserAdapter kamu
//       [parseInt(company_id)]
//     );
    
//     return res.json(rows);
//   } catch (err) {
//     return res.status(500).json({ error: err.message });
//   }
// });

// 2. ENDPOINT SUPERADMIN MENAMBAHKAN STAFF KE COMPANY TERTENTU
7// 🛠️ PASTIKAN RUTE INI DITULIS SEPERTI INI DAN DILETAKKAN DI AREA BEBAS (TIDAK DI DALAM ROUTER GRUP LAIN)
app.post("/api/superadmin/addStaff", async (req, res) => {
  // LOG PALING ATAS (Wajib muncul jika pintu rute ini ketuk)
  console.log("🌐 [NETWORK] Ada request POST masuk ke /api/superadmin/addStaff!");
  console.log("📦 Body Mentah yang Diterima:", req.body);

  try {
    const { company_id, full_name, email, password} = req.body;

    if (!company_id || !full_name || !email || !password) {
      console.warn("⚠️ Gagal validasi: Ada parameter wajib yang kosong.");
      return res.status(400).json({ success: false, error: "Parameter data wajib diisi." });
    }

    const usernameDefault = email.split('@')[0];

    const [result] = await db.query(
      `INSERT INTO users (company_id, full_name, username, email, password, role_id) 
       VALUES (?, ?, ?, ?, ?, 2)`,
      [parseInt(company_id), full_name, usernameDefault, email, password]
    );

    console.log(`🚀 [BACKDOOR SUCCESS] Staff baru dibuat dengan ID User #${result.insertId}`);
    return res.json({ success: true, message: "Staff berhasil disuntik masuk oleh Pusat!" });

  } catch (err) {
    console.error("❌ ERROR internal SQL pada superadmin addStaff:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
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

  // === GET ALL STAFF BY COMPANY ID (ISOLASI MULTI-TENANT & EMERGENCY INTERVENTION) ===
app.get("/api/getStaffByCompany/:company_id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  // Menangkap parameter company_id dari URL Request
  const companyId = req.params.company_id;

  console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getStaffByCompany/${companyId}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  // Validasi jika parameter companyId tidak valid atau bukan angka
  if (!companyId || isNaN(companyId)) {
    console.log(`[${timestamp}] ⚠️  Request ditolak: Company ID tidak valid.`);
    return res.status(400).json({
      message: "Company ID tidak valid atau harus berupa angka."
    });
  }

  try {
    // Jalankan query MySQL untuk mengambil seluruh staf/karyawan lapangan (role_id = 2)
    // yang bernaung di bawah company_id tersebut
    const [results] = await db.query(
      `SELECT id, company_id, full_name, username, email, role_id 
       FROM users 
       WHERE company_id = ? AND role_id = 2
       ORDER BY id DESC`,
      [parseInt(companyId)]
    );

    console.log(`[${timestamp}] 🚀 Sukses menarik data. Menemukan ${results.length} staf aktif.`);
    
    // Cetak visualisasi data berbentuk tabel di terminal Node.js jika data ditemukan
    if (results.length > 0) {
      console.table(results);
    } else {
      console.log(`[${timestamp}] ⚠️  Tidak ada staf yang terikat pada Company ID #${companyId}`);
    }

    // Kirim respon murni berupa Array Objek (JSON) ke Laravel Blade / Alpine.js
    return res.json(results);

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error pada getStaffByCompany:`, err.message);
    return res.status(500).json({
      error: "Terjadi kesalahan internal pada server database pusat.",
      details: err.message
    });
  }
});

app.get("/api/getUserById/:id", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT id, company_id, role_id, full_name, username, email, is_active FROM users WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "User tidak ditemukan" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

  app.get("/api/getAllMember", (req, res) => {
    const timestamp = new Date().toLocaleString("id-ID");
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getMember`);
    console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

    db.query(
      "SELECT * FROM users WHERE role_id=2",
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

app.post("/api/insertUser", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  // 1. Ambil data mentah dari Android Retrofit
  const { role_id, company_id, full_name, username, email, password, is_active } = req.body;

  console.log(`\n[${timestamp}] 📥 POST Request masuk ke /api/insertUser`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  // 2. Validasi parameter inputan
  if (!company_id || !role_id || !full_name || !username || !email || !password) {
    console.log(`[${timestamp}] ⚠️  Insert Ditolak: Parameter utama ada yang kosong!`);
    return res.status(400).json({ success: false, message: "Parameter utama tidak boleh kosong!" });
  }

  try {
    // 3. Eksekusi query INSERT data user baru ke database MySQL
    const [result] = await db.query(
      `INSERT INTO users 
       (role_id, company_id, full_name, username, email, password, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, 
      [
        parseInt(role_id), 
        parseInt(company_id), 
        full_name, 
        username, 
        email, 
        password,
        parseInt(is_active ?? 1) // Jika Android tidak mengirim parameter is_active, otomatis set 1 (Aktif)
      ]
    );

    console.log(`[${timestamp}] ✅ Sukses mendaftarkan User baru dengan ID: ${result.insertId}`);

    // =========================================================================
    // 💡 PERBAIKAN UTAMA: Kembalikan struktur data User murni ke Android Studio
    // =========================================================================
    return res.json({
      id: result.insertId,
      company_id: parseInt(company_id),
      role_id: parseInt(role_id),
      full_name: full_name,
      username: username,
      email: email,
      password: password, // Tanpa enkripsi/hash sesuai requesmu sebelumnya
      is_active: parseInt(is_active ?? 1),
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ 
      success: false, 
      error: "Terjadi kesalahan saat menyimpan data pengguna baru.", 
      details: err.message 
    });
  }
});

app.put("/api/updateUser/:id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  const { role_id, full_name, username, email, is_active } = req.body;
  const userId = req.params.id;

  console.log(`\n[${timestamp}] 📥 PUT Request masuk ke /api/updateUser/${userId}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  try {
    // 💡 PERBAIKAN: Ditambahkan `updated_at = NOW()` ke dalam query SQL UPDATE
    const querySql = `
      UPDATE users 
      SET role_id = ?, 
          full_name = ?, 
          username = ?, 
          email = ?, 
          is_active = ?, 
          updated_at = NOW() 
      WHERE id = ?
    `;

    const [result] = await db.query(querySql, [
      parseInt(role_id), 
      full_name, 
      username, 
      email, 
      parseInt(is_active), 
      parseInt(userId)
    ]);

    // Jika id tidak ditemukan di database
    if (result.affectedRows === 0) {
      console.log(`[${timestamp}] ⚠️  Update Gagal: User ID ${userId} tidak ditemukan.`);
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    console.log(`[${timestamp}] ✅ Sukses mengupdate data User ID: ${userId}`);
    return res.sendStatus(200); // Kembalikan status HTTP 200 OK ke Android Studio

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error saat Update:`, err.message);
    return res.status(500).json({ 
      success: false, 
      error: "Terjadi kesalahan saat memperbarui data pengguna.", 
      details: err.message 
    });
  }
});

app.delete("/api/deleteUser/:id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const { id } = req.params;

  console.log(`\n[${timestamp}] 🗑️ DELETE Request masuk ke /api/deleteUser/${id}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  try {
    const [result] = await db.query("DELETE FROM users WHERE id = ?", [parseInt(id)]);

    if (result.affectedRows === 0) {
      console.log(`[${timestamp}] ⚠️ Delete Ditolak: User ID ${id} tidak ditemukan di database.`);
      return res.status(404).json({ success: false, message: "User tidak ditemukan." });
    }

    console.log(`[${timestamp}] 🚀 Sukses menghapus user ID: ${id} dari cloud MySQL.`);
    
    // 💡 TIPS RETROFIT: Kirim status 200 OK murni agar Response<Unit> di Android membacanya sebagai sukses
    return res.status(200).json({ success: true, message: "User berhasil dihapus." });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error saat Delete:`, err.message);
    return res.status(500).json({ error: "Gagal menghapus user.", details: err.message });
  }
});

  /* =========================
    SCHEDULES
  ========================= */

app.post("/api/insertSchedules", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const { company_id, created_by, title, description, start_time, end_time, location } = req.body;

  console.log(`\n[${timestamp}] 📥 POST Request masuk ke /api/insertSchedules`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  if (!company_id || !created_by || !title || !start_time || !end_time) {
    console.log(`[${timestamp}] ⚠️  Insert Ditolak: Parameter utama ada yang kosong!`);
    return res.status(400).json({ success: false, message: "Parameter utama tidak boleh kosong!" });
  }

  try {
    // 💡 BAGIAN DURASI SUDAH DIHAPUS TOTAL DI SINI

    // =========================================================================
    // 💡 PERBAIKAN UTAMA: Jumlah kolom (7) sekarang PAS dengan tanda tanya (7)
    // =========================================================================
    const [result] = await db.query(
      `INSERT INTO schedules 
       (company_id, created_by, title, description, start_time, end_time, location) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`, // 🟢 Diubah dari 8 menjadi 7 tanda tanya
      [
        parseInt(company_id), 
        parseInt(created_by), 
        title, 
        description || null, 
        start_time, 
        end_time,
        location || "Default Area"
      ]
    );

    // 💡 CETAK LOG MONITORING (Tanpa Kolom Durasi)
    console.log("=== BARU DITAMBAHKAN ===");
    const header = "ID".padEnd(6) + "Comp".padEnd(8) + "User".padEnd(8) + "Title".padEnd(22) + "Mulai".padEnd(22) + "Selesai";
    console.log(header);
    console.log("-".repeat(header.length + 5));
    console.log(
      String(result.insertId).padEnd(6) +
      String(company_id).padEnd(8) +
      String(created_by).padEnd(8) +
      title.padEnd(22) +
      start_time.padEnd(22) +
      end_time
    );
    console.log("-".repeat(header.length + 5) + "\n");

    console.log(`[${timestamp}] id ${result.insertId} disimpan.`);

    return res.json({
      id: result.insertId,
      company_id: parseInt(company_id),
      created_by: parseInt(created_by),
      title: title,
      description: description,
      start_time: start_time, 
      end_time: end_time,     
      location: location || "Default Area",
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19) 
    });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: "Terjadi kesalahan saat menyimpan master shift.", details: err.message });
  }
});

app.get("/api/getAllSchedules", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getAllSchedules`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  try {
    // 🛠️ DIUBAH MENJADI ASYNC/AWAIT: Menggunakan TIME_FORMAT agar Android Retrofit aman membaca string jam
    const [results] = await db.query(
      `SELECT id, company_id, created_by, title, description,
        DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') AS start_time, 
        DATE_FORMAT(end_time, '%Y-%m-%d %H:%i:%s')   AS end_time,
        location, created_at
       FROM schedules`
    );

    console.log(`[${timestamp}] 🚀 Sukses mengambil ${results.length} data dari database.`);
    console.log(`[${timestamp}] 📋 DAFTAR DATA YANG DIKIRIM KE ANDROID / WEB:`);

    if (results.length === 0) {
      console.log(`[${timestamp}] ⚠️  Tabel kosong, mengirim array kosong [].`);
    } else {
      console.table(results);
    }

    return res.json(results);

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/getSchedulesByCompanyId/:company_id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const companyId = req.params.company_id;

  console.log(`\n[${timestamp}] 📥 GET Request masuk ke /api/getSchedulesByCompanyId/${companyId}`);
  console.log(`[${timestamp}] 🖥️  Dipanggil oleh IP: ${clientIp}`);

  if (!companyId || isNaN(companyId)) {
    console.log(`[${timestamp}] ⚠️  Request ditolak: Company ID tidak valid.`);
    return res.status(400).json({ message: "Company ID tidak valid atau harus berupa angka." });
  }

  try {
    const [results] = await db.query(
      `SELECT id, company_id, created_by, title, description,
        DATE_FORMAT(start_time, '%Y-%m-%d %H:%i:%s') AS start_time, 
        DATE_FORMAT(end_time, '%Y-%m-%d %H:%i:%s')   AS end_time,
        location, created_at
       FROM schedules 
       WHERE company_id = ? 
       ORDER BY start_time DESC`,
      [parseInt(companyId)]
    );

    console.log(`[${timestamp}] 🚀 Sukses menarik data. Menemukan ${results.length} blueprint shift.`);
    
    if (results.length > 0) {
      console.log("\n=== DATA SCHEDULE ===");

      // 💡 PERBAIKAN UTAMA: Ukuran padEnd disesuaikan dengan panjang teks judul header agar tidak luber
      const header = 
        "id".padEnd(6) + 
        "company_id".padEnd(13) + 
        "user_id".padEnd(13) + 
        "title".padEnd(25) + 
        "start_time".padEnd(23) + 
        "end_time".padEnd(23) + 
        "location".padEnd(18) + 
        "created_at";
      
      console.log(header);
      console.log("-".repeat(header.length + 2)); // Garis pembatas otomatis pas sesuai panjang header

      results.forEach(row => {
        // Konversi tanggal objek Date dari MySQL menjadi format string ringkas (YYYY-MM-DD HH:mm:ss)
        const tanggalRingkas = row.created_at 
          ? new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19)
          : "-";

        // 💡 BARIS DATA: Angka padEnd disamakan persis dengan konfigurasi Header di atas
        const barisData = 
          String(row.id).padEnd(6) + 
          String(row.company_id).padEnd(13) + 
          String(row.created_by).padEnd(13) + 
          (row.title || "").padEnd(25) + 
          String(row.start_time || "").padEnd(23) + 
          String(row.end_time || "").padEnd(23) + 
          (row.location || "Online").padEnd(18) + 
          tanggalRingkas;

        console.log(barisData);
      });
      
      console.log("-".repeat(header.length + 2) + "\n");
    }

    return res.json(results);

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: "Terjadi kesalahan internal pada server database.", details: err.message });
  }
});

// === UPDATE (EDIT) SCHEDULE BY ID ===
app.put("/api/updateSchedule/:id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const { id } = req.params;
  const { company_id, created_by, title, description, start_time, end_time, location } = req.body;

  console.log(`\n[${timestamp}] 📝 PUT Request masuk ke /api/updateSchedule/${id}`);

  try {
    // =========================================================================
    // 💡 PERBAIKAN UTAMA: Pastikan memisahkan kolom dengan KOMA (,), bukan AND!
    // =========================================================================
    const query = `
      UPDATE schedules 
      SET 
        company_id = ?, 
        created_by = ?, 
        title = ?, 
        description = ?, 
        start_time = ?, 
        end_time = ?, 
        location = ?
      WHERE id = ?
    `;

    // Pastikan urutan di dalam array di bawah ini SAMA PERSIS dengan urutan tanda tanya (?) di atas
    const [result] = await db.query(query, [
      parseInt(company_id),
      parseInt(created_by),
      title,
      description || null,
      start_time, // String format "yyyy-MM-dd HH:mm:ss" dari Android mysqlFormat
      end_time,   // String format "yyyy-MM-dd HH:mm:ss" dari Android mysqlFormat
      location || null,
      parseInt(id) // Untuk mengisi WHERE id = ? di paling akhir
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Jadwal tidak ditemukan." });
    }

    console.log(`[${timestamp}] 🚀 Sukses memperbarui jadwal ID: ${id}`);
    return res.json({ success: true, message: "Jadwal berhasil diperbarui." });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: "Gagal memperbarui jadwal.", details: err.message });
  }
});

app.delete("/api/deleteSchedule/:id", async (req, res) => {
  const timestamp = new Date().toLocaleString("id-ID");
  const { id } = req.params;

  console.log(`\n[${timestamp}] 🗑️ DELETE Request masuk untuk ID Jadwal: ${id}`);

  try {
    const [result] = await db.query("DELETE FROM schedules WHERE id = ?", [parseInt(id)]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Jadwal tidak ditemukan." });
    }

    console.log(`[${timestamp}] 🚀 Sukses menghapus jadwal ID: ${id}`);
    return res.json({ success: true, message: "Jadwal berhasil dihapus dari database." });

  } catch (err) {
    console.error(`[${timestamp}] ❌ Database Error:`, err.message);
    return res.status(500).json({ error: "Gagal menghapus jadwal.", details: err.message });
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
   WEEKLY WORKLOAD MONITORING SYSTEM - FINAL FIXED
======================================================== */
app.get("/api/getWeeklyWorkload/:company_id", async (req, res) => {
  try {
    const { company_id } = req.params;

    console.log(`\n📊 [WORKLOAD ENGINE] Menghitung akumulasi jam kerja mingguan Company ID #${company_id}`);

    // 1. Ambil daftar semua staff murni khusus perusahaan ini
    const [staffRows] = await db.query(
      `SELECT id, full_name, username FROM users 
       WHERE company_id = ? AND role_id = 2`,
      [parseInt(company_id)]
    );

    let overworked = 0;
    let normal = 0;
    let underworked = 0;
    const details = [];

    // 2. Kalkulasi jam kerja riil mingguan masing-masing staff
    for (let staff of staffRows) {
      const [attendanceRows] = await db.query(
        `SELECT IFNULL(SUM(TIMESTAMPDIFF(HOUR, a.check_in, a.check_out)), 0) as total_hours
         FROM attendances a
         JOIN assignments am ON a.assignment_id = am.id
         WHERE am.user_id = ? -- 🛠️ FIXED: Menggunakan nama kolom user_id yang sah di tabel assignments
           AND a.check_in >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [staff.id]
      );

      const totalHours = attendanceRows[0] ? parseInt(attendanceRows[0].total_hours) : 0;

      // Klasifikasi batas jam kerja
      if (totalHours > 45) { overworked++; }
      else if (totalHours >= 35 && totalHours <= 45) { normal++; }
      else { underworked++; }

      details.push({
        id: staff.id,
        full_name: staff.full_name,
        username: staff.username,
        total_hours: totalHours
      });
    }

    console.log(`🚀 Sukses kalkulasi beban. Overworked: ${overworked}, Normal: ${normal}, Underworked: ${underworked}`);

    return res.json({
      overworked,
      normal,
      underworked,
      details: details
    });

  } catch (err) {
    console.error("❌ WORKLOAD CALCULATION ERROR:", err.message);
    return res.status(500).json({ error: "Gagal menghitung jam kerja: " + err.message });
  }
});

  /* ========================================================
    AI LEAVE VALIDATION - VERSI REST API HTTP MURNI (NO SDK)
  ======================================================== */
  app.post("/api/analyze-leave-request", async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: "Teks alasan izin kosong." });
    }

    console.log(`\n🤖 [REST API] Mengevaluasi dokumen alasan: "${reason}"`);

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const systemInstruction = `
      Anda adalah HRD senior. Evaluasi alasan izin ini secara objektif.
      Aturan: Berikan is_valid = 1 jika mendesak (Sakit, Kecelakaan, UGD, Musibah). Berikan is_valid = 0 jika remeh (Kesiangan, malas, urusan pribadi bisa ditunda).
      WAJIB keluarkan format JSON murni:
      { "is_valid": 1 atau 0, "ai_reason": "1 kalimat penjelasan Bahasa Indonesia" }
    `;

    const payloadAnalyze = {
  contents: [
    {
      parts: [
        {
          text: `Aturan:\n${systemInstruction}\n\nNilailah teks ini: "${reason}"`
        }
      ]
    }
  ],
  generationConfig: {
    responseMimeType: "application/json"
  }
};

    let apiResponse;
    let retries = 3; // Sistem akan otomatis mencoba mengetuk pintu Google hingga 3 kali jika terjadi error 503
    
    while (retries > 0) {
      apiResponse = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadAnalyze)
      });

      if (apiResponse.status !== 503) {
        break; // Keluar dari loop jika status bukan 503 (berhasil atau jenis error lain)
      }

      console.warn(`⚠️ Google API sibuk (503). Mencoba ulang dalam 1.5 detik... (Sisa percobaan: ${retries - 1})`);
      retries--;
      await new Promise(resolve => setTimeout(resolve, 1500)); // Delay jeda sebelum menembak ulang
    }

    // JIKA GOOGLE API TERNYATA BENAR-BENAR DOWN (TETAP SIBUK SETELAH 3X RETRY)
    if (!apiResponse.ok && apiResponse.status === 503) {
      console.log("fallback 💡 Mengaktifkan sistem penyaringan cadangan internal (HRD Local Engine)...");
      
      // Deteksi kata kunci darurat secara manual menggunakan Regex Local Server
      const kataKunciDarurat = /kecelakaan|sakit|ugd|rs|rumah sakit|dokter|musibah|meninggal|kejang/i;
      const isValidLocal = kataKunciDarurat.test(reason) ? 1 : 0;
      const reasonLocal = isValidLocal === 1 
        ? "Validasi Cadangan: Alasan terdeteksi mengandung unsur kedaruratan medis/force majeure (Disetujui HRD Engine)." 
        : "Validasi Cadangan: Alasan terdeteksi minim indikasi kedaruratan medis mendesak (Ditinjau Ulang).";

      return res.json({
        success: true,
        is_valid: isValidLocal,
        ai_reason: reasonLocal
      });
    }

    // JIKA GOOGLE API MERESPONS DENGAN SUKSES (200 OK)
    if (apiResponse.ok) {
      const aiDataParsed = await apiResponse.json();
      const rawJsonText = aiDataParsed.candidates[0].content.parts[0].text.trim();
      const aiResult = JSON.parse(rawJsonText);

      console.log("🧠 Hasil Analisis Sukses Berbasis REST:", aiResult);
      return res.json({
        success: true,
        is_valid: aiResult.is_valid,
        ai_reason: aiResult.ai_reason
      });
    } else {
      const errorText = await apiResponse.text();
      throw new Error(`Google API merespon dengan status ${apiResponse.status}: ${errorText}`);
    }

  } catch (err) {
    console.error("❌ BACKEND ANALYSIS ERROR:", err.message);
    return res.status(500).json({ success: false, error: "Gagal memproses analisis AI.", details: err.message });
  }
});

/* ========================================================
   REAL-TIME TODAY ATTENDANCE LOG FOR DASHBOARD
======================================================== */
app.get("/api/getTodayAttendanceLog/:company_id", async (req, res) => {
  try {
    const { company_id } = req.params;

    console.log(`\n🕒 [ATTENDANCE LOG] Menarik data check-in hari ini untuk Company ID #${company_id}`);

    // Query mengambil log masuk staf khusus hari ini
    const [rows] = await db.query(
      `SELECT 
        u.full_name,
        u.username,
        s.title as shift_title,
        TIME(a.check_in) as jam_masuk,
        IF(a.check_out IS NULL, 'Belum Pulang', TIME(a.check_out)) as jam_keluar
       FROM attendances a
       JOIN assignments am ON a.assignment_id = am.id
       JOIN schedules s ON am.schedule_id = s.id
       JOIN users u ON am.user_id = u.id
       WHERE u.company_id = ? AND DATE(a.check_in) = CURDATE()
       ORDER BY a.check_in DESC`,
      [parseInt(company_id)]
    );

    return res.json(rows);
  } catch (err) {
    console.error("❌ TODAY LOG ERROR:", err.message);
    return res.status(500).json({ error: err.message });
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