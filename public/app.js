/* ═══════════════════════════════════════════════════════════
   UE Particular «Americano» — Portal ABP
   app.js  |  Lógica de cliente (vanilla JS)
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

const uploadBackdrop  = $('#upload-modal-backdrop');
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
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s, transform .3s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

// ══════════════════════════════════════════════════════════════════════════════
// ESCAPE HTML
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

// ══════════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ══════════════════════════════════════════════════════════════════════════════
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
// MODAL HELPER — abrir / cerrar genérico
// ══════════════════════════════════════════════════════════════════════════════
function openBackdrop(backdrop) {
  backdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeBackdrop(backdrop) {
  backdrop.classList.remove('open');
  // Solo restaurar scroll si ningún otro modal está abierto
  if (!document.querySelector('.modal-backdrop.open')) {
    document.body.style.overflow = '';
  }
}

// Cerrar con Escape
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // Cierra de más reciente a más antiguo
  if (previewBackdrop.classList.contains('open')) { closePreviewModal(); return; }
  if (guideBackdrop.classList.contains('open'))   { closeGuideModal();   return; }
  if (uploadBackdrop.classList.contains('open'))  { closeUploadModal();  return; }
});

// Cerrar al click fuera
[guideBackdrop, uploadBackdrop, previewBackdrop].forEach(bd => {
  bd.addEventListener('click', (e) => { if (e.target === bd) closeBackdrop(bd); });
});

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — GUÍA Y AVANCES
// ══════════════════════════════════════════════════════════════════════════════
function openGuideModal(project) {
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

  // Guía del Estudiante paso a paso
  const studentGuideHtml = (project.studentGuide || []).map((step, i) => {
    // Separar el prefijo "📌 PASO N (Semana N - Título):" del cuerpo
    const match = step.match(/^(📌 PASO \d+ \([^)]+\)):\s*(.+)$/s);
    const header = match ? match[1] : `📌 PASO ${i + 1}`;
    const body   = match ? match[2] : step;
    return `
      <div class="student-step" role="listitem">
        <div class="student-step-header">${esc(header)}</div>
        <div class="student-step-body">${esc(body)}</div>
      </div>`;
  }).join('');

  guideModalBody.innerHTML = `
    <!-- ★ Guía Paso a Paso para el Estudiante -->
    ${studentGuideHtml ? `
    <div class="guide-section student-guide-section" aria-label="Guía paso a paso para el estudiante">
      <div class="guide-section-title student-guide-title">
        <span aria-hidden="true">💡</span> Guía Paso a Paso para el Estudiante
      </div>
      <div class="student-steps-list" role="list">
        ${studentGuideHtml}
      </div>
    </div>` : ''}

    <!-- Objetivo -->
    <div class="guide-section">
      <div class="guide-section-title">
        <span aria-hidden="true">🎯</span> Objetivo General
      </div>
      <div class="guide-objective">${esc(project.objective)}</div>
    </div>

    <!-- Reto central -->
    <div class="guide-section">
      <div class="guide-section-title">
        <span aria-hidden="true">❓</span> Pregunta Problematizadora
      </div>
      <div class="guide-objective" style="font-style:italic;">${esc(project.challenge)}</div>
    </div>

    <!-- DCD -->
    <div class="guide-section">
      <div class="guide-section-title">
        <span aria-hidden="true">📋</span> Destrezas con Criterio de Desempeño (DCD)
      </div>
      <div class="guide-dcd">${esc(project.dcd)}</div>
    </div>

    <!-- Cronograma -->
    <div class="guide-section">
      <div class="guide-section-title">
        <span aria-hidden="true">📅</span> Cronograma de Avances
      </div>
      <div style="border:1.5px solid var(--border);border-radius:var(--r-sm);overflow:hidden;">
        <table class="weekly-table" aria-label="Cronograma semanal del proyecto">
          <thead>
            <tr>
              <th scope="col" style="width:140px">Semana</th>
              <th scope="col">Actividad / Producto esperado</th>
            </tr>
          </thead>
          <tbody>
            ${weeksHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Rúbrica -->
    <div class="guide-section">
      <div class="guide-section-title">
        <span aria-hidden="true">📊</span> Rúbrica de Evaluación
      </div>
      <ul class="rubric-list" aria-label="Criterios de evaluación">
        ${rubricHtml}
      </ul>
    </div>

    <!-- Docentes y duración -->
    <div class="guide-section" style="border-top:1px solid var(--border-light);padding-top:1rem;">
      <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
        <div>
          <div class="card-product-label">Docentes responsables</div>
          <div style="font-size:.875rem;font-weight:600;color:var(--ink)">${esc(project.teachers)}</div>
        </div>
        <div>
          <div class="card-product-label">Duración / Recursos</div>
          <div style="font-size:.875rem;font-weight:600;color:var(--ink)">${esc(project.duration)}</div>
        </div>
        <div>
          <div class="card-product-label">Producto final</div>
          <div style="font-size:.875rem;font-weight:600;color:var(--ink)">${esc(project.product)}</div>
        </div>
      </div>
    </div>`;

  openBackdrop(guideBackdrop);
  setTimeout(() => guideModalClose.focus(), 280);
}

function closeGuideModal() { closeBackdrop(guideBackdrop); }

guideModalClose.addEventListener('click', closeGuideModal);

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — SUBIR ENTREGA
// ══════════════════════════════════════════════════════════════════════════════
function openUploadModal(preselectedId = null) {
  if (preselectedId) formProject.value = preselectedId;
  openBackdrop(uploadBackdrop);
  setTimeout(() => {
    (formProject.value ? formStudent : formProject).focus();
  }, 280);
}

function closeUploadModal() {
  closeBackdrop(uploadBackdrop);
  resetUploadForm();
}

function resetUploadForm() {
  uploadForm.reset();
  fileSelectedName.textContent = '';
  fileDropZone.classList.remove('drag-over');
  hideProgress();
  setSubmitting(false);
}

uploadModalClose.addEventListener('click', closeUploadModal);
uploadModalCancel.addEventListener('click', closeUploadModal);

$('#btn-open-upload-header').addEventListener('click', () => openUploadModal());
$('#btn-open-upload-deliverables').addEventListener('click', () => openUploadModal());

// ── Drag & drop ───────────────────────────────────────────────────────────────
fileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); fileDropZone.classList.add('drag-over'); });
fileDropZone.addEventListener('dragleave', () => fileDropZone.classList.remove('drag-over'));
fileDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  fileDropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    formFile.files = dt.files;
    showSelectedFile(file);
  }
});

formFile.addEventListener('change', () => {
  if (formFile.files[0]) showSelectedFile(formFile.files[0]);
});

function showSelectedFile(file) {
  const mb = (file.size / 1048576).toFixed(2);
  fileSelectedName.textContent = `📎 ${file.name} (${mb} MB)`;
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function showProgress() {
  uploadProgress.classList.add('visible');
  progressFill.style.width = '0%';
  let pct = 0;
  progressInterval = setInterval(() => {
    if (pct < 82) { pct += Math.random() * 9; progressFill.style.width = Math.min(pct, 82) + '%'; }
  }, 220);
}

function completeProgress() {
  clearInterval(progressInterval);
  progressFill.style.width = '100%';
  progressLabel.textContent = '¡Entrega registrada exitosamente!';
  setTimeout(hideProgress, 1100);
}

function hideProgress() {
  clearInterval(progressInterval);
  uploadProgress.classList.remove('visible');
  progressFill.style.width = '0%';
  progressLabel.textContent = 'Subiendo archivo…';
}

function setSubmitting(state) {
  isUploading = state;
  submitBtn.disabled = state;
  submitText.textContent = state ? 'Registrando…' : 'Registrar entrega';
  submitIcon.textContent = state ? '⏳' : '📤';
}

// ── Envío del formulario ──────────────────────────────────────────────────────
uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isUploading) return;

  const projectId   = formProject.value.trim();
  const studentName = formStudent.value.trim();
  const title       = formTitle.value.trim();
  const file        = formFile.files[0];

  if (!projectId)   { showToast('Seleccione un anteproyecto.', 'error'); formProject.focus(); return; }
  if (!studentName) { showToast('Ingrese el nombre del estudiante.', 'error'); formStudent.focus(); return; }
  if (!title)       { showToast('Ingrese el título de la entrega.', 'error'); formTitle.focus(); return; }
  if (!file)        { showToast('Seleccione un archivo.', 'error'); return; }
  if (file.size > 50 * 1048576) { showToast('El archivo supera el límite de 50 MB.', 'error'); return; }

  setSubmitting(true);
  showProgress();

  const fd = new FormData();
  fd.append('projectId',   projectId);
  fd.append('studentName', studentName);
  fd.append('title',       title);
  fd.append('comments',    formComments.value.trim());
  fd.append('file',        file);

  try {
    const res  = await fetch('/api/deliverables/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    completeProgress();
    allDeliverables.push(data);
    updateDeliverableStat();
    renderDeliverables();

    setTimeout(() => {
      closeUploadModal();
      showToast(`Entrega de «${studentName}» registrada correctamente.`, 'success');
    }, 700);
  } catch (err) {
    hideProgress();
    setSubmitting(false);
    showToast('Error al registrar la entrega: ' + err.message, 'error');
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — PREVISUALIZADOR DE ARCHIVOS
// ══════════════════════════════════════════════════════════════════════════════
function openPreviewModal(deliverable) {
  previewFilename.textContent = deliverable.filename;
  previewStudent.textContent  = `${deliverable.studentName} · ${deliverable.title}`;
  previewDownloadLink.href     = deliverable.filePath;
  previewDownloadLink.download = deliverable.filename;

  previewContainer.innerHTML = '';

  const type = getFileType(deliverable.filename);

  if (type === 'image') {
    const img = document.createElement('img');
    img.className = 'preview-img';
    img.src = deliverable.filePath;
    img.alt = `Visualización de ${deliverable.filename}`;
    previewContainer.appendChild(img);

  } else if (type === 'pdf') {
    const iframe = document.createElement('iframe');
    iframe.className = 'preview-iframe';
    iframe.src = deliverable.filePath;
    iframe.title = `PDF: ${deliverable.filename}`;
    iframe.setAttribute('allow', 'fullscreen');
    previewContainer.appendChild(iframe);

  } else {
    // Intenta con iframe de todas formas; algunos navegadores muestran xlsx, pptx, etc.
    // mediante descarga o vista previa nativa del SO
    previewContainer.innerHTML = `
      <div class="preview-unsupported">
        <div style="font-size:3rem;margin-bottom:.75rem">📄</div>
        <p>Este tipo de archivo no admite previsualización directa en el navegador.</p>
        <a href="${esc(deliverable.filePath)}" download="${esc(deliverable.filename)}" class="btn btn-primary btn-sm">
          ⬇ Descargar «${esc(deliverable.filename)}»
        </a>
      </div>`;
  }

  openBackdrop(previewBackdrop);
  setTimeout(() => previewModalClose.focus(), 280);
}

function closePreviewModal() {
  // Limpiar iframe para detener carga de PDF
  previewContainer.innerHTML = '';
  closeBackdrop(previewBackdrop);
}

previewModalClose.addEventListener('click', closePreviewModal);

// ══════════════════════════════════════════════════════════════════════════════
// CARGAR PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
async function loadProjects() {
  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allProjects = await res.json();
    renderProjects(filterProjects());
    populateSelects(allProjects);
  } catch (err) {
    projectsGrid.innerHTML = `
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

// ══════════════════════════════════════════════════════════════════════════════
// RENDERIZAR TARJETAS DE PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
function renderProjects(projects) {
  if (!projects.length) {
    projectsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Sin anteproyectos para este filtro</div>
        <div class="empty-sub">Seleccione otro nivel o «Todos» para ver todos los anteproyectos.</div>
      </div>`;
    return;
  }

  projectsGrid.innerHTML = projects.map(p => buildProjectCard(p)).join('');

  // Botón de guía
  $$('.card-guide-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const proj = allProjects.find(p => p.id === btn.dataset.projectId);
      if (proj) openGuideModal(proj);
    });
  });

  // Botón de subida
  $$('.card-upload-btn').forEach(btn => {
    btn.addEventListener('click', () => openUploadModal(btn.dataset.projectId));
  });
}

function buildProjectCard(p) {
  return `
    <article class="project-card" role="listitem" data-project-id="${esc(p.id)}">
      <div class="card-stripe" aria-hidden="true"></div>
      <div class="card-body">
        <div class="card-meta-row">
          <span class="badge badge-level">🏫 ${esc(p.level)}</span>
          <span class="badge badge-cost">💰 $0</span>
        </div>
        <h3 class="card-title">${esc(p.title)}</h3>
        <p class="card-subject">
          <span aria-hidden="true">📖</span>
          ${esc(p.subjects)}
        </p>
        <blockquote class="card-challenge">
          <p>${esc(p.challenge)}</p>
        </blockquote>
        <div>
          <div class="card-product-label">Producto final</div>
          <div class="card-product">🎯 ${esc(p.product)}</div>
        </div>
      </div>
      <div class="card-footer">
        <button
          class="btn btn-secondary btn-sm card-guide-btn"
          data-project-id="${esc(p.id)}"
          aria-label="Ver guía y avances de ${esc(p.title)}"
          id="guide-btn-${esc(p.id)}"
        >
          📘 Ver Guía y Avances
        </button>
        <button
          class="btn btn-primary btn-sm card-upload-btn"
          data-project-id="${esc(p.id)}"
          aria-label="Subir entrega para ${esc(p.title)}"
          id="upload-btn-${esc(p.id)}"
        >
          📤 Subir Entrega
        </button>
      </div>
    </article>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// PESTAÑAS DE FILTRO DE PROYECTOS
// ══════════════════════════════════════════════════════════════════════════════
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    $$('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    btn.classList.add('active');
    btn.setAttribute('aria-selected','true');
    renderProjects(filterProjects());
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CARGAR ENTREGAS
// ══════════════════════════════════════════════════════════════════════════════
async function loadDeliverables() {
  try {
    const res = await fetch('/api/deliverables');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allDeliverables = await res.json();
    updateDeliverableStat();
    renderDeliverables();
  } catch (err) {
    deliverablesContainer.innerHTML = `
      <div class="deliverables-table-wrapper">
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <div class="empty-title">Error al cargar las entregas</div>
          <div class="empty-sub">${esc(err.message)}</div>
        </div>
      </div>`;
    showToast('No se pudieron cargar las entregas: ' + err.message, 'error');
  }
}

function updateDeliverableStat() {
  if (statDeliverables) statDeliverables.textContent = allDeliverables.length;
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDERIZAR TABLA DE ENTREGAS
// ══════════════════════════════════════════════════════════════════════════════
function getFilteredDeliverables() {
  return allDeliverables.filter(d => {
    const matchProject = delivFilter === 'all' || d.projectId === delivFilter;
    const matchSearch  = !searchQuery ||
      d.studentName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchProject && matchSearch;
  });
}

function renderDeliverables() {
  const filtered = getFilteredDeliverables();
  deliverablesCount.textContent = `${filtered.length} entrega${filtered.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    const msg = searchQuery
      ? `No se encontraron entregas para «${esc(searchQuery)}».`
      : (delivFilter !== 'all'
          ? 'Sin entregas para este anteproyecto.'
          : 'Aún no se han registrado entregas.');
    deliverablesContainer.innerHTML = `
      <div class="deliverables-table-wrapper">
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">${msg}</div>
          <div class="empty-sub">Utilice el botón «Subir Entrega» para registrar la primera.</div>
        </div>
      </div>`;
    return;
  }

  const rows = filtered.map(d => buildDeliverableRow(d)).join('');
  deliverablesContainer.innerHTML = `
    <div class="deliverables-table-wrapper">
      <table class="deliverables-table" aria-label="Tabla de entregas de estudiantes">
        <thead>
          <tr>
            <th scope="col">Estudiante</th>
            <th scope="col">Título de entrega</th>
            <th scope="col">Anteproyecto</th>
            <th scope="col">Observaciones</th>
            <th scope="col">Tamaño</th>
            <th scope="col">Fecha</th>
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // Eventos en botones
  $$('.preview-btn', deliverablesContainer).forEach(btn => {
    btn.addEventListener('click', () => {
      const d = allDeliverables.find(x => x.id === btn.dataset.id);
      if (d) openPreviewModal(d);
    });
  });

  $$('.download-btn', deliverablesContainer).forEach(btn => {
    // Es un <a>, no necesita JS adicional
  });

  $$('.delete-btn', deliverablesContainer).forEach(btn => {
    btn.addEventListener('click', () => deleteDeliverable(btn.dataset.id, btn.dataset.title));
  });
}

function buildDeliverableRow(d) {
  const project = allProjects.find(p => p.id === d.projectId);
  const level   = project ? project.level : d.projectId;
  return `
    <tr>
      <td class="td-student">${esc(d.studentName)}</td>
      <td class="td-title" title="${esc(d.title)}">${esc(d.title)}</td>
      <td><span class="badge badge-level" style="font-size:.66rem;">${esc(level)}</span></td>
      <td class="td-comment" title="${esc(d.comments || '')}">${esc(d.comments || '—')}</td>
      <td class="td-size">${formatBytes(d.sizeBytes)}</td>
      <td class="td-date">${formatDate(d.uploadDate)}</td>
      <td class="td-actions">
        <button
          class="btn-icon-round preview preview-btn"
          data-id="${esc(d.id)}"
          title="Visualizar ${esc(d.filename)}"
          aria-label="Visualizar archivo ${esc(d.filename)}"
        >👁️</button>
        <a
          href="${esc(d.filePath)}"
          download="${esc(d.filename)}"
          class="btn-icon-round download-btn"
          title="Descargar ${esc(d.filename)}"
          aria-label="Descargar archivo ${esc(d.filename)}"
        >⬇</a>
        <button
          class="btn-icon-round danger delete-btn"
          data-id="${esc(d.id)}"
          data-title="${esc(d.title)}"
          title="Eliminar entrega"
          aria-label="Eliminar entrega ${esc(d.title)}"
        >🗑</button>
      </td>
    </tr>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// FILTRO Y BÚSQUEDA EN ENTREGAS
// ══════════════════════════════════════════════════════════════════════════════
filterDeliverables.addEventListener('change', () => {
  delivFilter = filterDeliverables.value;
  renderDeliverables();
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderDeliverables();
});

// ══════════════════════════════════════════════════════════════════════════════
// POBLAR SELECTS
// ══════════════════════════════════════════════════════════════════════════════
function populateSelects(projects) {
  const opts = projects.map(p =>
    `<option value="${esc(p.id)}">${esc(p.level)} — ${esc(p.title)}</option>`
  ).join('');

  formProject.innerHTML      = '<option value="">— Seleccione un anteproyecto —</option>' + opts;
  filterDeliverables.innerHTML = '<option value="all">Todos los anteproyectos</option>' +
    projects.map(p => `<option value="${esc(p.id)}">${esc(p.level)}</option>`).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// ELIMINAR ENTREGA
// ══════════════════════════════════════════════════════════════════════════════
async function deleteDeliverable(id, title) {
  const ok = window.confirm(
    `¿Confirma la eliminación de la entrega «${title}»?\n\nEsta acción también eliminará el archivo del servidor y no puede deshacerse.`
  );
  if (!ok) return;

  try {
    const res  = await fetch(`/api/deliverables/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

    allDeliverables = allDeliverables.filter(d => d.id !== id);
    updateDeliverableStat();
    renderDeliverables();
    showToast(`Entrega «${title}» eliminada correctamente.`, 'info');
  } catch (err) {
    showToast('Error al eliminar la entrega: ' + err.message, 'error');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ══════════════════════════════════════════════════════════════════════════════
(async function init() {
  await loadProjects();
  await loadDeliverables();
})();
