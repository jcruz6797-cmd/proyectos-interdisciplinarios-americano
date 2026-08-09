/* ═══════════════════════════════════════════════════════════
   UE Particular «Americano» — Portal ABP
   app.js  |  Lógica de cliente (100% Estático y Funcional)
   ═══════════════════════════════════════════════════════════ */

'use strict';

// ── Estado global ──────────────────────────────────────────────────────────────
let allProjects     = [];
let allDeliverables = [];
let activeFilter    = 'all';   // pestaña de nivel
let delivFilter     = 'all';   // select de proyecto en entregas
let searchQuery     = '';      // búsqueda por estudiante
let isUploading     = false;
let progressInterval = null;

// ── Utilidades DOM ─────────────────────────────────────────────────────────────
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ── Referencias ────────────────────────────────────────────────────────────────

// Proyectos
const projectsGrid    = $('#projects-grid');

// Modales
const guideBackdrop   = $('#guide-modal-backdrop');
const guideModalLevel = $('#guide-modal-level');
const guideModalSub   = $('#guide-modal-subtitle');
const guideModalBody  = $('#guide-modal-body');
const guideModalClose = $('#guide-modal-close');

const uploadBackdrop   = $('#upload-modal-backdrop');
const uploadModalClose = $('#upload-modal-close');
const uploadModalCancel = $('#upload-modal-cancel');

const previewBackdrop    = $('#preview-modal-backdrop');
const previewModalClose  = $('#preview-modal-close');
const previewFilename    = $('#preview-modal-filename');
const previewStudent     = $('#preview-modal-student');
const previewContainer   = $('#preview-container');
const previewDownloadLink = $('#preview-download-link');

// Formulario de subida
const uploadForm      = $('#upload-form');
const submitBtn       = $('#submit-btn');
const submitText      = $('#submit-text');
const submitIcon      = $('#submit-icon');
const formProject     = $('#form-project');
const formStudent     = $('#form-student');
const formTitle       = $('#form-title');
const formComments    = $('#form-comments');
const formFile        = $('#form-file');
const fileDropZone    = $('#file-drop-zone');
const fileSelectedName = $('#file-selected-name');
const uploadProgress  = $('#upload-progress');
const progressFill    = $('#progress-fill');
const progressLabel   = $('#progress-label');
const toastContainer  = $('#toast-container');

// Entregas
const deliverablesContainer = $('#deliverables-container');
const filterDeliverables    = $('#filter-deliverables');
const deliverablesCount     = $('#deliverables-count');
const searchInput           = $('#search-student');
const statDeliverables      = $('#stat-deliverables');

// ══════════════════════════════════════════════════════════════════════════════
// TOASTS
// ══════════════════════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span aria-hidden="true">${icons[type]}</span>${message}`;
  if (toastContainer) toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ══════════════════════════════════════════════════════════════════════════════
// ESCAPE HTML & FORMATO
// ══════════════════════════════════════════════════════════════════════════════
function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024)        return `${b} B`;
  if (b < 1048576)     return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
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

function getFileType(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  const images = ['jpg','jpeg','png','gif','bmp','webp','svg'];
  const pdfs   = ['pdf'];
  if (images.includes(ext)) return 'image';
  if (pdfs.includes(ext))   return 'pdf';
  return 'other';
}

