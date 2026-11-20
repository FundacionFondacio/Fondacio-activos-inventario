/**
 * FONDACIO COLOMBIA - SISTEMA DE INVENTARIO
 * Módulo de Gestión Dinámica de Sedes y Espacios Físicos conectado a la API
 */

let currentActiveSedeId = null;

function initSedesModule() {
  const form = document.getElementById('form-sede');
  if (form) {
    form.addEventListener('submit', handleSaveSedeForm);
  }

  const formUbicacion = document.getElementById('form-ubicacion');
  if (formUbicacion) {
    formUbicacion.addEventListener('submit', handleSaveUbicacionForm);
  }

  const filterUbicacionSede = document.getElementById('filter-ubicacion-sede');
  if (filterUbicacionSede) {
    filterUbicacionSede.addEventListener('change', () => renderUbicacionesList());
  }

  // Actualizar todos los dropdowns de sedes en la app
  updateAllSedeDropdowns();

  // Listener en formulario de activos para auto-completar dirección y ubicaciones al elegir sede
  const assetSedeSelect = document.getElementById('asset-sede');
  if (assetSedeSelect) {
    assetSedeSelect.addEventListener('change', async (e) => {
      const selectedSedeName = e.target.value;
      const sedeObj = await DB.getSedeByName(selectedSedeName);
      if (sedeObj) {
        const addrField = document.getElementById('asset-address');
        if (addrField) {
          addrField.value = `${sedeObj.address || ''}${sedeObj.city ? ', ' + sedeObj.city : ''}`;
        }
      }
      await updateAssetLocationDropdown(selectedSedeName);
      suggestAssetCode();
    });
  }
}

