const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');

const ADMINS = new Set(['7201745912', '1523406780']);
const DEVELOPER_USERNAME = '@BotBo3Bot';

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT DEFAULT '',
      is_banned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS groups_list (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      link TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  const broadcast = await get(`SELECT key FROM settings WHERE key = 'broadcast'`);
  if (!broadcast) {
    await run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('broadcast', '', ?)`,
      [new Date().toISOString()]
    );
  }
}

function isAdmin(adminId) {
  return ADMINS.has(String(adminId || '').trim());
}

function makeUserId() {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function ok(res, data = {}) {
  res.json({ ok: true, ...data });
}

function bad(res, message, status = 400) {
  res.status(status).json({ ok: false, message });
}

async function loadUser(userId) {
  if (!userId) return null;
  return get(`SELECT * FROM users WHERE id = ?`, [String(userId)]);
}

async function ensureUser(userId) {
  const user = await loadUser(userId);
  return user;
}

async function requireActiveUser(res, userId) {
  const user = await ensureUser(userId);
  if (!user) {
    bad(res, 'المستخدم غير موجود.', 404);
    return null;
  }
  if (user.is_banned) {
    bad(res, 'تم حظرك من الموقع.', 403);
    return null;
  }
  return user;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  ok(res, {
    admins: Array.from(ADMINS),
    developerUsername: DEVELOPER_USERNAME
  });
});

app.post('/api/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const username = String(req.body?.username || '').trim().replace(/^@/, '');
    let userId = String(req.body?.userId || '').trim();

    if (name.length < 2) return bad(res, 'الاسم يجب أن يكون حرفين على الأقل.');
    if (!userId) userId = makeUserId();

    const existing = await loadUser(userId);
    const now = new Date().toISOString();

    if (!existing) {
      await run(
        `INSERT INTO users (id, name, username, is_banned, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [userId, name, username, now, now]
      );
    } else {
      await run(
        `UPDATE users SET name = ?, username = ?, updated_at = ? WHERE id = ?`,
        [name, username, now, userId]
      );
    }

    const user = await loadUser(userId);
    ok(res, { user });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل حفظ الهوية.', 500);
  }
});

app.get('/api/me', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) return bad(res, 'userId مطلوب.');
    const user = await loadUser(userId);
    if (!user) return bad(res, 'المستخدم غير موجود.', 404);
    ok(res, { user });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل المستخدم.', 500);
  }
});

app.get('/api/broadcast', async (_req, res) => {
  try {
    const row = await get(`SELECT value, updated_at FROM settings WHERE key = 'broadcast'`);
    ok(res, { text: row?.value || '', updatedAt: row?.updated_at || null });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل الإذاعة.', 500);
  }
});

app.post('/api/groups', async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const name = String(req.body?.name || '').trim();
    const link = String(req.body?.link || '').trim();

    if (!name || name.length < 2) return bad(res, 'اسم المجموعة غير صالح.');
    if (!link || link.length < 6) return bad(res, 'رابط المجموعة غير صالح.');

    const user = await requireActiveUser(res, userId);
    if (!user) return;

    const now = new Date().toISOString();
    const existing = await get(
      `SELECT id FROM groups_list WHERE owner_id = ? AND LOWER(name) = LOWER(?)`,
      [userId, name]
    );

    if (existing) {
      await run(
        `UPDATE groups_list SET link = ?, status = 'pending', updated_at = ? WHERE id = ?`,
        [link, now, existing.id]
      );
    } else {
      await run(
        `INSERT INTO groups_list (owner_id, name, link, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        [userId, name, link, now, now]
      );
    }

    ok(res, { message: 'تم إرسال طلب إضافة المجموعة.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل إضافة المجموعة.', 500);
  }
});

app.get('/api/my-groups', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    const user = await ensureUser(userId);
    if (!user) return bad(res, 'المستخدم غير موجود.', 404);

    const groups = await all(
      `SELECT id, name, link, status, created_at, updated_at
       FROM groups_list WHERE owner_id = ? ORDER BY id DESC`,
      [userId]
    );

    ok(res, { groups });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل مجموعاتك.', 500);
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const userId = String(req.query.userId || '').trim();
    const q = String(req.query.q || '').trim();
    if (!q) return bad(res, 'اسم المجموعة مطلوب.');

    const user = await requireActiveUser(res, userId);
    if (!user) return;

    const group = await get(
      `SELECT id, name, link, status FROM groups_list
       WHERE LOWER(name) = LOWER(?) AND status = 'approved'
       ORDER BY id DESC LIMIT 1`,
      [q]
    );

    ok(res, { group: group || null });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل البحث.', 500);
  }
});

app.post('/api/admin/login', (req, res) => {
  const adminId = String(req.body?.adminId || '').trim();
  if (!isAdmin(adminId)) return bad(res, 'معرّف الأدمن غير صحيح.', 403);
  ok(res, { adminId });
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);

    const usersCount = await get(`SELECT COUNT(*) AS count FROM users`);
    const bannedCount = await get(`SELECT COUNT(*) AS count FROM users WHERE is_banned = 1`);
    const pendingCount = await get(`SELECT COUNT(*) AS count FROM groups_list WHERE status = 'pending'`);
    const approvedCount = await get(`SELECT COUNT(*) AS count FROM groups_list WHERE status = 'approved'`);
    const rejectedCount = await get(`SELECT COUNT(*) AS count FROM groups_list WHERE status = 'rejected'`);

    ok(res, {
      stats: {
        users: usersCount.count,
        banned: bannedCount.count,
        pending: pendingCount.count,
        approved: approvedCount.count,
        rejected: rejectedCount.count
      }
    });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل الإحصائيات.', 500);
  }
});

app.get('/api/admin/requests', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);

    const rows = await all(
      `SELECT g.id, g.owner_id, g.name, g.link, g.status, g.created_at, g.updated_at,
              u.name AS owner_name, u.username AS owner_username, u.is_banned AS owner_banned
       FROM groups_list g
       JOIN users u ON u.id = g.owner_id
       WHERE g.status = 'pending'
       ORDER BY g.id DESC`
    );

    ok(res, { requests: rows });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل الطلبات.', 500);
  }
});

app.post('/api/admin/request-action', async (req, res) => {
  try {
    const adminId = String(req.body?.adminId || '').trim();
    const groupId = Number(req.body?.groupId || 0);
    const action = String(req.body?.action || '').trim();

    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);
    if (!groupId) return bad(res, 'groupId مطلوب.');
    if (!['accept', 'reject'].includes(action)) return bad(res, 'إجراء غير صالح.');

    const row = await get(
      `SELECT g.id, g.owner_id, u.is_banned
       FROM groups_list g
       JOIN users u ON u.id = g.owner_id
       WHERE g.id = ?`,
      [groupId]
    );

    if (!row) return bad(res, 'المجموعة غير موجودة.', 404);
    if (row.is_banned) return bad(res, 'صاحب الطلب محظور.', 403);

    const status = action === 'accept' ? 'approved' : 'rejected';
    await run(
      `UPDATE groups_list SET status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), groupId]
    );

    ok(res, { message: status === 'approved' ? 'تم قبول المجموعة.' : 'تم رفض المجموعة.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل تنفيذ الطلب.', 500);
  }
});