// ══════════════════════════════════════════════════════════════════════════════
// MODALES
// ══════════════════════════════════════════════════════════════════════════════
function openBackdrop(backdrop) {
  if (!backdrop) return;
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBackdrop(backdrop) {
  if (!backdrop) return;
  backdrop.classList.remove('open');
  if (!document.querySelector('.modal-backdrop.open')) {
    document.body.style.overflow = '';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (previewBackdrop && previewBackdrop.classList.contains('open')) { closePreviewModal(); return; }
  if (guideBackdrop && guideBackdrop.classList.contains('open'))     { closeGuideModal();   return; }
  if (uploadBackdrop && uploadBackdrop.classList.contains('open'))   { closeUploadModal();  return; }
});

[guideBackdrop, uploadBackdrop, previewBackdrop].forEach(bd => {
  if (bd) bd.addEventListener('click', (e) => { if (e.target === bd) closeBackdrop(bd); });
});

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — GUÍA Y AVANCES
// ══════════════════════════════════════════════════════════════════════════════
function openGuideModal(project) {
  if (!guideModalLevel) return;
  guideModalLevel.textContent = `${project.level} — ${project.title}`;
  guideModalSub.textContent   = project.subjects;

  const weeksHtml = (project.weeklyProgress || []).map((w, i) => `
    <tr>
      <td class="week-label">
        <span class="week-num" aria-hidden="true">${i + 1}</span>${esc(w.week)}
      </td>
      <td>${esc(w.task)}</td>
    </tr>`).join('');

  const rubricHtml = (project.rubric || []).map(r => `
    <li>
      <span class="rubric-icon" aria-hidden="true">⭐</span>
      ${esc(r)}
    </li>`).join('');

  guideModalBody.innerHTML = `
    <div class="guide-section">
      <div class="guide-section-title">🎯 Objetivo General</div>
      <div class="guide-objective">${esc(project.objective || project.challenge)}</div>
    </div>
    <div class="guide-section">
      <div class="guide-section-title">❓ Pregunta Reto Investigativa</div>
      <div class="guide-objective" style="font-style:italic;">${esc(project.challenge)}</div>
    </div>
    ${project.dcd ? `<div class="guide-section">
      <div class="guide-section-title">📋 Destrezas (DCD)</div>
      <div class="guide-dcd">${esc(project.dcd)}</div>
    </div>` : ''}
    <div class="guide-section">
      <div class="guide-section-title">📅 Cronograma de Avances (4 Semanas)</div>
      <div style="border:1.5px solid var(--border,#e2e8f0);border-radius:8px;overflow:hidden;">
        <table class="weekly-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f8fafc;text-align:left;">
              <th style="padding:8px 12px;width:120px">Semana</th>
              <th style="padding:8px 12px">Actividad Requerida</th>
            </tr>
          </thead>
          <tbody>${weeksHtml}</tbody>
        </table>
      </div>
    </div>
    <div class="guide-section">
      <div class="guide-section-title">📊 Rúbrica de Evaluación</div>
      <ul class="rubric-list">${rubricHtml}</ul>
    </div>`;

  openBackdrop(guideBackdrop);
}

function closeGuideModal() { closeBackdrop(guideBackdrop); }
if (guideModalClose) guideModalClose.addEventListener('click', closeGuideModal);

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — SUBIR ENTREGA
// ══════════════════════════════════════════════════════════════════════════════
function openUploadModal(preselectedId = null) {
  if (preselectedId && formProject) formProject.value = preselectedId;
  openBackdrop(uploadBackdrop);
}

function closeUploadModal() {
  closeBackdrop(uploadBackdrop);
  resetUploadForm();
}

function resetUploadForm() {
  if (uploadForm) uploadForm.reset();
  if (fileSelectedName) fileSelectedName.textContent = '';
  hideProgress();
  setSubmitting(false);
}

if (uploadModalClose) uploadModalClose.addEventListener('click', closeUploadModal);
if (uploadModalCancel) uploadModalCancel.addEventListener('click', closeUploadModal);

const openHeaderBtn = $('#btn-open-upload-header') || $('#openUploadBtn');
if (openHeaderBtn) openHeaderBtn.addEventListener('click', () => openUploadModal());

if (fileDropZone) {
  fileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropZone.classList.add('drag-over'); });
  fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('drag-over'));
  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && formFile) {
      const dt = new DataTransfer();
      dt.items.add(file);
      formFile.files = dt.files;
      showSelectedFile(file);
    }
  });
}

if (formFile) {
  formFile.addEventListener('change', () => {
    if (formFile.files[0]) showSelectedFile(formFile.files[0]);
  });
}