async function updateAllSedeDropdowns() {
  try {
    const sedes = await DB.getSedes();

    // 1. Dropdown Filtro Inventario
    const filterSede = document.getElementById('filter-sede');
    if (filterSede) {
      const currentVal = filterSede.value || 'all';
      filterSede.innerHTML = '<option value="all">🏢 Todas las Sedes</option>' +
        sedes.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} (${escapeHtml(s.city || 'Fondacio')})</option>`).join('');
      filterSede.value = currentVal;
    }

    // 2. Dropdown Formulario Activo
    const assetSede = document.getElementById('asset-sede');
    if (assetSede) {
      const currentVal = assetSede.value || (sedes[0] ? sedes[0].name : '');
      assetSede.innerHTML = sedes.map(s => 
        `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} - ${escapeHtml(s.city || '')}</option>`
      ).join('');
      if (currentVal) assetSede.value = currentVal;
    }

    // 3. Dropdown Formulario Préstamo
    const loanSede = document.getElementById('loan-sede');
    if (loanSede) {
      const currentVal = loanSede.value || (sedes[0] ? sedes[0].name : '');
      loanSede.innerHTML = sedes.map(s => 
        `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`
      ).join('');
      if (currentVal) loanSede.value = currentVal;
    }

    // 4. Dropdowns de Ubicaciones (filtro y modal)
    const filterUbicacionSede = document.getElementById('filter-ubicacion-sede');
    if (filterUbicacionSede) {
      const currentVal = filterUbicacionSede.value || 'all';
      filterUbicacionSede.innerHTML = '<option value="all">🏢 Todas las Sedes</option>' +
        sedes.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('');
      filterUbicacionSede.value = currentVal;
    }

    const ubicacionSede = document.getElementById('ubicacion-sede');
    if (ubicacionSede) {
      const currentVal = ubicacionSede.value || (sedes[0] ? sedes[0].name : '');
      ubicacionSede.innerHTML = sedes.map(s =>
        `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)} - ${escapeHtml(s.city || '')}</option>`
      ).join('');
      if (currentVal) ubicacionSede.value = currentVal;
    }

    // 5. Sidebar Pills
    renderSidebarSedePills(sedes);
  } catch (err) {
    console.error('Error al actualizar dropdowns de sedes:', err);
  }
}

function renderSidebarSedePills(sedesList) {
  const container = document.getElementById('sidebar-sedes-pills');
  if (!container) return;

  const sedes = sedesList || [];
  container.innerHTML = sedes.map(s => `
    <span class="sede-pill" title="${escapeHtml(s.address || s.name)}">
      <span class="dot" style="background-color: ${s.color || '#4caf50'};"></span>
      ${escapeHtml(s.name)}
    </span>
  `).join('');
}

async function renderSedesList() {
  const container = document.getElementById('sedes-cards-container');
  if (!container) return;

  try {
    const [sedes, stats, loans] = await Promise.all([
      DB.getSedes(),
      DB.getDashboardStats().catch(() => ({ bySede: {} })),
      DB.getLoans('activo').catch(() => [])
    ]);

    container.innerHTML = sedes.map(sede => {
      const assetCount = (stats && stats.bySede && stats.bySede[sede.name]) ? stats.bySede[sede.name] : 0;
      const activeLoansCount = loans.filter(l => l.sede === sede.name).length;

      return `
        <div class="card-panel sede-detail-card" style="border-top: 4px solid ${sede.color || 'var(--primary-500)'};">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="dot" style="background-color: ${sede.color || '#4caf50'}; width: 10px; height: 10px;"></span>
                <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--text-main); margin: 0;">${escapeHtml(sede.name)}</h3>
              </div>
              <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">${escapeHtml(sede.fullName || sede.name)}</p>
            </div>
            <span class="asset-code-badge">${escapeHtml(sede.code || 'SEDE')}</span>
          </div>

          <div class="sede-location-box">
            <div style="display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.85rem; color: var(--text-main);">
              <i data-lucide="map-pin" style="width: 16px; height: 16px; color: ${sede.color || 'var(--primary-500)'}; flex-shrink: 0; margin-top: 3px;"></i>
              <div>
                <strong>${escapeHtml(sede.address || 'Sin dirección registrada')}</strong>
                <div style="font-size: 0.75rem; color: var(--text-secondary);">${escapeHtml(sede.city || 'Bogotá D.C.')}</div>
              </div>
            </div>

            ${sede.phone || sede.email ? `
              <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-secondary); flex-wrap: wrap;">
                ${sede.phone ? `<span>📞 ${escapeHtml(sede.phone)}</span>` : ''}
                ${sede.email ? `<span>✉️ ${escapeHtml(sede.email)}</span>` : ''}
              </div>
            ` : ''}
          </div>

          <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.75rem 0; line-height: 1.4;">
            ${escapeHtml(sede.focus || 'Espacio formativo y comunitario de Fondacio Colombia.')}
          </p>

          <div style="background: var(--bg-app); border-radius: var(--radius-sm); padding: 0.6rem 0.85rem; display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 1rem;">
            <span>Equipos registrados: <strong>${assetCount}</strong></span>
            <span>Préstamos activos: <strong>${activeLoansCount}</strong></span>
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
            <button class="btn btn-sm btn-secondary" onclick="filterBySedeAndGo('${escapeHtml(sede.name)}')">
              <i data-lucide="list"></i> Ver Equipos
            </button>
            <div class="action-btns-group">
              <button class="icon-button admin-only" data-admin-only onclick="openEditSedeModal('${sede.id}')" title="Editar Sede">
                <i data-lucide="edit-3"></i>
              </button>
              <button class="icon-button admin-only" data-admin-only onclick="confirmDeleteSede('${sede.id}')" title="Eliminar Sede" style="color: var(--accent-rose);">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
    await renderUbicacionesList();
  } catch (err) {
    console.error('Error al renderizar sedes:', err);
    showToast('Error al cargar sedes: ' + err.message, 'error');
  }
}

function openNewSedeModal() {
  currentActiveSedeId = null;
  const form = document.getElementById('form-sede');
  if (form) form.reset();

  document.getElementById('modal-sede-title').textContent = 'Registrar Nueva Sede / Espacio Físico';
  document.getElementById('sede-id').value = '';
  document.getElementById('sede-color').value = '#2e7d32';

  openModal('modal-sede-form');
  if (typeof populateCustomFieldsInModal === 'function') {
    populateCustomFieldsInModal('modal-sede-form', {});
  }
}

