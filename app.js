const state = {
  user: null,
  adminId: null,
  config: null,
  broadcast: { text: '', updatedAt: null }
};

const STORAGE_KEY = 'group_dir_web_user_id_v2';

const $ = (sel) => document.querySelector(sel);

function toast(message) {
  const box = $('#toast');
  box.textContent = message;
  box.classList.add('show');
  clearTimeout(box._timer);
  box._timer = setTimeout(() => box.classList.remove('show'), 2300);
}

async function api(url, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({ ok: false, message: 'استجابة غير صالحة.' }));
  if (!res.ok || !data.ok) {
    throw new Error(data.message || 'حدث خطأ.');
  }
  return data;
}

function setSavedUserId(userId) {
  localStorage.setItem(STORAGE_KEY, userId);
}
function getSavedUserId() {
  return localStorage.getItem(STORAGE_KEY) || '';
}
function clearSavedUserId() {
  localStorage.removeItem(STORAGE_KEY);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function updateHeader() {
  $('#developerChip').textContent = `المطور: ${state.config?.developerUsername || '@BotBo3Bot'}`;
  $('#identityChip').textContent = state.user ? `👤 ${state.user.name}` : '👤 زائر';
  $('#roleChip').textContent = state.adminId ? '🛡️ أدمن' : '🔒 مستخدم';

  const info = $('#currentInfo');
  info.innerHTML = `
    <span>User ID</span><b>${state.user?.id || '-'}</b>
    <span>الاسم</span><b>${state.user?.name || '-'}</b>
    <span>اليوزر</span><b>${state.user?.username ? '@' + state.user.username : '-'}</b>
    <span>محظور</span><b>${state.user?.is_banned ? 'نعم' : 'لا'}</b>
  `;
}

function updateBroadcast() {
  const card = $('#broadcastCard');
  const text = String(state.broadcast?.text || '').trim();
  if (text) {
    $('#broadcastText').textContent = text;
    card.classList.remove('hidden');
  } else {
    $('#broadcastText').textContent = '';
    card.classList.add('hidden');
  }
}

function requireUser() {
  if (!state.user) {
    toast('سجل الهوية أولاً.');
    renderHome();
    return false;
  }
  return true;
}

function requireActiveUser() {
  if (!requireUser()) return false;
  if (state.user.is_banned) {
    toast('تم حظرك من الموقع.');
    renderHome();
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!state.adminId) {
    toast('سجل دخولك كأدمن أولاً.');
    renderHome();
    return false;
  }
  return true;
}

async function refreshMe() {
  const userId = getSavedUserId();
  if (!userId) {
    state.user = null;
    updateHeader();
    return;
  }
  try {
    const data = await api(`/api/me?userId=${encodeURIComponent(userId)}`);
    state.user = data.user;
    $('#nameInput').value = state.user?.name || '';
    $('#usernameInput').value = state.user?.username || '';
  } catch {
    state.user = null;
    clearSavedUserId();
  }
  updateHeader();
}

async function refreshBroadcast() {
  try {
    const data = await api('/api/broadcast');
    state.broadcast = { text: data.text, updatedAt: data.updatedAt };
  } catch {
    state.broadcast = { text: '', updatedAt: null };
  }
  updateBroadcast();
}

function statusBadge(status) {
  const labels = {
    pending: '⏳ Pending',
    approved: '✅ Approved',
    rejected: '❌ Rejected'
  };
  return `<span class="badge ${status}">${labels[status] || status}</span>`;
}

function renderHome() {
  const el = $('#screen');
  el.innerHTML = `
    <h2>القائمة الرئيسية</h2>
    <p class="muted">من هنا تقدر تضيف مجموعتك أو تبحث عن مجموعة معتمدة، وإذا كنت أدمن تفتح لوحة التحكم.</p>

    <div class="divider"></div>

    <div class="screen-actions">
      <button class="btn primary" id="goAddGroup">➕ أضف كروبك</button>
      <button class="btn" id="goSearch">🔎 بحث عن كروبات</button>
      <button class="btn" id="goAbout">ℹ️ نبذة الموقع</button>
      <button class="btn ${state.adminId ? 'success' : ''}" id="goAdmin">🛠️ لوحة الأدمن</button>
    </div>

    <div class="divider"></div>

    <div class="notice">
      <strong>ملاحظات</strong>
      <div class="info-grid">
        <span>قاعدة البيانات</span><b>SQLite</b>
        <span>حالة المستخدم</span><b>${state.user ? (state.user.is_banned ? 'محظور' : 'نشط') : 'غير مسجل'}</b>
        <span>الأدمن الحالي</span><b>${state.adminId || '-'}</b>
        <span>المطور</span><b>${state.config?.developerUsername || '@BotBo3Bot'}</b>
      </div>
    </div>
  `;

  $('#goAddGroup').onclick = renderAddGroup;
  $('#goSearch').onclick = renderSearch;
  $('#goAbout').onclick = renderAbout;
  $('#goAdmin').onclick = () => state.adminId ? renderAdminPanel() : toast('سجل دخول الأدمن من اليمين أولاً.');
}

function renderAbout() {
  const el = $('#screen');
  el.innerHTML = `
    <h2>نبذة الموقع</h2>
    <p class="muted">هذا الموقع يحول فكرة البوت إلى موقع ويب كامل مع قاعدة بيانات SQLite ولوحة أدمن لإدارة الطلبات والمستخدمين والكروبات.</p>

    <div class="divider"></div>

    <div class="notice">
      <div class="info-grid">
        <span>الأدمن 1</span><b>7201745912</b>
        <span>الأدمن 2</span><b>1523406780</b>
        <span>المطور</span><b>${state.config?.developerUsername || '@BotBo3Bot'}</b>
        <span>الواجهة</span><b>HTML / CSS / JS</b>
      </div>
    </div>

    <div class="divider"></div>
    <button class="btn" id="backHome">🔙 رجوع</button>
  `;
  $('#backHome').onclick = renderHome;
}

function renderAddGroup() {
  if (!requireActiveUser()) return;

  const el = $('#screen');
  el.innerHTML = `
    <h2>➕ أضف كروبك</h2>
    <p class="muted">أدخل اسم المجموعة والرابط. سيتم إرسالها بحالة Pending حتى يقبلها الأدمن.</p>

    <div class="divider"></div>

    <div class="stack">
      <div>
        <label>اسم المجموعة</label>
        <input id="groupNameInput" placeholder="مثال: كروب الدراسة" />
      </div>
      <div>
        <label>رابط المجموعة</label>
        <input id="groupLinkInput" placeholder="مثال: https://t.me/example" />
      </div>
      <div class="button-row">
        <button class="btn primary" id="submitGroupBtn">إرسال الطلب</button>
        <button class="btn" id="showMyGroupsBtn">📌 مجموعاتي</button>
        <button class="btn" id="backHome">🔙 رجوع</button>
      </div>
    </div>
  `;

  $('#backHome').onclick = renderHome;
  $('#showMyGroupsBtn').onclick = renderMyGroups;
  $('#submitGroupBtn').onclick = async () => {
    const name = $('#groupNameInput').value.trim();
    const link = $('#groupLinkInput').value.trim();
    try {
      await api('/api/groups', {
        method: 'POST',
        body: { userId: state.user.id, name, link }
      });
      toast('تم إرسال الطلب بنجاح.');
      renderMyGroups();
    } catch (error) {
      toast(error.message);
    }
  };
}

async function renderMyGroups() {
  if (!requireUser()) return;
  const el = $('#screen');
  el.innerHTML = `<h2>📌 مجموعاتي</h2><p class="muted">جاري التحميل...</p>`;

  try {
    const data = await api(`/api/my-groups?userId=${encodeURIComponent(state.user.id)}`);
    const items = data.groups || [];

    el.innerHTML = `
      <h2>📌 مجموعاتي</h2>
      <p class="muted">كل الطلبات الخاصة بك مع حالتها الحالية.</p>
      <div class="divider"></div>
      <div class="list" id="myGroupsList"></div>
      <div class="divider"></div>
      <div class="button-row">
        <button class="btn primary" id="newGroupBtn">➕ طلب جديد</button>
        <button class="btn" id="backHome">🔙 رجوع</button>
      </div>
    `;

    const list = $('#myGroupsList');
    if (!items.length) {
      list.innerHTML = `<div class="notice">لا توجد مجموعات حتى الآن.</div>`;
    } else {
      list.innerHTML = items.map(item => `
        <div class="item">
          <div class="item-top">
            <div>
              <div class="item-title">${escapeHtml(item.name)}</div>
              <div class="item-meta">الرابط: <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(item.link)}</a></div>
            </div>
            ${statusBadge(item.status)}
          </div>
        </div>
      `).join('');
    }

    $('#newGroupBtn').onclick = renderAddGroup;
    $('#backHome').onclick = renderHome;
  } catch (error) {
    toast(error.message);
    renderHome();
  }
}

function renderSearch() {
  if (!requireActiveUser()) return;

  const el = $('#screen');
  el.innerHTML = `
    <h2>🔎 بحث عن كروبات</h2>
    <p class="muted">البحث يظهر فقط الكروبات التي تمت الموافقة عليها.</p>

    <div class="divider"></div>

    <div class="stack">
      <div>
        <label>اسم الكروب</label>
        <input id="searchInput" placeholder="اكتب الاسم الكامل للمجموعة" />
      </div>
      <div class="button-row">
        <button class="btn primary" id="searchBtn">بحث</button>
        <button class="btn" id="clearSearchBtn">إلغاء</button>
        <button class="btn" id="backHome">🔙 رجوع</button>
      </div>
      <div class="notice hidden" id="searchResult"></div>
    </div>
  `;

  $('#backHome').onclick = renderHome;
  $('#clearSearchBtn').onclick = () => {
    $('#searchInput').value = '';
    $('#searchResult').classList.add('hidden');
    $('#searchResult').innerHTML = '';
    toast('تم إلغاء العملية.');
  };

  $('#searchBtn').onclick = async () => {
    const q = $('#searchInput').value.trim();
    if (!q) return toast('اكتب اسم المجموعة.');
    try {
      const data = await api(`/api/search?userId=${encodeURIComponent(state.user.id)}&q=${encodeURIComponent(q)}`);
      const box = $('#searchResult');
      box.classList.remove('hidden');
      if (data.group) {
        box.innerHTML = `✅ تم العثور على المجموعة:<br><a href="${escapeHtml(data.group.link)}" target="_blank" rel="noreferrer">${escapeHtml(data.group.link)}</a>`;
      } else {
        box.textContent = 'لا توجد مجموعة بهذا الاسم أو لم تتم الموافقة عليها بعد.';
      }
    } catch (error) {
      toast(error.message);
    }
  };
}

async function renderAdminPanel() {
  if (!requireAdmin()) return;

  let stats;
  try {
    const data = await api(`/api/admin/stats?adminId=${encodeURIComponent(state.adminId)}`);
    stats = data.stats;
  } catch (error) {
    toast(error.message);
    return renderHome();
  }

  const el = $('#screen');
  el.innerHTML = `
    <h2>🛠️ لوحة الأدمن</h2>
    <p class="muted">إدارة الطلبات، الحظر، الإذاعة، عرض الكروبات، والحذف.</p>

    <div class="divider"></div>

    <div class="screen-actions">
      <button class="btn primary" id="pendingRequestsBtn">📥 الطلبات المعلقة</button>
      <button class="btn danger" id="banUserBtn">⛔ حظر مستخدم</button>
      <button class="btn success" id="unbanUserBtn">✅ إلغاء حظر</button>
      <button class="btn warning" id="broadcastBtn">📣 الإذاعة</button>
      <button class="btn" id="approvedGroupsBtn">⭐ عرض الكروبات</button>
      <button class="btn" id="deleteGroupBtn">🗑️ مسح مجموعة</button>
    </div>

    <div class="divider"></div>

    <div class="notice">
      <strong>الإحصائيات</strong>
      <div class="info-grid">
        <span>المستخدمون</span><b>${stats.users}</b>
        <span>المحظورون</span><b>${stats.banned}</b>
        <span>Pending</span><b>${stats.pending}</b>
        <span>Approved</span><b>${stats.approved}</b>
        <span>Rejected</span><b>${stats.rejected}</b>
      </div>
    </div>

    <div class="divider"></div>
    <button class="btn" id="backHome">🔙 رجوع</button>
  `;

  $('#pendingRequestsBtn').onclick = renderPendingRequests;
  $('#banUserBtn').onclick = renderBanUser;
  $('#unbanUserBtn').onclick = renderUnbanUser;
  $('#broadcastBtn').onclick = renderBroadcastEditor;
  $('#approvedGroupsBtn').onclick = renderApprovedGroups;
  $('#deleteGroupBtn').onclick = renderDeleteGroup;
  $('#backHome').onclick = renderHome;
}

async function renderPendingRequests() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `<h2>📥 الطلبات المعلقة</h2><p class="muted">جاري التحميل...</p>`;

  try {
    const data = await api(`/api/admin/requests?adminId=${encodeURIComponent(state.adminId)}`);
    const requests = data.requests || [];

    el.innerHTML = `
      <h2>📥 الطلبات المعلقة</h2>
      <p class="muted">يمكنك قبول أو رفض أي طلب، أو حظر صاحبه.</p>
      <div class="divider"></div>
      <div class="list" id="pendingList"></div>
      <div class="divider"></div>
      <button class="btn" id="backAdmin">🔙 رجوع</button>
    `;

    const list = $('#pendingList');
    if (!requests.length) {
      list.innerHTML = `<div class="notice">لا توجد طلبات معلقة حالياً.</div>`;
    } else {
      list.innerHTML = requests.map(item => `
        <div class="item">
          <div class="item-top">
            <div>
              <div class="item-title">${escapeHtml(item.name)}</div>
              <div class="item-meta">الرابط: <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(item.link)}</a></div>
              <div class="item-meta">المرسل: ${escapeHtml(item.owner_name)} ${item.owner_username ? `(@${escapeHtml(item.owner_username)})` : ''}</div>
              <div class="item-meta">User ID: ${escapeHtml(item.owner_id)}</div>
            </div>
            ${statusBadge(item.status)}
          </div>
          <div class="inline-actions">
            <button class="btn success" data-action="accept" data-id="${item.id}">قبول</button>
            <button class="btn danger" data-action="reject" data-id="${item.id}">رفض</button>
            <button class="btn warning" data-action="ban" data-user="${escapeHtml(item.owner_id)}">حظر المستخدم</button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll('button[data-action]').forEach((btn) => {
        btn.onclick = async () => {
          try {
            const action = btn.dataset.action;
            if (action === 'ban') {
              await api('/api/admin/ban', {
                method: 'POST',
                body: { adminId: state.adminId, targetUserId: btn.dataset.user }
              });
              toast('تم حظر المستخدم.');
            } else {
              await api('/api/admin/request-action', {
                method: 'POST',
                body: { adminId: state.adminId, groupId: Number(btn.dataset.id), action }
              });
              toast(action === 'accept' ? 'تم قبول المجموعة.' : 'تم رفض المجموعة.');
            }
            await refreshMe();
            renderPendingRequests();
          } catch (error) {
            toast(error.message);
          }
        };
      });
    }

    $('#backAdmin').onclick = renderAdminPanel;
  } catch (error) {
    toast(error.message);
    renderAdminPanel();
  }
}

function renderBanUser() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `
    <h2>⛔ حظر مستخدم</h2>
    <div class="stack">
      <div>
        <label>User ID</label>
        <input id="banUserInput" placeholder="أدخل User ID" />
      </div>
      <div class="button-row">
        <button class="btn danger" id="confirmBanBtn">حظر</button>
        <button class="btn" id="backAdmin">🔙 رجوع</button>
      </div>
    </div>
  `;
  $('#backAdmin').onclick = renderAdminPanel;
  $('#confirmBanBtn').onclick = async () => {
    const targetUserId = $('#banUserInput').value.trim();
    if (!targetUserId) return toast('أدخل User ID.');
    try {
      await api('/api/admin/ban', {
        method: 'POST',
        body: { adminId: state.adminId, targetUserId }
      });
      toast('تم حظر المستخدم.');
      await refreshMe();
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };
}

function renderUnbanUser() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `
    <h2>✅ إلغاء حظر مستخدم</h2>
    <div class="stack">
      <div>
        <label>User ID</label>
        <input id="unbanUserInput" placeholder="أدخل User ID" />
      </div>
      <div class="button-row">
        <button class="btn success" id="confirmUnbanBtn">إلغاء الحظر</button>
        <button class="btn" id="backAdmin">🔙 رجوع</button>
      </div>
    </div>
  `;
  $('#backAdmin').onclick = renderAdminPanel;
  $('#confirmUnbanBtn').onclick = async () => {
    const targetUserId = $('#unbanUserInput').value.trim();
    if (!targetUserId) return toast('أدخل User ID.');
    try {
      await api('/api/admin/unban', {
        method: 'POST',
        body: { adminId: state.adminId, targetUserId }
      });
      toast('تم إلغاء الحظر.');
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };
}

function renderBroadcastEditor() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `
    <h2>📣 الإذاعة</h2>
    <p class="muted">أي نص تكتبه هنا يظهر لكل الزوار في أعلى الموقع.</p>
    <div class="divider"></div>
    <div class="stack">
      <div>
        <label>نص الإذاعة</label>
        <textarea id="broadcastEditor">${escapeHtml(state.broadcast.text || '')}</textarea>
      </div>
      <div class="button-row">
        <button class="btn warning" id="saveBroadcastBtn">حفظ</button>
        <button class="btn danger" id="clearBroadcastBtn">مسح</button>
        <button class="btn" id="backAdmin">🔙 رجوع</button>
      </div>
    </div>
  `;
  $('#backAdmin').onclick = renderAdminPanel;
  $('#saveBroadcastBtn').onclick = async () => {
    try {
      const text = $('#broadcastEditor').value;
      await api('/api/admin/broadcast', {
        method: 'POST',
        body: { adminId: state.adminId, text }
      });
      await refreshBroadcast();
      toast('تم تحديث الإذاعة.');
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };
  $('#clearBroadcastBtn').onclick = async () => {
    try {
      await api('/api/admin/broadcast', {
        method: 'POST',
        body: { adminId: state.adminId, text: '' }
      });
      await refreshBroadcast();
      toast('تم مسح الإذاعة.');
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };
}

async function renderApprovedGroups() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `<h2>⭐ عرض الكروبات</h2><p class="muted">جاري التحميل...</p>`;

  try {
    const data = await api(`/api/admin/groups?adminId=${encodeURIComponent(state.adminId)}`);
    const groups = data.groups || [];

    el.innerHTML = `
      <h2>⭐ الكروبات المعتمدة</h2>
      <p class="muted">هذه هي المجموعات المقبولة فقط.</p>
      <div class="divider"></div>
      <div class="list" id="approvedList"></div>
      <div class="divider"></div>
      <button class="btn" id="backAdmin">🔙 رجوع</button>
    `;

    const list = $('#approvedList');
    if (!groups.length) {
      list.innerHTML = `<div class="notice">لا توجد مجموعات معتمدة.</div>`;
    } else {
      list.innerHTML = groups.map(item => `
        <div class="item">
          <div class="item-top">
            <div>
              <div class="item-title">${escapeHtml(item.name)}</div>
              <div class="item-meta">الرابط: <a href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer">${escapeHtml(item.link)}</a></div>
              <div class="item-meta">المالك: ${escapeHtml(item.owner_name)} ${item.owner_username ? `(@${escapeHtml(item.owner_username)})` : ''}</div>
            </div>
            ${statusBadge(item.status)}
          </div>
        </div>
      `).join('');
    }

    $('#backAdmin').onclick = renderAdminPanel;
  } catch (error) {
    toast(error.message);
    renderAdminPanel();
  }
}

function renderDeleteGroup() {
  if (!requireAdmin()) return;
  const el = $('#screen');
  el.innerHTML = `
    <h2>🗑️ مسح مجموعة</h2>
    <div class="stack">
      <div>
        <label>اسم المجموعة أو رابطها</label>
        <input id="deleteGroupInput" placeholder="اكتب الاسم أو الرابط" />
      </div>
      <div class="button-row">
        <button class="btn danger" id="confirmDeleteGroupBtn">مسح</button>
        <button class="btn" id="backAdmin">🔙 رجوع</button>
      </div>
    </div>
  `;
  $('#backAdmin').onclick = renderAdminPanel;
  $('#confirmDeleteGroupBtn').onclick = async () => {
    const input = $('#deleteGroupInput').value.trim();
    if (!input) return toast('أدخل الاسم أو الرابط.');
    try {
      await api('/api/admin/delete-group', {
        method: 'POST',
        body: { adminId: state.adminId, input }
      });
      toast('تم مسح المجموعة.');
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };
}

async function bindSidebarActions() {
  $('#saveIdentityBtn').onclick = async () => {
    const name = $('#nameInput').value.trim();
    const username = $('#usernameInput').value.trim().replace(/^@/, '');
    try {
      const data = await api('/api/register', {
        method: 'POST',
        body: { name, username, userId: getSavedUserId() }
      });
      state.user = data.user;
      setSavedUserId(data.user.id);
      updateHeader();
      toast('تم حفظ الهوية بنجاح.');
      renderHome();
    } catch (error) {
      toast(error.message);
    }
  };

  $('#adminLoginBtn').onclick = async () => {
    const adminId = $('#adminIdInput').value.trim();
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: { adminId }
      });
      state.adminId = data.adminId;
      updateHeader();
      toast('تم تسجيل دخول الأدمن.');
      renderAdminPanel();
    } catch (error) {
      toast(error.message);
    }
  };

  $('#adminLogoutBtn').onclick = () => {
    state.adminId = null;
    updateHeader();
    toast('تم تسجيل الخروج من الأدمن.');
    renderHome();
  };
}

async function boot() {
  try {
    const config = await api('/api/config');
    state.config = config;
  } catch {
    state.config = { developerUsername: '@BotBo3Bot' };
  }

  await refreshMe();
  await refreshBroadcast();
  updateHeader();
  bindSidebarActions();
  renderHome();
}

boot();