app.post('/api/admin/ban', async (req, res) => {
  try {
    const adminId = String(req.body?.adminId || '').trim();
    const targetUserId = String(req.body?.targetUserId || '').trim();

    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);
    if (!targetUserId) return bad(res, 'معرف المستخدم مطلوب.');
    if (ADMINS.has(targetUserId)) return bad(res, 'لا يمكن حظر أدمن.');

    const target = await loadUser(targetUserId);
    if (!target) return bad(res, 'المستخدم غير موجود.', 404);

    await run(
      `UPDATE users SET is_banned = 1, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), targetUserId]
    );

    ok(res, { message: 'تم حظر المستخدم.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل الحظر.', 500);
  }
});

app.post('/api/admin/unban', async (req, res) => {
  try {
    const adminId = String(req.body?.adminId || '').trim();
    const targetUserId = String(req.body?.targetUserId || '').trim();

    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);
    if (!targetUserId) return bad(res, 'معرف المستخدم مطلوب.');

    const target = await loadUser(targetUserId);
    if (!target) return bad(res, 'المستخدم غير موجود.', 404);

    await run(
      `UPDATE users SET is_banned = 0, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), targetUserId]
    );

    ok(res, { message: 'تم إلغاء حظر المستخدم.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل إلغاء الحظر.', 500);
  }
});

app.get('/api/admin/groups', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);

    const groups = await all(
      `SELECT g.id, g.owner_id, g.name, g.link, g.status, g.created_at, g.updated_at,
              u.name AS owner_name, u.username AS owner_username
       FROM groups_list g
       JOIN users u ON u.id = g.owner_id
       WHERE g.status = 'approved'
       ORDER BY g.id DESC`
    );

    ok(res, { groups });
  } catch (error) {
    console.error(error);
    bad(res, 'تعذر تحميل المجموعات.', 500);
  }
});

app.post('/api/admin/delete-group', async (req, res) => {
  try {
    const adminId = String(req.body?.adminId || '').trim();
    const input = String(req.body?.input || '').trim();
    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);
    if (!input) return bad(res, 'أدخل اسم أو رابط المجموعة.');

    const row = await get(
      `SELECT id FROM groups_list WHERE LOWER(name) = LOWER(?) OR link = ? ORDER BY id DESC LIMIT 1`,
      [input, input]
    );

    if (!row) return bad(res, 'لم يتم العثور على المجموعة.', 404);

    await run(`DELETE FROM groups_list WHERE id = ?`, [row.id]);
    ok(res, { message: 'تم مسح المجموعة بنجاح.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل حذف المجموعة.', 500);
  }
});

app.post('/api/admin/broadcast', async (req, res) => {
  try {
    const adminId = String(req.body?.adminId || '').trim();
    const text = String(req.body?.text || '');
    if (!isAdmin(adminId)) return bad(res, 'لا تملك صلاحية.', 403);

    await run(
      `UPDATE settings SET value = ?, updated_at = ? WHERE key = 'broadcast'`,
      [text, new Date().toISOString()]
    );

    ok(res, { message: text.trim() ? 'تم نشر الإذاعة.' : 'تم مسح الإذاعة.' });
  } catch (error) {
    console.error(error);
    bad(res, 'فشل تحديث الإذاعة.', 500);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  bad(res, 'حدث خطأ غير متوقع.', 500);
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