async function openEditSedeModal(id) {
  try {
    const sede = await DB.getSedeById(id);
    if (!sede) return;

    currentActiveSedeId = id;
    document.getElementById('modal-sede-title').textContent = `Editar Sede: ${sede.name}`;

    document.getElementById('sede-id').value = sede.id;
    document.getElementById('sede-name').value = sede.name || '';
    document.getElementById('sede-fullname').value = sede.fullName || '';
    document.getElementById('sede-code').value = sede.code || '';
    document.getElementById('sede-address').value = sede.address || '';
    document.getElementById('sede-city').value = sede.city || '';
    document.getElementById('sede-phone').value = sede.phone || '';
    document.getElementById('sede-email').value = sede.email || '';
    document.getElementById('sede-color').value = sede.color || '#2e7d32';
    document.getElementById('sede-focus').value = sede.focus || '';

    openModal('modal-sede-form');
    if (typeof populateCustomFieldsInModal === 'function') {
      populateCustomFieldsInModal('modal-sede-form', sede.customFields || {});
    }
  } catch (err) {
    showToast('Error al cargar datos de la sede: ' + err.message, 'error');
  }
}

async function handleSaveSedeForm(e) {
  e.preventDefault();

  const id = document.getElementById('sede-id').value;
  const sedeData = {
    id: id || undefined,
    name: document.getElementById('sede-name').value.trim(),
    fullName: document.getElementById('sede-fullname').value.trim(),
    code: document.getElementById('sede-code').value.trim().toUpperCase(),
    address: document.getElementById('sede-address').value.trim(),
    city: document.getElementById('sede-city').value.trim(),
    phone: document.getElementById('sede-phone').value.trim(),
    email: document.getElementById('sede-email').value.trim(),
    color: document.getElementById('sede-color').value,
    focus: document.getElementById('sede-focus').value.trim(),
    customFields: typeof collectCustomFieldsFromModal === 'function' ? collectCustomFieldsFromModal('modal-sede-form') : {}
  };

  if (!sedeData.name) {
    showToast('Por favor diligencia el nombre de la sede.', 'error');
    return;
  }

  try {
    await DB.saveSede(sedeData);
    closeModal('modal-sede-form');
    showToast(id ? 'Sede actualizada exitosamente.' : 'Nueva sede registrada en Fondacio Colombia.', 'success');

    await updateAllSedeDropdowns();
    await renderSedesList();
    await renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDeleteSede(id) {
  try {
    const sede = await DB.getSedeById(id);
    if (!sede) return;

    if (!confirm(`¿Deseas eliminar la sede "${sede.name}"?`)) {
      return;
    }

    await DB.deleteSede(id);
    showToast('Sede eliminada del sistema.', 'info');
    await updateAllSedeDropdowns();
    await renderSedesList();
    await renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- GESTIÓN DE UBICACIONES POR SEDE ---
async function updateAssetLocationDropdown(sedeName, selectedLocationId = null, selectedLocationText = '') {
  const select = document.getElementById('asset-location');
  if (!select) return;

  let ubicaciones = [];
  if (sedeName) {
    try {
      ubicaciones = await DB.getUbicaciones(sedeName, true);
    } catch (err) {
      console.error('Error al cargar ubicaciones de la sede:', err);
    }
  }

  let optionsHtml = '<option value="">Sin ubicación específica</option>' +
    ubicaciones.map(u =>
      `<option value="${escapeHtml(u.name)}" data-location-id="${escapeHtml(u.id)}">${escapeHtml(u.name)}</option>`
    ).join('');

  let matchedValue = '';
  if (selectedLocationId) {
    const byId = ubicaciones.find(u => u.id === selectedLocationId);
    if (byId) matchedValue = byId.name;
  }
  if (!matchedValue && selectedLocationText) {
    const byName = ubicaciones.find(u => u.name.toLowerCase() === selectedLocationText.toLowerCase());
    if (byName) {
      matchedValue = byName.name;
    } else {
      optionsHtml += `<option value="${escapeHtml(selectedLocationText)}" data-location-id="${escapeHtml(selectedLocationId || '')}">${escapeHtml(selectedLocationText)} (Actual)</option>`;
      matchedValue = selectedLocationText;
    }
  }

  select.innerHTML = optionsHtml;
  select.value = matchedValue;
}

async function renderUbicacionesList() {
  const container = document.getElementById('ubicaciones-cards-container');
  if (!container) return;

  const filterEl = document.getElementById('filter-ubicacion-sede');
  const sedeFilter = filterEl ? filterEl.value : 'all';

  try {
    const ubicaciones = await DB.getUbicaciones(sedeFilter);
    if (!ubicaciones.length) {
      container.innerHTML = `
        <div class="card-panel" style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
          <p style="margin: 0; font-size: 0.9rem;">No hay ubicaciones registradas${sedeFilter !== 'all' ? ` para la sede <strong>${escapeHtml(sedeFilter)}</strong>` : ''}.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = ubicaciones.map(u => `
      <div class="card-panel" style="display: flex; flex-direction: column; justify-content: space-between; gap: 0.65rem;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
            <h4 style="margin: 0; font-size: 1rem; font-weight: 700; color: var(--text-main);">
              <i data-lucide="map-pin" style="width: 15px; height: 15px; vertical-align: -2px; color: var(--primary-500);"></i>
              ${escapeHtml(u.name)}
            </h4>
            <span class="badge ${u.active ? 'badge-success' : 'badge-secondary'}" style="font-size: 0.7rem;">
              ${u.active ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div style="font-size: 0.78rem; color: var(--primary-600, #0284c7); font-weight: 600; margin-top: 0.25rem;">
            Sede: ${escapeHtml(u.sede)}
          </div>
          ${u.description ? `<p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.5rem 0 0; line-height: 1.4;">${escapeHtml(u.description)}</p>` : ''}
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.35rem; border-top: 1px solid var(--border-subtle); padding-top: 0.6rem;">
          <button class="icon-button admin-only" data-admin-only onclick="openEditUbicacionModal('${u.id}')" title="Editar Ubicación">
            <i data-lucide="edit-3"></i>
          </button>
          <button class="icon-button admin-only" data-admin-only onclick="confirmDeleteUbicacion('${u.id}')" title="Eliminar Ubicación" style="color: var(--accent-rose);">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('Error al renderizar ubicaciones:', err);
    showToast('Error al cargar ubicaciones: ' + err.message, 'error');
  }
}

async function openNewUbicacionModal(preselectedSede = null) {
  await updateAllSedeDropdowns();
  const form = document.getElementById('form-ubicacion');
  if (form) form.reset();

  document.getElementById('modal-ubicacion-title').textContent = 'Registrar Nueva Ubicación';
  document.getElementById('ubicacion-id').value = '';
  document.getElementById('ubicacion-active').checked = true;

  const sedeSelect = document.getElementById('ubicacion-sede');
  if (sedeSelect && preselectedSede) {
    sedeSelect.value = preselectedSede;
  } else if (sedeSelect) {
    const filterEl = document.getElementById('filter-ubicacion-sede');
    if (filterEl && filterEl.value && filterEl.value !== 'all') {
      sedeSelect.value = filterEl.value;
    }
  }

  openModal('modal-ubicacion-form');
}

async function openEditUbicacionModal(id) {
  try {
    await updateAllSedeDropdowns();
    const u = await DB.getUbicacionById(id);
    if (!u) return;

    document.getElementById('modal-ubicacion-title').textContent = `Editar Ubicación: ${u.name}`;
    document.getElementById('ubicacion-id').value = u.id;
    document.getElementById('ubicacion-sede').value = u.sede || '';
    document.getElementById('ubicacion-name').value = u.name || '';
    document.getElementById('ubicacion-description').value = u.description || '';
    document.getElementById('ubicacion-active').checked = u.active !== false;

    openModal('modal-ubicacion-form');
  } catch (err) {
    showToast('Error al cargar datos de la ubicación: ' + err.message, 'error');
  }
}

async function handleSaveUbicacionForm(e) {
  e.preventDefault();

  const id = document.getElementById('ubicacion-id').value;
  const ubicacionData = {
    id: id || undefined,
    sede: document.getElementById('ubicacion-sede').value,
    name: document.getElementById('ubicacion-name').value.trim(),
    description: document.getElementById('ubicacion-description').value.trim(),
    active: document.getElementById('ubicacion-active').checked
  };

  if (!ubicacionData.sede || !ubicacionData.name) {
    showToast('Selecciona la sede e ingresa el nombre de la ubicación.', 'error');
    return;
  }

  try {
    await DB.saveUbicacion(ubicacionData);
    closeModal('modal-ubicacion-form');
    showToast(id ? 'Ubicación actualizada exitosamente.' : 'Nueva ubicación registrada.', 'success');
    await renderUbicacionesList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmDeleteUbicacion(id) {
  try {
    const u = await DB.getUbicacionById(id);
    if (!u) return;

    if (!confirm(`¿Deseas eliminar la ubicación "${u.name}" de la sede "${u.sede}"?`)) {
      return;
    }

    await DB.deleteUbicacion(id);
    showToast('Ubicación eliminada del sistema.', 'info');
    await renderUbicacionesList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
