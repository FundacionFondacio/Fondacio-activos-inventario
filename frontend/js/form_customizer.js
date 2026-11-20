/**
 * FONDACIO COLOMBIA - EDITOR Y MOTOR DE FORMULARIOS DINÁMICOS
 * Permite en Ajustes: mostrar/ocultar campos, marcar obligatorios, editar etiquetas y listas,
 * reordenar campos y agregar/eliminar campos personalizados en todos los formularios.
 * Sincronizado con /api/configuracion (formSchemas).
 */

const FORM_DEFINITIONS = {
  equipos: { name: 'Equipos / Computadores', modalId: 'modal-asset-form' },
  donaciones: { name: 'Donaciones', modalId: 'modal-donation-form' },
  compras: { name: 'Compras', modalId: 'modal-donation-form' },
  prestamos: { name: 'Préstamos', modalId: 'modal-loan-form' },
  mantenimientos: { name: 'Mantenimientos', modalId: 'modal-maintenance-form' },
  sedes: { name: 'Sedes', modalId: 'modal-sede-form' },
};

let cachedFormSchemas = {};
let activeBuilderFormKey = 'equipos';
const originalFieldSnapshots = {};

function getActiveFormKeyForModal(modalId) {
  if (modalId === 'modal-donation-form') {
    return (typeof currentIngresoTipo !== 'undefined' && currentIngresoTipo === 'compra')
      ? 'compras'
      : 'donaciones';
  }
  return Object.keys(FORM_DEFINITIONS).find(k => FORM_DEFINITIONS[k].modalId === modalId) || null;
}

function captureModalFieldSnapshot(modalId) {
  if (originalFieldSnapshots[modalId]) return originalFieldSnapshots[modalId];
  const modal = document.getElementById(modalId);
  if (!modal) return [];
  const fields = [];
  const groups = modal.querySelectorAll('.form-grid .form-group');
  groups.forEach((group, idx) => {
    const input = group.querySelector('input:not([type="hidden"]):not([type="file"]), select, textarea');
    if (!input || !input.id) return;
    const labelEl = group.querySelector(`label[for="${input.id}"]`) || group.querySelector('label');
    const rawLabel = labelEl ? labelEl.textContent.replace(/\*/g, '').trim() : input.id;
    const isSelect = input.tagName === 'SELECT';
    const options = isSelect
      ? Array.from(input.options).map(o => ({ value: o.value, label: o.textContent.trim() }))
      : [];
    fields.push({
      id: input.id,
      label: rawLabel,
      originalLabel: rawLabel,
      type: isSelect ? 'select' : (input.tagName === 'TEXTAREA' ? 'textarea' : (input.type || 'text')),
      required: input.hasAttribute('required'),
      visible: true,
      order: idx,
      isCustom: false,
      options,
      hasStaticOptions: isSelect && !['asset-sede', 'asset-ubicacion-id', 'donation-donor', 'donation-sede', 'loan-asset', 'loan-sede', 'maint-asset'].includes(input.id),
    });
  });
  originalFieldSnapshots[modalId] = fields;
  return fields;
}

function getMergedFormSchema(formKey) {
  const def = FORM_DEFINITIONS[formKey];
  if (!def) return [];
  const baseFields = captureModalFieldSnapshot(def.modalId).map(f => ({
    ...f,
    options: f.options ? f.options.map(o => ({ ...o })) : [],
  }));
  const saved = Array.isArray(cachedFormSchemas[formKey]) ? cachedFormSchemas[formKey] : [];
  if (saved.length === 0) return baseFields;

  const savedById = new Map(saved.map(f => [f.id, f]));
  const merged = baseFields.map(base => {
    const ov = savedById.get(base.id);
    if (!ov) return base;
    return {
      ...base,
      label: ov.label || base.label,
      required: typeof ov.required === 'boolean' ? ov.required : base.required,
      visible: typeof ov.visible === 'boolean' ? ov.visible : base.visible,
      order: typeof ov.order === 'number' ? ov.order : base.order,
      options: (base.hasStaticOptions && Array.isArray(ov.options) && ov.options.length)
        ? ov.options
        : base.options,
    };
  });

  saved.filter(f => f.isCustom).forEach(cf => {
    merged.push({
      id: cf.id,
      label: cf.label || cf.id,
      type: cf.type || 'text',
      required: !!cf.required,
      visible: cf.visible !== false,
      order: typeof cf.order === 'number' ? cf.order : merged.length,
      isCustom: true,
      options: Array.isArray(cf.options) ? cf.options : [],
    });
  });

  merged.sort((a, b) => a.order - b.order);
  return merged.map((f, idx) => ({ ...f, order: idx }));
}