function showSelectedFile(file) {
  const mb = (file.size / 1048576).toFixed(2);
  if (fileSelectedName) fileSelectedName.textContent = `📎 ${file.name} (${mb} MB)`;
}

function showProgress() {
  if (uploadProgress) uploadProgress.classList.add('visible');
  if (progressFill) progressFill.style.width = '0%';
  let pct = 0;
  progressInterval = setInterval(() => {
    if (pct < 85) { pct += 10; if (progressFill) progressFill.style.width = pct + '%'; }
  }, 150);
}

function completeProgress() {
  clearInterval(progressInterval);
  if (progressFill) progressFill.style.width = '100%';
  setTimeout(hideProgress, 800);
}

function hideProgress() {
  clearInterval(progressInterval);
  if (uploadProgress) uploadProgress.classList.remove('visible');
}

function setSubmitting(state) {
  isUploading = state;
  if (submitBtn) submitBtn.disabled = state;
  if (submitText) submitText.textContent = state ? 'Registrando…' : 'Registrar entrega';
}

// Envío del formulario
if (uploadForm) {
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isUploading) return;

    const projectId   = formProject ? formProject.value.trim() : '';
    const studentName = formStudent ? formStudent.value.trim() : '';
    const title       = formTitle ? formTitle.value.trim() : '';
    const file        = formFile && formFile.files ? formFile.files[0] : null;

    if (!projectId)   { showToast('Seleccione un anteproyecto.', 'error'); return; }
    if (!studentName) { showToast('Ingrese el nombre del estudiante.', 'error'); return; }
    if (!title)       { showToast('Ingrese el título de la entrega.', 'error'); return; }
    if (!file)        { showToast('Seleccione un archivo.', 'error'); return; }

    setSubmitting(true);
    showProgress();

    // Crear URL de objeto para previsualizar/descargar en el navegador
    const fileUrl = URL.createObjectURL(file);

    const newDeliverable = {
      id: 'del-' + Date.now(),
      projectId: projectId,
      studentName: studentName,
      title: title,
      comments: formComments ? formComments.value.trim() : '',
      filename: file.name,
      filePath: fileUrl,
      sizeBytes: file.size,
      uploadDate: new Date().toISOString()
    };

    setTimeout(() => {
      completeProgress();
      allDeliverables.unshift(newDeliverable);

      // Guardar en localStorage
      try {
        const saved = JSON.parse(localStorage.getItem('abp_deliverables') || '[]');
        saved.unshift(newDeliverable);
        localStorage.setItem('abp_deliverables', JSON.stringify(saved));
      } catch (e) {}

      updateDeliverableStat();
      renderDeliverables();

      setTimeout(() => {
        closeUploadModal();
        showToast(`Entrega de «${studentName}» registrada correctamente.`, 'success');
      }, 500);
    }, 600);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PREVISUALIZADOR DE ARCHIVOS
// ══════════════════════════════════════════════════════════════════════════════
function openPreviewModal(deliverable) {
  if (!previewContainer) return;
  previewFilename.textContent = deliverable.filename;
  previewStudent.textContent  = `${deliverable.studentName} · ${deliverable.title}`;
  previewDownloadLink.href     = deliverable.filePath;
  previewDownloadLink.download = deliverable.filename;

  previewContainer.innerHTML = '';
  const type = getFileType(deliverable.filename);

  if (type === 'image') {
    previewContainer.innerHTML = `<img src="${deliverable.filePath}" class="preview-img" style="max-width:100%;max-height:70vh;border-radius:8px;" alt="Vista previa">`;
  } else if (type === 'pdf') {
    previewContainer.innerHTML = `<iframe src="${deliverable.filePath}" style="width:100%;height:70vh;border:none;border-radius:8px;" title="PDF"></iframe>`;
  } else {
    previewContainer.innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <div style="font-size:3rem;margin-bottom:12px;">📄</div>
        <p style="margin-bottom:16px;color:#64748b;">Este tipo de archivo (${deliverable.filename}) se abre mediante descarga directa.</p>
        <a href="${deliverable.filePath}" download="${deliverable.filename}" class="btn btn-primary">
          ⬇ Descargar «${deliverable.filename}»
        </a>
      </div>`;
  }

  openBackdrop(previewBackdrop);
}

function closePreviewModal() {
  if (previewContainer) previewContainer.innerHTML = '';
  closeBackdrop(previewBackdrop);
}
if (previewModalClose) previewModalClose.addEventListener('click', closePreviewModal);

// ══════════════════════════════════════════════════════════════════════════════
// CARGAR PROYECTOS Y ENTREGAS (100% Estático desde JSON)
// ══════════════════════════════════════════════════════════════════════════════
async function loadProjects() {
  try {
    const res = await fetch('./projects.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = await res.json();
    renderProjects(filterProjects());
    populateSelects(allProjects);
  } catch (err) {
    if (projectsGrid) {
      projectsGrid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error al cargar los anteproyectos</div>
          <div class="empty-sub">${esc(err.message)}</div>
        </div>`;
    }
  }
}

