/* ═══════════════════════════════════════════════════════════════
   UE Particular «Americano» — Portal ABP
   app.js  |  Lógica de cliente (Vanilla JS, sin dependencias)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════════
let allProjects      = [];
let allDeliverables  = [];
let activeFilter     = 'all';
let delivFilter      = 'all';
let searchQuery      = '';
let isUploading      = false;
let progressInterval = null;

// ══════════════════════════════════════════════════════════════════
// UTILIDADES DOM
// ══════════════════════════════════════════════════════════════════
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Escape HTML para prevenir XSS
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
  if (!b && b !== 0) return '—';
  if (b < 1024)    return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
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
  if (['jpg','jpeg','png','gif','bmp','webp','svg'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  return 'other';
}

// Clasifica asignatura para chip de color
function subjectClass(subjects) {
  const s = (subjects || '').toLowerCase();
  if (s.includes('robótica') || s.includes('robotica')) return 'robo';
  if (s.includes('emprendimiento')) return 'empr';
  if (s.includes('informática') || s.includes('informatica')) return 'info';
  return 'math';
}

// ══════════════════════════════════════════════════════════════════
// REFERENCIAS DOM
// ══════════════════════════════════════════════════════════════════
const projectsGrid        = $('#projects-grid');
const guideBackdrop       = $('#guide-modal-backdrop');
const guideModalLevel     = $('#guide-modal-level');
const guideModalSub       = $('#guide-modal-subtitle');
const guideModalBody      = $('#guide-modal-body');
const guideModalClose     = $('#guide-modal-close');
const uploadBackdrop      = $('#upload-modal-backdrop');
const uploadModalClose    = $('#upload-modal-close');
const uploadModalCancel   = $('#upload-modal-cancel');
const previewBackdrop     = $('#preview-modal-backdrop');
const previewModalClose   = $('#preview-modal-close');
const previewFilename     = $('#preview-modal-filename');
const previewStudent      = $('#preview-modal-student');
const previewContainer    = $('#preview-container');
const previewDownloadLink = $('#preview-download-link');
const uploadForm          = $('#upload-form');
const submitBtn           = $('#submit-btn');
const submitText          = $('#submit-text');
const submitIcon          = $('#submit-icon');
const formProject         = $('#form-project');
const formStudent         = $('#form-student');
const formTitle           = $('#form-title');
const formComments        = $('#form-comments');
const formFile            = $('#form-file');
const fileDropZone        = $('#file-drop-zone');
const fileSelectedName    = $('#file-selected-name');
const uploadProgress      = $('#upload-progress');
const progressFill        = $('#progress-fill');
const progressLabel       = $('#progress-label');
const toastContainer      = $('#toast-container');
const deliverablesContainer = $('#deliverables-container');
const filterDeliverables  = $('#filter-deliverables');
const deliverablesCount   = $('#deliverables-count');
const searchInput         = $('#search-student');
const statDeliverables    = $('#stat-deliverables');

// ══════════════════════════════════════════════════════════════════
// TOASTS
// ══════════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 4500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<span aria-hidden="true">${icons[type] || 'ℹ️'}</span>${esc(message)}`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ══════════════════════════════════════════════════════════════════
// MODALES — Apertura / Cierre
// ══════════════════════════════════════════════════════════════════
function openBackdrop(backdrop) {
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBackdrop(backdrop) {
  backdrop.classList.remove('open');
  if (!document.querySelector('.modal-backdrop.open')) {
    document.body.style.overflow = '';
  }
}

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (previewBackdrop.classList.contains('open')) { closePreviewModal(); return; }
  if (guideBackdrop.classList.contains('open'))   { closeGuideModal();   return; }
  if (uploadBackdrop.classList.contains('open'))  { closeUploadModal();  return; }
});

// Cerrar al hacer clic en el fondo
[guideBackdrop, uploadBackdrop, previewBackdrop].forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) closeBackdrop(bd); });
});

// ══════════════════════════════════════════════════════════════════
// MODAL — DETALLE DEL PROYECTO
// ══════════════════════════════════════════════════════════════════
function openGuideModal(project) {
  guideModalLevel.textContent = `${project.level} — ${project.title}`;
  guideModalSub.textContent   = `${project.subjects} · ${project.duration}`;

  // Pasos del estudiante
  const stepsHtml = (project.studentGuide || []).map((step, i) => {
    const match  = step.match(/^(📌 PASO \d+ \([^)]+\)):\s*(.+)$/s);
    const header = match ? match[1].replace('📌 ', '') : `Paso ${i + 1}`;
    const body   = match ? match[2] : step;
    return `
      <div class="student-step" role="listitem">
        <div class="step-num">${i + 1}</div>
        <div class="step-content">
          <div class="step-header">${esc(header)}</div>
          <div class="step-body">${esc(body)}</div>
        </div>
      </div>`;
  }).join('');

  // Cronograma
  const weeksHtml = (project.weeklyProgress || []).map((w, i) => `
    <tr>
      <td class="week-label">
        <span class="week-num">${i + 1}</span>${esc(w.week)}
      </td>
      <td>${esc(w.task)}</td>
    </tr>`).join('');

  // Rúbrica
  const rubricHtml = (project.rubric || []).map(r => `
    <li><span class="rubric-icon" aria-hidden="true">⭐</span>${esc(r)}</li>`).join('');

  // Interdisciplinariedad — mapa visual
  const subjList = (project.subjects || '').split('+').map(s => s.trim());
  const iconMap  = { 'Matemáticas': '📐', 'Informática': '💻', 'Robótica': '🤖', 'Electrónica e Informática': '🔌', 'Emprendimiento y Gestión': '💼', 'Emprendimiento y Gestión / Inform\\u00e1tica': '💼' };
  const roleMap  = { 'Matemáticas': 'Modelado y cálculo', 'Informática': 'Procesamiento y presentación', 'Robótica': 'Prototipo interactivo', 'Electrónica e Informática': 'Simulación y medición', 'Emprendimiento y Gestión': 'Viabilidad y aplicación', 'Emprendimiento y Gestión / Informática': 'Viabilidad y simulación' };
  const interdisHtml = subjList.map(s => `
    <div class="interdis-card">
      <div class="interdis-card-icon">${iconMap[s] || '📚'}</div>
      <div class="interdis-card-subject">${esc(s)}</div>
      <div class="interdis-card-role">${esc(roleMap[s] || 'Aporte al producto final')}</div>
    </div>`).join('');

  guideModalBody.innerHTML = `

    <!-- Pregunta guía -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">❓</span> Pregunta Guía</div>
      <div class="proj-challenge">${esc(project.challenge)}</div>
    </div>

    <!-- Objetivo -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">🎯</span> Objetivo General</div>
      <div class="proj-objective">${esc(project.objective)}</div>
    </div>

    ${stepsHtml ? `
    <!-- Guía paso a paso -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">📌</span> Guía Paso a Paso para el Estudiante</div>
      <div class="student-steps" role="list">${stepsHtml}</div>
    </div>` : ''}

    <!-- Interdisciplinariedad -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">🔀</span> Integración Interdisciplinaria</div>
      <div class="interdis-grid">${interdisHtml}</div>
    </div>

    <!-- Cronograma -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">📅</span> Cronograma de Actividades</div>
      <div style="border:1px solid var(--gris-200);border-radius:var(--r-md);overflow:hidden;">
        <table class="weekly-table" aria-label="Cronograma semanal">
          <thead><tr><th style="width:130px">Semana</th><th>Actividad y producto esperado</th></tr></thead>
          <tbody>${weeksHtml}</tbody>
        </table>
      </div>
    </div>

    <!-- Rúbrica -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">📊</span> Criterios de Evaluación</div>
      <ul class="rubric-list">${rubricHtml}</ul>
    </div>

    <!-- DCD -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">📋</span> Destrezas con Criterio de Desempeño (DCD)</div>
      <div class="proj-objective" style="font-size:.875rem">${esc(project.dcd)}</div>
    </div>

    <!-- Ficha técnica -->
    <div class="proj-section">
      <div class="proj-section-title"><span aria-hidden="true">📁</span> Ficha del Anteproyecto</div>
      <div class="proj-footer-info">
        <div class="proj-info-item">
          <div class="proj-info-label">Docentes</div>
          <div class="proj-info-value">${esc(project.teachers)}</div>
        </div>
        <div class="proj-info-item">
          <div class="proj-info-label">Duración</div>
          <div class="proj-info-value">${esc(project.duration)}</div>
        </div>
        <div class="proj-info-item">
          <div class="proj-info-label">Producto Final</div>
          <div class="proj-info-value">${esc(project.product)}</div>
        </div>
        <div class="proj-info-item">
          <div class="proj-info-label">Nivel</div>
          <div class="proj-info-value">${esc(project.level)} · ${esc(project.sublevel || '')}</div>
        </div>
      </div>
    </div>`;

  openBackdrop(guideBackdrop);
  setTimeout(() => guideModalClose.focus(), 200);
}

function closeGuideModal() { closeBackdrop(guideBackdrop); }
guideModalClose.addEventListener('click', closeGuideModal);

// ══════════════════════════════════════════════════════════════════
// MODAL — REGISTRAR ENTREGA
// ══════════════════════════════════════════════════════════════════
function openUploadModal(preselectedId = null) {
  if (preselectedId && formProject) formProject.value = preselectedId;
  openBackdrop(uploadBackdrop);
  setTimeout(() => {
    (formProject && formProject.value ? formStudent : formProject || uploadForm)?.focus();
  }, 200);
}

function closeUploadModal() {
  closeBackdrop(uploadBackdrop);
  resetUploadForm();
}

function resetUploadForm() {
  uploadForm?.reset();
  if (fileSelectedName) fileSelectedName.textContent = '';
  fileDropZone?.classList.remove('drag-over');
  hideProgress();
  setSubmitting(false);
}

uploadModalClose?.addEventListener('click', closeUploadModal);
uploadModalCancel?.addEventListener('click', closeUploadModal);
$('#btn-open-upload-header')?.addEventListener('click', () => openUploadModal());
$('#btn-open-upload-deliverables')?.addEventListener('click', () => openUploadModal());

// ── Drag & drop ────────────────────────────────────────────────
fileDropZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  fileDropZone.classList.add('drag-over');
});
fileDropZone?.addEventListener('dragleave', () => fileDropZone.classList.remove('drag-over'));
fileDropZone?.addEventListener('drop', (e) => {
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

formFile?.addEventListener('change', () => {
  if (formFile.files[0]) showSelectedFile(formFile.files[0]);
});

function showSelectedFile(file) {
  const mb = (file.size / 1048576).toFixed(2);
  if (fileSelectedName) fileSelectedName.textContent = `📎 ${file.name} (${mb} MB)`;
}

// ── Barra de progreso ─────────────────────────────────────────
function showProgress() {
  if (!uploadProgress || !progressFill) return;
  uploadProgress.classList.add('visible');
  progressFill.style.width = '0%';
  let pct = 0;
  progressInterval = setInterval(() => {
    if (pct < 85) {
      pct += Math.random() * 12;
      progressFill.style.width = Math.min(pct, 85) + '%';
    }
  }, 200);
}

function completeProgress() {
  clearInterval(progressInterval);
  if (!progressFill || !progressLabel) return;
  progressFill.style.width = '100%';
  progressLabel.textContent = '¡Entrega registrada exitosamente!';
  setTimeout(hideProgress, 1200);
}

function hideProgress() {
  clearInterval(progressInterval);
  if (!uploadProgress || !progressFill || !progressLabel) return;
  uploadProgress.classList.remove('visible');
  progressFill.style.width = '0%';
  progressLabel.textContent = 'Registrando entrega…';
}

function setSubmitting(state) {
  isUploading = state;
  if (submitBtn) submitBtn.disabled = state;
  if (submitText) submitText.textContent = state ? 'Registrando…' : 'Registrar Entrega';
  if (submitIcon) submitIcon.textContent = state ? '⏳' : '📤';
}

// ── Envío del formulario ──────────────────────────────────────
uploadForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  if (isUploading) return;

  const projectId   = formProject?.value?.trim() || '';
  const studentName = formStudent?.value?.trim() || '';
  const title       = formTitle?.value?.trim()   || '';
  const file        = formFile?.files?.[0] || null;

  if (!projectId)   { showToast('Seleccione un anteproyecto.', 'error'); formProject?.focus(); return; }
  if (!studentName) { showToast('Ingrese el nombre del estudiante.', 'error'); formStudent?.focus(); return; }
  if (!title)       { showToast('Ingrese el título de la entrega.', 'error'); formTitle?.focus(); return; }
  if (!file)        { showToast('Seleccione un archivo.', 'error'); return; }
  if (file.size > 50 * 1048576) { showToast('El archivo supera el límite de 50 MB.', 'error'); return; }

  // Validar tipo de archivo
  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = ['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','rar','png','jpg','jpeg','gif','webp'];
  if (!allowed.includes(ext)) {
    showToast(`Tipo de archivo no permitido (.${ext}). Use PDF, DOCX, XLSX, PPTX o ZIP.`, 'error');
    return;
  }

  setSubmitting(true);
  showProgress();

  // Generar URL de objeto local (funciona sin servidor)
  const fileUrl = URL.createObjectURL(file);

  const newDeliverable = {
    id:          'del-' + Date.now(),
    projectId:   projectId,
    studentName: studentName,
    title:       title,
    comments:    formComments?.value?.trim() || '',
    filename:    file.name,
    filePath:    fileUrl,
    sizeBytes:   file.size,
    uploadDate:  new Date().toISOString(),
    status:      'entregado'
  };

  setTimeout(() => {
    completeProgress();
    allDeliverables.unshift(newDeliverable);

    // Persistir en localStorage (sin el fileUrl que no es serializable entre sesiones)
    try {
      const toSave = { ...newDeliverable, filePath: null }; // fileUrl no sobrevive recargas
      const saved  = JSON.parse(localStorage.getItem('abp_deliverables') || '[]');
      saved.unshift(toSave);
      localStorage.setItem('abp_deliverables', JSON.stringify(saved));
    } catch (_) {}

    updateDeliverableStat();
    renderDeliverables();

    setTimeout(() => {
      closeUploadModal();
      showToast(`Entrega de «${studentName}» registrada correctamente. 🎉`, 'success', 5000);
    }, 400);
  }, 600);
});

// ══════════════════════════════════════════════════════════════════
// MODAL — PREVISUALIZADOR DE ARCHIVOS
// ══════════════════════════════════════════════════════════════════
function openPreviewModal(deliverable) {
  if (previewFilename) previewFilename.textContent = deliverable.filename;
  if (previewStudent)  previewStudent.textContent  = `${deliverable.studentName} · ${deliverable.title}`;
  if (previewDownloadLink) {
    previewDownloadLink.href     = deliverable.filePath || '#';
    previewDownloadLink.download = deliverable.filename;
  }

  if (previewContainer) previewContainer.innerHTML = '';

  if (!deliverable.filePath) {
    if (previewContainer) previewContainer.innerHTML = `
      <div class="preview-unsupported">
        <div style="font-size:2.5rem">📄</div>
        <p>Este archivo fue registrado en una sesión anterior y no puede previsualizarse.</p>
        <p style="font-size:.8125rem;color:var(--gris-400)">El archivo sólo está disponible para descarga durante la sesión en que fue subido.</p>
      </div>`;
  } else {
    const type = getFileType(deliverable.filename);
    if (type === 'image') {
      const img = document.createElement('img');
      img.className = 'preview-img';
      img.src = deliverable.filePath;
      img.alt = `Visualización de ${deliverable.filename}`;
      previewContainer?.appendChild(img);
    } else if (type === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.className = 'preview-iframe';
      iframe.src = deliverable.filePath;
      iframe.title = `PDF: ${deliverable.filename}`;
      previewContainer?.appendChild(iframe);
    } else {
      if (previewContainer) previewContainer.innerHTML = `
        <div class="preview-unsupported">
          <div style="font-size:2.5rem">📄</div>
          <p>Este tipo de archivo no admite previsualización directa en el navegador.</p>
          <a href="${esc(deliverable.filePath)}" download="${esc(deliverable.filename)}"
             class="btn btn-primary">⬇ Descargar «${esc(deliverable.filename)}»</a>
        </div>`;
    }
  }

  openBackdrop(previewBackdrop);
  setTimeout(() => previewModalClose?.focus(), 200);
}

function closePreviewModal() {
  if (previewContainer) previewContainer.innerHTML = '';
  closeBackdrop(previewBackdrop);
}

previewModalClose?.addEventListener('click', closePreviewModal);

// ══════════════════════════════════════════════════════════════════
// CARGAR PROYECTOS (desde API)
// ══════════════════════════════════════════════════════════════════
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = await res.json();
    renderProjects(filterProjects());
    populateSelects(allProjects);
  } catch (err) {
    if (projectsGrid) projectsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error al cargar los anteproyectos</div>
        <div class="empty-sub">${esc(err.message)}</div>
      </div>`;
    showToast('No se pudieron cargar los anteproyectos: ' + err.message, 'error');
  }
}

function filterProjects() {
  return activeFilter === 'all'
    ? allProjects
    : allProjects.filter(p => p.id === activeFilter);
}

// ══════════════════════════════════════════════════════════════════
// RENDERIZAR TARJETAS DE PROYECTOS
// ══════════════════════════════════════════════════════════════════
function renderProjects(projects) {
  if (!projects.length) {
    if (projectsGrid) projectsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Sin resultados para este filtro</div>
        <div class="empty-sub">Seleccione «Todos» o elija otro nivel educativo.</div>
      </div>`;
    return;
  }

  if (projectsGrid) projectsGrid.innerHTML = projects.map(p => buildProjectCard(p)).join('');

  $$('.card-guide-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const proj = allProjects.find(p => p.id === btn.dataset.projectId);
      if (proj) openGuideModal(proj);
    });
  });

  $$('.card-upload-btn').forEach(btn => {
    btn.addEventListener('click', () => openUploadModal(btn.dataset.projectId));
  });
}

function buildProjectCard(p) {
  // Chips de asignaturas
  const subjectChips = (p.subjects || '').split('+').map(s => {
    const name = s.trim();
    let cls = 'math';
    if (name.toLowerCase().includes('robótica') || name.toLowerCase().includes('electrónica')) cls = 'robo';
    else if (name.toLowerCase().includes('emprendimiento')) cls = 'empr';
    else if (name.toLowerCase().includes('informática')) cls = 'info';
    return `<span class="interdis-chip ${cls}">${esc(name)}</span>`;
  }).join('');

  return `
    <article class="project-card" role="listitem" data-project-id="${esc(p.id)}">
      <div class="card-top-band"></div>
      <div class="card-content">
        <div class="card-meta">
          <span class="badge badge-level">🏫 ${esc(p.level)}</span>
          <span class="badge badge-subjects">📖 ${esc(p.subjects)}</span>
        </div>
        <h3 class="card-title">${esc(p.title)}</h3>
        <blockquote class="card-challenge">
          <p>${esc(p.challenge)}</p>
        </blockquote>
        <div class="card-interdis" aria-label="Asignaturas involucradas">
          ${subjectChips}
        </div>
        <div class="card-product-block">
          <div class="card-product-label">Producto final</div>
          <div class="card-product-value">🎯 ${esc(p.product)}</div>
        </div>
      </div>
      <div class="card-footer">
        <button
          class="btn btn-outline btn-sm card-guide-btn"
          data-project-id="${esc(p.id)}"
          aria-label="Ver detalle completo de ${esc(p.title)}"
          id="guide-btn-${esc(p.id)}"
        >
          📘 Ver Detalle
        </button>
        <button
          class="btn btn-primary btn-sm card-upload-btn"
          data-project-id="${esc(p.id)}"
          aria-label="Registrar entrega para ${esc(p.title)}"
          id="upload-btn-${esc(p.id)}"
        >
          📤 Entregar
        </button>
      </div>
    </article>`;
}

// ══════════════════════════════════════════════════════════════════
// PESTAÑAS DE NIVEL
// ══════════════════════════════════════════════════════════════════
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    $$('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    renderProjects(filterProjects());
  });
});

// ══════════════════════════════════════════════════════════════════
// CARGAR ENTREGAS (desde localStorage)
// ══════════════════════════════════════════════════════════════════
function loadDeliverables() {
  try {
    const saved = JSON.parse(localStorage.getItem('abp_deliverables') || '[]');
    allDeliverables = saved;
  } catch (_) {
    allDeliverables = [];
  }
  updateDeliverableStat();
  renderDeliverables();
}

function updateDeliverableStat() {
  if (statDeliverables) statDeliverables.textContent = allDeliverables.length;
}

// ══════════════════════════════════════════════════════════════════
// POBLAR SELECTS
// ══════════════════════════════════════════════════════════════════
function populateSelects(projects) {
  const opts = projects.map(p =>
    `<option value="${esc(p.id)}">${esc(p.level)} — ${esc(p.title)}</option>`
  ).join('');

  if (formProject) formProject.innerHTML = '<option value="">— Seleccione un anteproyecto —</option>' + opts;

  if (filterDeliverables) {
    filterDeliverables.innerHTML =
      '<option value="all">Todos los anteproyectos</option>' +
      projects.map(p => `<option value="${esc(p.id)}">${esc(p.level)}</option>`).join('');
  }
}

// ══════════════════════════════════════════════════════════════════
// RENDERIZAR TABLA DE ENTREGAS
// ══════════════════════════════════════════════════════════════════
function getFilteredDeliverables() {
  return allDeliverables.filter(d => {
    const matchProject = delivFilter === 'all' || d.projectId === delivFilter;
    const matchSearch  = !searchQuery ||
      (d.studentName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchProject && matchSearch;
  });
}

function renderDeliverables() {
  const filtered = getFilteredDeliverables();
  if (deliverablesCount) {
    deliverablesCount.textContent = `${filtered.length} entrega${filtered.length !== 1 ? 's' : ''}`;
  }

  if (!filtered.length) {
    const msg = searchQuery
      ? `No se encontraron entregas para «${esc(searchQuery)}».`
      : delivFilter !== 'all'
          ? 'Sin entregas registradas para este anteproyecto.'
          : 'Aún no se han registrado entregas.';
    if (deliverablesContainer) deliverablesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">${msg}</div>
        <div class="empty-sub">Use el botón «Registrar Entrega» para agregar la primera.</div>
      </div>`;
    return;
  }

  const rows = filtered.map(d => buildDeliverableRow(d)).join('');
  if (deliverablesContainer) deliverablesContainer.innerHTML = `
    <div class="deliverables-table-wrap">
      <table class="deliverables-table" aria-label="Tabla de entregas de estudiantes">
        <thead>
          <tr>
            <th scope="col">Estudiante</th>
            <th scope="col">Entrega</th>
            <th scope="col">Anteproyecto</th>
            <th scope="col">Observaciones</th>
            <th scope="col">Estado</th>
            <th scope="col">Tamaño</th>
            <th scope="col">Fecha</th>
            <th scope="col">Acciones</th>
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
    btn.addEventListener('click', () => deleteDeliverable(btn.dataset.id, btn.dataset.title));
  });
}

function buildDeliverableRow(d) {
  const project = allProjects.find(p => p.id === d.projectId);
  const level   = project ? project.level : (d.projectId || '—');
  const hasFile = !!d.filePath;
  const fileLink = hasFile
    ? `href="${esc(d.filePath)}" download="${esc(d.filename)}"`
    : `href="#" onclick="return false;"`;
  return `
    <tr>
      <td class="td-student">${esc(d.studentName)}</td>
      <td class="td-title" title="${esc(d.title)}">${esc(d.title)}</td>
      <td><span class="badge badge-level" style="font-size:.66rem">${esc(level)}</span></td>
      <td class="td-comment" title="${esc(d.comments || '')}">${esc(d.comments || '—')}</td>
      <td><span class="status-badge entregado">🟢 Entregado</span></td>
      <td class="td-size">${formatBytes(d.sizeBytes)}</td>
      <td class="td-date">${formatDate(d.uploadDate)}</td>
      <td class="td-actions" style="display:flex;gap:4px;align-items:center">
        <button
          class="btn-action preview-btn"
          data-id="${esc(d.id)}"
          title="Previsualizar ${esc(d.filename)}"
          aria-label="Previsualizar archivo ${esc(d.filename)}"
        >👁</button>
        <a
          ${fileLink}
          class="btn-action"
          title="Descargar ${esc(d.filename)}"
          aria-label="Descargar archivo ${esc(d.filename)}"
          style="${hasFile ? '' : 'opacity:.4;pointer-events:none'}"
        >⬇</a>
        <button
          class="btn-action danger delete-btn"
          data-id="${esc(d.id)}"
          data-title="${esc(d.title)}"
          title="Eliminar entrega"
          aria-label="Eliminar entrega ${esc(d.title)}"
        >🗑</button>
      </td>
    </tr>`;
}

// ══════════════════════════════════════════════════════════════════
// FILTROS Y BÚSQUEDA
// ══════════════════════════════════════════════════════════════════
filterDeliverables?.addEventListener('change', () => {
  delivFilter = filterDeliverables.value;
  renderDeliverables();
});

searchInput?.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderDeliverables();
});

// ══════════════════════════════════════════════════════════════════
// ELIMINAR ENTREGA
// ══════════════════════════════════════════════════════════════════
function deleteDeliverable(id, title) {
  const ok = window.confirm(
    `¿Confirma la eliminación de la entrega «${title}»?\n\nEsta acción no puede deshacerse.`
  );
  if (!ok) return;

  allDeliverables = allDeliverables.filter(d => d.id !== id);
  try {
    localStorage.setItem('abp_deliverables', JSON.stringify(allDeliverables));
  } catch (_) {}
  updateDeliverableStat();
  renderDeliverables();
  showToast(`Entrega «${title}» eliminada.`, 'info');
}

// ══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════
(async function init() {
  loadDeliverables();   // Desde localStorage (sincrono)
  await loadProjects(); // Desde API (asíncrono)
})();