async function initFormCustomizerModule() {
  try {
    cachedFormSchemas = await DB.getFormSchemas();
  } catch (e) {
    cachedFormSchemas = {};
  }
  Object.values(FORM_DEFINITIONS).forEach(d => captureModalFieldSnapshot(d.modalId));

  const selector = document.getElementById('form-builder-select');
  if (selector) {
    selector.addEventListener('change', (e) => {
      activeBuilderFormKey = e.target.value;
      renderFormBuilderList();
    });
  }

  const addForm = document.getElementById('form-builder-add-field');
  if (addForm) {
    addForm.addEventListener('submit', handleAddCustomFormField);
  }

  const newTypeSelect = document.getElementById('new-custom-field-type');
  if (newTypeSelect) {
    newTypeSelect.addEventListener('change', () => {
      const optsWrap = document.getElementById('new-custom-field-options-wrap');
      if (optsWrap) optsWrap.style.display = newTypeSelect.value === 'select' ? 'block' : 'none';
    });
  }

  renderFormBuilderList();
}

function renderFormBuilderList() {
  const container = document.getElementById('form-builder-fields-list');
  if (!container) return;
  const fields = getMergedFormSchema(activeBuilderFormKey);

  container.innerHTML = fields.map((f, idx) => `
    <div class="form-builder-row" data-field-id="${escapeHtml(f.id)}" style="display: grid; grid-template-columns: 1.5fr 1fr auto auto auto; gap: 0.65rem; align-items: center; padding: 0.65rem 0.75rem; border: 1px solid var(--border-subtle); border-radius: 8px; background: var(--bg-surface);">
      <div>
        <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">
          <span class="badge" style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: ${f.isCustom ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.12)'}; color: ${f.isCustom ? '#2563eb' : 'var(--text-secondary)'};">
            ${f.isCustom ? 'Personalizado' : 'Sistema'} · ${escapeHtml(f.type)}
          </span>
        </div>
        <input type="text" class="form-control fb-field-label" value="${escapeHtml(f.label)}" placeholder="Etiqueta del campo" style="font-size: 0.84rem; padding: 0.35rem 0.55rem;" />
      </div>

      <div>
        ${(f.type === 'select' && (f.isCustom || f.hasStaticOptions)) ? `
          <label style="font-size: 0.7rem; color: var(--text-secondary); display: block;">Opciones (separadas por coma)</label>
          <input type="text" class="form-control fb-field-options" value="${escapeHtml((f.options || []).map(o => typeof o === 'string' ? o : (o.label || o.value)).join(', '))}" style="font-size: 0.8rem; padding: 0.35rem 0.55rem;" />
        ` : `<span style="font-size: 0.75rem; color: var(--text-muted);">ID: <code>${escapeHtml(f.id)}</code></span>`}
      </div>

      <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" class="fb-field-visible" ${f.visible ? 'checked' : ''} />
        <span>Visible</span>
      </label>

      <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; cursor: pointer;">
        <input type="checkbox" class="fb-field-required" ${f.required ? 'checked' : ''} />
        <span>Obligatorio</span>
      </label>

      <div style="display: flex; gap: 0.25rem;">
        <button type="button" class="icon-button" onclick="moveBuilderField(${idx}, -1)" title="Subir" ${idx === 0 ? 'disabled' : ''}>
          <i data-lucide="arrow-up"></i>
        </button>
        <button type="button" class="icon-button" onclick="moveBuilderField(${idx}, 1)" title="Bajar" ${idx === fields.length - 1 ? 'disabled' : ''}>
          <i data-lucide="arrow-down"></i>
        </button>
        ${f.isCustom ? `
          <button type="button" class="icon-button delete" onclick="deleteBuilderField('${escapeHtml(f.id)}')" title="Eliminar campo">
            <i data-lucide="trash-2"></i>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function readBuilderFieldsFromDOM() {
  const current = getMergedFormSchema(activeBuilderFormKey);
  const byId = new Map(current.map(f => [f.id, f]));
  const rows = document.querySelectorAll('#form-builder-fields-list .form-builder-row');
  const updated = [];
  rows.forEach((row, idx) => {
    const id = row.getAttribute('data-field-id');
    const base = byId.get(id);
    if (!base) return;
    const label = row.querySelector('.fb-field-label')?.value.trim() || base.label;
    const visible = !!row.querySelector('.fb-field-visible')?.checked;
    const required = !!row.querySelector('.fb-field-required')?.checked;
    const optInput = row.querySelector('.fb-field-options');
    let options = base.options || [];
    if (optInput) {
      options = optInput.value
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => ({ value: s, label: s }));
    }
    updated.push({ ...base, label, visible, required, order: idx, options });
  });
  return updated;
}

function moveBuilderField(index, delta) {
  const fields = readBuilderFieldsFromDOM();
  const target = index + delta;
  if (target < 0 || target >= fields.length) return;
  const [moved] = fields.splice(index, 1);
  fields.splice(target, 0, moved);
  cachedFormSchemas[activeBuilderFormKey] = fields.map((f, i) => ({ ...f, order: i }));
  renderFormBuilderList();
}

function deleteBuilderField(fieldId) {
  const fields = readBuilderFieldsFromDOM().filter(f => f.id !== fieldId);
  cachedFormSchemas[activeBuilderFormKey] = fields.map((f, i) => ({ ...f, order: i }));
  renderFormBuilderList();
}

function handleAddCustomFormField(e) {
  e.preventDefault();
  const labelEl = document.getElementById('new-custom-field-label');
  const typeEl = document.getElementById('new-custom-field-type');
  const optsEl = document.getElementById('new-custom-field-options');
  const reqEl = document.getElementById('new-custom-field-required');

  const label = labelEl?.value.trim();
  if (!label) return;

  const slug = label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'campo';
  const id = `custom_${slug}_${Date.now().toString(36).slice(-4)}`;
  const type = typeEl?.value || 'text';
  const options = type === 'select'
    ? (optsEl?.value || '').split(',').map(s => s.trim()).filter(Boolean).map(s => ({ value: s, label: s }))
    : [];

  const fields = readBuilderFieldsFromDOM();
  fields.push({
    id,
    label,
    type,
    required: !!reqEl?.checked,
    visible: true,
    order: fields.length,
    isCustom: true,
    options,
  });

  cachedFormSchemas[activeBuilderFormKey] = fields;
  e.target.reset();
  const optsWrap = document.getElementById('new-custom-field-options-wrap');
  if (optsWrap) optsWrap.style.display = 'none';
  renderFormBuilderList();
}

async function saveCurrentFormBuilderSchema() {
  const fields = readBuilderFieldsFromDOM();
  cachedFormSchemas[activeBuilderFormKey] = fields;
  try {
    cachedFormSchemas = await DB.saveFormSchemas({ [activeBuilderFormKey]: fields });
    showToast(`Diseño de "${FORM_DEFINITIONS[activeBuilderFormKey].name}" guardado.`, 'success');
  } catch (err) {
    showToast('Error al guardar diseño de formulario: ' + err.message, 'error');
  }
}

async function resetCurrentFormBuilderSchema() {
  delete cachedFormSchemas[activeBuilderFormKey];
  try {
    cachedFormSchemas = await DB.saveFormSchemas({ [activeBuilderFormKey]: [] });
    renderFormBuilderList();
    showToast('Formulario restaurado a sus campos por defecto.', 'info');
  } catch (err) {
    showToast('Error al restaurar formulario: ' + err.message, 'error');
  }
}

function applyFormSchemaToModal(modalId) {
  const formKey = getActiveFormKeyForModal(modalId);
  if (!formKey) return;
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const schema = getMergedFormSchema(formKey);
  const grid = modal.querySelector('.form-grid');
  if (!grid) return;

  // Aplicar configuración a los campos existentes del sistema
  schema.filter(f => !f.isCustom).forEach(f => {
    const input = modal.querySelector(`#${CSS.escape(f.id)}`);
    if (!input) return;
    const group = input.closest('.form-group');
    if (group) {
      group.style.display = f.visible ? '' : 'none';
      group.style.order = String(f.order);
      const labelEl = group.querySelector(`label[for="${f.id}"]`) || group.querySelector('label');
      if (labelEl) {
        labelEl.innerHTML = `${escapeHtml(f.label)}${f.required ? ' <span class="required">*</span>' : ''}`;
      }
    }
    if (f.visible && f.required) input.setAttribute('required', 'required');
    else input.removeAttribute('required');

    if (f.hasStaticOptions && Array.isArray(f.options) && f.options.length > 0 && input.tagName === 'SELECT') {
      const currentVal = input.value;
      input.innerHTML = f.options
        .map(o => `<option value="${escapeHtml(o.value ?? o)}">${escapeHtml(o.label ?? o)}</option>`)
        .join('');
      if (Array.from(input.options).some(o => o.value === currentVal)) {
        input.value = currentVal;
      }
    }
  });

  // Renderizar campos personalizados al final del grid
  let customContainer = modal.querySelector('.custom-fields-dynamic-container');
  if (!customContainer) {
    customContainer = document.createElement('div');
    customContainer.className = 'custom-fields-dynamic-container col-span-2';
    customContainer.style.cssText = 'grid-column: span 2; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; order: 999;';
    grid.appendChild(customContainer);
  }

  const customFields = schema.filter(f => f.isCustom && f.visible);
  if (customFields.length === 0) {
    customContainer.style.display = 'none';
    customContainer.innerHTML = '';
    return;
  }

  customContainer.style.display = 'grid';
  customContainer.innerHTML = `
    <div class="form-section-banner" style="grid-column: span 2; margin-top: 0.25rem;">CAMPOS PERSONALIZADOS</div>
    ${customFields.map(f => {
      const reqAttr = f.required ? 'required' : '';
      const reqStar = f.required ? ' <span class="required">*</span>' : '';
      if (f.type === 'select') {
        const opts = (f.options || []).map(o => {
          const val = o.value ?? o;
          const lbl = o.label ?? o;
          return `<option value="${escapeHtml(val)}">${escapeHtml(lbl)}</option>`;
        }).join('');
        return `
          <div class="form-group">
            <label for="cf-${escapeHtml(f.id)}">${escapeHtml(f.label)}${reqStar}</label>
            <select id="cf-${escapeHtml(f.id)}" data-custom-field="${escapeHtml(f.id)}" class="form-control custom-dynamic-input" ${reqAttr}>
              <option value="">Selecciona...</option>
              ${opts}
            </select>
          </div>
        `;
      }
      if (f.type === 'textarea') {
        return `
          <div class="form-group" style="grid-column: span 2;">
            <label for="cf-${escapeHtml(f.id)}">${escapeHtml(f.label)}${reqStar}</label>
            <textarea id="cf-${escapeHtml(f.id)}" data-custom-field="${escapeHtml(f.id)}" class="form-control custom-dynamic-input" rows="2" ${reqAttr}></textarea>
          </div>
        `;
      }
      if (f.type === 'checkbox') {
        return `
          <div class="form-group" style="justify-content: center;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="cf-${escapeHtml(f.id)}" data-custom-field="${escapeHtml(f.id)}" class="custom-dynamic-input" ${reqAttr} />
              <span>${escapeHtml(f.label)}${reqStar}</span>
            </label>
          </div>
        `;
      }
      return `
        <div class="form-group">
          <label for="cf-${escapeHtml(f.id)}">${escapeHtml(f.label)}${reqStar}</label>
          <input type="${escapeHtml(f.type || 'text')}" id="cf-${escapeHtml(f.id)}" data-custom-field="${escapeHtml(f.id)}" class="form-control custom-dynamic-input" ${reqAttr} />
        </div>
      `;
    }).join('')}
  `;
}

function collectCustomFieldsFromModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return {};
  const result = {};
  modal.querySelectorAll('.custom-dynamic-input').forEach(el => {
    const key = el.getAttribute('data-custom-field');
    if (!key) return;
    result[key] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return result;
}

function populateCustomFieldsInModal(modalId, values = {}) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.querySelectorAll('.custom-dynamic-input').forEach(el => {
    const key = el.getAttribute('data-custom-field');
    if (!key) return;
    const val = values ? values[key] : undefined;
    if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = val !== undefined && val !== null ? String(val) : '';
  });
}
