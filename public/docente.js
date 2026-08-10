/* ═══════════════════════════════════════════════════════════════
   docente.js — Lógica del panel docente
   Autenticación Supabase Auth + carga de entregas vía API
   ═══════════════════════════════════════════════════════════════ */
'use strict';

// ── Configuración Supabase (solo anon key — pública y segura) ───
const SUPABASE_URL      = 'https://yqyjlyqeypdwojihhxhn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SOvtzuMuYcPcinXOsI3KRA_ZPhzdgXV';

// ── Estado ──────────────────────────────────────────────────────
let accessToken    = sessionStorage.getItem('docente_token') || '';
let allEntregas    = [];
let searchQuery    = '';
let filterProject  = 'all';
let allProjects    = [];

// ── DOM ─────────────────────────────────────────────────────────
const loginSection  = document.getElementById('login-section');
const panelSection  = document.getElementById('panel-section');
const loginForm     = document.getElementById('login-form');
const loginBtn      = document.getElementById('login-btn');
const loginText     = document.getElementById('login-text');
const loginIcon     = document.getElementById('login-icon');
const loginError    = document.getElementById('login-error');
const btnLogout     = document.getElementById('btn-logout');
const searchInput   = document.getElementById('search-input');
const filterProject_sel = document.getElementById('filter-project');
const tableBody     = document.getElementById('table-body');
const countBadge    = document.getElementById('count-badge');
const countTotal    = document.getElementById('count-total');
const countToday    = document.getElementById('count-today');
const countProjects = document.getElementById('count-projects');
const countStudents = document.getElementById('count-students');
const toastArea     = document.getElementById('toast-area');

// ── Utilidades ──────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(2)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  } catch { return iso; }
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  toastArea.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, 4000);
}

// ── Auth ────────────────────────────────────────────────────────
async function login(email, password) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error_description || data.msg || 'Credenciales incorrectas.');
  return data.access_token;
}

function logout() {
  sessionStorage.removeItem('docente_token');
  accessToken = '';
  showLogin();
}

// ── Vista ────────────────────────────────────────────────────────
function showLogin() {
  loginSection.style.display = 'flex';
  panelSection.classList.remove('active');
  btnLogout.style.display = 'none';
  loginError.classList.remove('show');
  loginForm.reset();
}

function showPanel() {
  loginSection.style.display = 'none';
  panelSection.classList.add('active');
  btnLogout.style.display = '';
}

// ── Login form ───────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  if (!email || !password) return;

  loginBtn.disabled = true;
  loginText.textContent = 'Verificando…';
  loginIcon.textContent = '⏳';
  loginError.classList.remove('show');

  try {
    accessToken = await login(email, password);
    sessionStorage.setItem('docente_token', accessToken);
    showPanel();
    await loadData();
  } catch (err) {
    loginError.textContent = '❌ ' + err.message;
    loginError.classList.add('show');
  } finally {
    loginBtn.disabled = false;
    loginText.textContent = 'Iniciar sesión';
    loginIcon.textContent = '🔑';
  }
});

btnLogout.addEventListener('click', logout);

// ── Cargar proyectos (para filtros) ─────────────────────────────
async function loadProjects() {
  try {
    const r = await fetch('/api/projects');
    if (!r.ok) return;
    allProjects = await r.json();
    filterProject_sel.innerHTML =
      '<option value="all">Todos los anteproyectos</option>' +
      allProjects.map(p => `<option value="${esc(p.id)}">${esc(p.level)} — ${esc(p.title)}</option>`).join('');
  } catch (_) {}
}

