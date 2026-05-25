const express = require("express");
const cors = require("cors");
const { db, initDb } = require("./db");

const app = express();

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

/* =========================
   AUTH & USERS
========================= */

// REGISTER
app.post("/api/register", (req, res) => {

  const {
    full_name,
    username,
    email,
    password,
    role_id
  } = req.body;

  db.query(
    `INSERT INTO users 
    (full_name, username, email, password, role_id)
     VALUES (?, ?, ?, ?, ?)`,
    [
      full_name,
      username,
      email,
      password,
      role_id
    ],
    (err, result) => {

      if (err) {
        return res.status(500).json({
          error: err.message
        });
      }

      res.json({
        id: result.insertId,
        full_name,
        username,
        email,
        password,
        role_id
      });
    }
  );
});

// LOGIN
app.post("/api/login", (req, res) => {

  const { username, password } = req.body;

  db.query(
    `SELECT 
      u.id,
      u.full_name,
      u.username,
      u.email,
      u.role_id,
      r.role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = ? AND u.password = ?`,
    [username, password],
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

  db.query(
    "SELECT * FROM schedules",
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
  .then(() => {

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });

  })
  .catch((err) => {
    console.error("Server error:", err);
  });