async function loadDeliverables() {
  try {
    let savedLocal = [];
    try { savedLocal = JSON.parse(localStorage.getItem('abp_deliverables') || '[]'); } catch(e){}

    let resData = [];
    try {
      const res = await fetch('./deliverables.json');
      if (res.ok) resData = await res.json();
    } catch(e) {}

    allDeliverables = [...savedLocal, ...resData];
    updateDeliverableStat();
    renderDeliverables();
  } catch (err) {
    allDeliverables = [];
    renderDeliverables();
  }
}

function filterProjects() {
  return activeFilter === 'all'
    ? allProjects
    : allProjects.filter(p => p.id === activeFilter);
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDERIZAR TARJETAS Y TABLA
// ══════════════════════════════════════════════════════════════════════════════
function renderProjects(projects) {
  if (!projectsGrid) return;
  if (!projects.length) {
    projectsGrid.innerHTML = `<div class="empty-state"><p>Sin anteproyectos para este nivel.</p></div>`;
    return;
  }

  projectsGrid.innerHTML = projects.map(p => `
    <article class="project-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
          <span class="badge" style="background:#eff6ff;color:#2563eb;font-weight:700;font-size:0.75rem;padding:4px 10px;border-radius:12px;">🏫 ${esc(p.level)}</span>
          <span class="badge" style="background:#dcfce7;color:#166534;font-weight:700;font-size:0.75rem;padding:4px 10px;border-radius:12px;">💰 $0</span>
        </div>
        <h3 style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:8px;">${esc(p.title)}</h3>
        <p style="font-size:0.85rem;color:#64748b;margin-bottom:12px;">📖 ${esc(p.subjects)}</p>
        <blockquote style="font-size:0.88rem;font-style:italic;background:#f8fafc;padding:10px;border-left:3px solid #2563eb;margin-bottom:12px;">${esc(p.challenge)}</blockquote>
        <div style="font-size:0.85rem;font-weight:600;color:#0f172a;margin-bottom:16px;">🎯 Producto: ${esc(p.product)}</div>
      </div>
      <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid #e2e8f0;">
        <button class="btn btn-secondary card-guide-btn" data-id="${esc(p.id)}" style="flex:1;font-size:0.82rem;padding:8px;">📘 Guía y Avances</button>
        <button class="btn btn-primary card-upload-btn" data-id="${esc(p.id)}" style="flex:1;font-size:0.82rem;padding:8px;">📤 Subir Entrega</button>
      </div>
    </article>
  `).join('');

  $$('.card-guide-btn', projectsGrid).forEach(btn => {
    btn.addEventListener('click', () => {
      const proj = allProjects.find(p => p.id === btn.dataset.id);
      if (proj) openGuideModal(proj);
    });
  });

  $$('.card-upload-btn', projectsGrid).forEach(btn => {
    btn.addEventListener('click', () => openUploadModal(btn.dataset.id));
  });
}

function updateDeliverableStat() {
  if (statDeliverables) statDeliverables.textContent = allDeliverables.length;
}

function renderDeliverables() {
  if (!deliverablesContainer) return;

  const filtered = allDeliverables.filter(d => {
    const matchProj = delivFilter === 'all' || d.projectId === delivFilter;
    const matchSearch = !searchQuery || d.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchProj && matchSearch;
  });

  if (deliverablesCount) deliverablesCount.textContent = `${filtered.length} entrega${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    deliverablesContainer.innerHTML = `<div class="empty-state" style="padding:30px;text-align:center;color:#64748b;"><p>Aún no hay entregas registradas para este filtro.</p></div>`;
    return;
  }

  const rows = filtered.map(d => {
    const proj = allProjects.find(p => p.id === d.projectId);
    const level = proj ? proj.level : d.projectId;
    return `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:12px;font-weight:600;color:#0f172a;">${esc(d.studentName)}</td>
        <td style="padding:12px;">${esc(d.title)}</td>
        <td style="padding:12px;"><span style="background:#e2e8f0;padding:2px 8px;border-radius:10px;font-size:0.75rem;">${esc(level)}</span></td>
        <td style="padding:12px;color:#64748b;">${esc(d.comments || '—')}</td>
        <td style="padding:12px;font-size:0.8rem;">${formatBytes(d.sizeBytes)}</td>
        <td style="padding:12px;font-size:0.8rem;color:#64748b;">${formatDate(d.uploadDate)}</td>
        <td style="padding:12px;">
          <button class="preview-btn" data-id="${esc(d.id)}" style="background:none;border:none;cursor:pointer;font-size:1.1rem;" title="Visualizar">👁️</button>
          <a href="${esc(d.filePath)}" download="${esc(d.filename)}" style="text-decoration:none;font-size:1.1rem;margin:0 6px;" title="Descargar">⬇️</a>
          <button class="delete-btn" data-id="${esc(d.id)}" style="background:none;border:none;cursor:pointer;font-size:1.1rem;" title="Eliminar">🗑️</button>
        </td>
      </tr>`;
  }).join('');

  deliverablesContainer.innerHTML = `
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;text-align:left;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;font-size:0.82rem;color:#64748b;">
            <th style="padding:10px;">Estudiante</th>
            <th style="padding:10px;">Título</th>
            <th style="padding:10px;">Anteproyecto</th>
            <th style="padding:10px;">Comentarios</th>
            <th style="padding:10px;">Tamaño</th>
            <th style="padding:10px;">Fecha</th>
            <th style="padding:10px;">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  $$('.preview-btn', deliverablesContainer).forEach(btn => {
    btn.addEventListener('click', () => {
      const d = allDeliverables.find(x => x.id === btn.dataset.id);
      if (d) openPreviewModal(d);
    });
  });

  $$('.delete-btn', deliverablesContainer).forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('¿Eliminar esta entrega?')) {
        allDeliverables = allDeliverables.filter(x => x.id !== btn.dataset.id);
        try { localStorage.setItem('abp_deliverables', JSON.stringify(allDeliverables)); } catch(e){}
        updateDeliverableStat();
        renderDeliverables();
        showToast('Entrega eliminada.', 'info');
      }
    });
  });
}

// Pestañas de Filtro
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter || 'all';
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProjects(filterProjects());
  });
});

if (filterDeliverables) {
  filterDeliverables.addEventListener('change', () => {
    delivFilter = filterDeliverables.value;
    renderDeliverables();
  });
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    renderDeliverables();
  });
}

function populateSelects(projects) {
  const opts = projects.map(p => `<option value="${esc(p.id)}">${esc(p.level)} — ${esc(p.title)}</option>`).join('');
  if (formProject) formProject.innerHTML = '<option value="">— Seleccione un anteproyecto —</option>' + opts;
  if (filterDeliverables) {
    filterDeliverables.innerHTML = '<option value="all">Todos los anteproyectos</option>' +
      projects.map(p => `<option value="${esc(p.id)}">${esc(p.level)}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════════════════
(async function init() {
  await loadProjects();
  await loadDeliverables();
})();