// ── Cargar entregas ──────────────────────────────────────────────
async function loadEntregas() {
  tableBody.innerHTML = `
    <div class="empty-state">
      <div class="spinner" role="status" aria-label="Cargando"></div>
      <div class="empty-title">Cargando entregas…</div>
    </div>`;

  const r = await fetch('/api/deliverables/list', {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  if (r.status === 401) { logout(); return; }
  if (!r.ok) throw new Error(`Error ${r.status}`);

  allEntregas = await r.json();
  updateStats();
  renderTable();
}

async function loadData() {
  await Promise.all([loadProjects(), loadEntregas()]);
}

// ── Estadísticas ─────────────────────────────────────────────────
function updateStats() {
  const hoy    = allEntregas.filter(e => isToday(e.created_at)).length;
  const projs  = new Set(allEntregas.map(e => e.proyecto_id)).size;
  const stds   = new Set(allEntregas.map(e => (e.estudiante||'').toLowerCase().trim())).size;

  countTotal.textContent    = allEntregas.length;
  countToday.textContent    = hoy;
  countProjects.textContent = projs;
  countStudents.textContent = stds;
}

// ── Renderizar tabla ─────────────────────────────────────────────
function getFiltered() {
  const q = searchQuery.toLowerCase();
  return allEntregas.filter(e => {
    const matchProj = filterProject === 'all' || e.proyecto_id === filterProject;
    const matchQ    = !q || (e.estudiante||'').toLowerCase().includes(q) || (e.titulo||'').toLowerCase().includes(q);
    return matchProj && matchQ;
  });
}

function renderTable() {
  const filtered = getFiltered();
  countBadge.textContent = `${filtered.length} entrega${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    tableBody.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">${searchQuery ? `Sin resultados para «${esc(searchQuery)}»` : 'Sin entregas registradas aún'}</div>
        <div class="empty-sub">Cuando los estudiantes suban evidencias aparecerán aquí.</div>
      </div>`;
    return;
  }

  const rows = filtered.map(e => {
    const proj = allProjects.find(p => p.id === e.proyecto_id);
    const nivel = proj ? proj.level : (e.nivel || e.proyecto_id || '—');
    return `
      <tr>
        <td class="td-student">${esc(e.estudiante)}</td>
        <td class="td-title" title="${esc(e.titulo)}">${esc(e.titulo)}</td>
        <td><span class="badge-level">🏫 ${esc(nivel)}</span></td>
        <td class="td-file" title="${esc(e.filename)}">📄 ${esc(e.filename)}</td>
        <td class="td-size">${formatBytes(e.size_bytes)}</td>
        <td class="td-date">${formatDate(e.created_at)}</td>
        <td><span class="status-ok">🟢 Entregado</span></td>
        <td class="td-actions">
          <button class="btn-act primary view-btn" data-id="${esc(e.id)}" title="Ver / descargar" aria-label="Ver archivo de ${esc(e.estudiante)}">👁</button>
        </td>
      </tr>`;
  }).join('');

  tableBody.innerHTML = `
    <table class="del-table" aria-label="Tabla de entregas de estudiantes">
      <thead>
        <tr>
          <th scope="col">Estudiante</th>
          <th scope="col">Título entrega</th>
          <th scope="col">Anteproyecto</th>
          <th scope="col">Archivo</th>
          <th scope="col">Tamaño</th>
          <th scope="col">Fecha</th>
          <th scope="col">Estado</th>
          <th scope="col">Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Eventos de descarga
  tableBody.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => openFile(btn.dataset.id));
  });
}

// ── Abrir archivo (URL firmada) ──────────────────────────────────
async function openFile(id) {
  const btn = tableBody.querySelector(`.view-btn[data-id="${id}"]`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const r = await fetch(`/api/deliverables/file?id=${encodeURIComponent(id)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (r.status === 401) { logout(); return; }
    if (!r.ok) throw new Error(`Error ${r.status}`);

    const { signedUrl, filename } = await r.json();
    if (!signedUrl) throw new Error('URL no disponible');

    window.open(signedUrl, '_blank', 'noopener');
    showToast(`📄 Abriendo: ${filename}`, 'success');
  } catch (err) {
    showToast('❌ Error al abrir el archivo: ' + err.message, 'error');
  } finally {
    if (btn) { btn.textContent = '👁'; btn.disabled = false; }
  }
}

// ── Filtros ──────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderTable();
});

filterProject_sel.addEventListener('change', () => {
  filterProject = filterProject_sel.value;
  renderTable();
});

// ── Init ─────────────────────────────────────────────────────────
(async function init() {
  if (accessToken) {
    showPanel();
    await loadData();
  } else {
    showLogin();
  }
})();
