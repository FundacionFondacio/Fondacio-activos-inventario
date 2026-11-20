/**
 * FONDACIO COLOMBIA - SISTEMA DE INVENTARIO
 * Módulo de Personalización Visual, Temas y Paletas de Color en Tiempo Real
 * Sincronizado con la API /api/configuracion (FastAPI)
 */

const COLOR_PRESETS = {
  'fondacio-green': {
    name: 'Verde Fondacio & Naturaleza',
    primaryColor: '#2e7d32',
    primaryDark: '#1b5e20',
    primaryLight: '#e8f5e9',
    secondaryColor: '#1565c0',
    sidebarBg: '#0f2d18',
    appBg: '#f4f7f6',
    accentColor: '#f59e0b'
  },
  'blue-tech': {
    name: 'Azul Social & Institucional',
    primaryColor: '#1565c0',
    primaryDark: '#0d47a1',
    primaryLight: '#e3f2fd',
    secondaryColor: '#2e7d32',
    sidebarBg: '#0a192f',
    appBg: '#f0f4f8',
    accentColor: '#0284c7'
  },
  'amber-warm': {
    name: 'Ámbar Cálido & Comunitario',
    primaryColor: '#d97706',
    primaryDark: '#b45309',
    primaryLight: '#fef3c7',
    secondaryColor: '#1565c0',
    sidebarBg: '#271900',
    appBg: '#faf6f0',
    accentColor: '#e11d48'
  },
  'emerald-modern': {
    name: 'Esmeralda Moderno',
    primaryColor: '#059669',
    primaryDark: '#047857',
    primaryLight: '#d1fae5',
    secondaryColor: '#0284c7',
    sidebarBg: '#062b1e',
    appBg: '#f0fdf4',
    accentColor: '#f59e0b'
  },
  'purple-youth': {
    name: 'Púrpura Liderazgo & Juventud',
    primaryColor: '#7c3aed',
    primaryDark: '#5b21b6',
    primaryLight: '#ede9fe',
    secondaryColor: '#059669',
    sidebarBg: '#1e103a',
    appBg: '#fbf7ff',
    accentColor: '#ec4899'
  }
};

async function initCustomizerModule() {
  try {
    // Aplicar tema guardado en el servidor al cargar
    const currentConfig = await DB.getThemeConfig();
    applyCustomColorsToDOM(currentConfig);
    syncColorInputsWithConfig(currentConfig);
  } catch (e) {
    applyCustomColorsToDOM(DEFAULT_THEME_CONFIG);
  }

  // Inicializar inputs del modal de personalización y de Ajustes en página
  const colorVarPairs = [
    ['custom-primary-color', '--primary-500'],
    ['inline-primary-color', '--primary-500'],
    ['custom-dark-color', '--primary-600'],
    ['inline-dark-color', '--primary-600'],
    ['custom-sidebar-color', '--bg-sidebar'],
    ['inline-sidebar-color', '--bg-sidebar'],
    ['custom-appbg-color', '--bg-app'],
    ['inline-appbg-color', '--bg-app'],
    ['custom-accent-color', '--accent-amber'],
    ['inline-accent-color', '--accent-amber'],
  ];

  colorVarPairs.forEach(([inputId, cssVar]) => {
    const el = document.getElementById(inputId);
    if (el) {
      el.addEventListener('input', (e) => {
        document.documentElement.style.setProperty(cssVar, e.target.value);
      });
    }
  });

  // Renderizar chips de presets en el modal y en Ajustes
  renderPresetSwatches();
}

function renderPresetSwatches() {
  const html = Object.keys(COLOR_PRESETS).map(key => {
    const p = COLOR_PRESETS[key];
    return `
      <div class="preset-card" onclick="selectColorPreset('${key}')" style="cursor: pointer; border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.65rem; background: var(--bg-surface); transition: all 0.2s;">
        <div style="display: flex; gap: 4px; margin-bottom: 0.4rem;">
          <div style="width: 22px; height: 22px; border-radius: 4px; background: ${p.primaryColor};"></div>
          <div style="width: 22px; height: 22px; border-radius: 4px; background: ${p.sidebarBg};"></div>
          <div style="width: 22px; height: 22px; border-radius: 4px; background: ${p.accentColor};"></div>
          <div style="width: 22px; height: 22px; border-radius: 4px; background: ${p.appBg}; border: 1px solid #ccc;"></div>
        </div>
        <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-main);">${escapeHtml(p.name)}</div>
      </div>
    `;
  }).join('');

  ['preset-swatches-container', 'inline-preset-swatches-container'].forEach(id => {
    const container = document.getElementById(id);
    if (container) container.innerHTML = html;
  });
}

function selectColorPreset(presetKey) {
  const preset = COLOR_PRESETS[presetKey];
  if (!preset) return;

  const config = {
    preset: presetKey,
    ...preset
  };

  applyCustomColorsToDOM(config);
  syncColorInputsWithConfig(config);
}

function syncColorInputsWithConfig(config) {
  if (!config) return;
  const mappings = [
    ['custom-primary-color', 'primaryColor'],
    ['inline-primary-color', 'primaryColor'],
    ['custom-dark-color', 'primaryDark'],
    ['inline-dark-color', 'primaryDark'],
    ['custom-sidebar-color', 'sidebarBg'],
    ['inline-sidebar-color', 'sidebarBg'],
    ['custom-appbg-color', 'appBg'],
    ['inline-appbg-color', 'appBg'],
    ['custom-accent-color', 'accentColor'],
    ['inline-accent-color', 'accentColor'],
  ];
  mappings.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && config[key]) el.value = config[key];
  });
}

async function saveThemeConfigFromSettings() {
  const config = {
    primaryColor: document.getElementById('inline-primary-color')?.value || '#2e7d32',
    primaryDark: document.getElementById('inline-dark-color')?.value || '#1b5e20',
    sidebarBg: document.getElementById('inline-sidebar-color')?.value || '#0f2d18',
    appBg: document.getElementById('inline-appbg-color')?.value || '#f4f7f6',
    accentColor: document.getElementById('inline-accent-color')?.value || '#f59e0b'
  };
  try {
    await DB.saveThemeConfig(config);
    applyCustomColorsToDOM(config);
    syncColorInputsWithConfig(config);
    showToast('Tema y colores guardados globalmente.', 'success');
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetThemeToDefaults() {
  return resetDefaultColors();
}

function applyCustomColorsToDOM(config) {
  if (!config) return;

  const root = document.documentElement;
  if (config.primaryColor) {
    root.style.setProperty('--primary-500', config.primaryColor);
  }
  if (config.primaryDark) {
    root.style.setProperty('--primary-600', config.primaryDark);
  }
  if (config.sidebarBg) {
    root.style.setProperty('--bg-sidebar', config.sidebarBg);
  }
  if (config.appBg) {
    root.style.setProperty('--bg-app', config.appBg);
  }
  if (config.accentColor) {
    root.style.setProperty('--accent-amber', config.accentColor);
  }
}

async function saveCustomColors() {
  const config = {
    primaryColor: document.getElementById('custom-primary-color')?.value || '#2e7d32',
    primaryDark: document.getElementById('custom-dark-color')?.value || '#1b5e20',
    sidebarBg: document.getElementById('custom-sidebar-color')?.value || '#0f2d18',
    appBg: document.getElementById('custom-appbg-color')?.value || '#f4f7f6',
    accentColor: document.getElementById('custom-accent-color')?.value || '#f59e0b'
  };

  try {
    await DB.saveThemeConfig(config);
    applyCustomColorsToDOM(config);
    closeModal('modal-customizer');
    showToast('Paleta de colores guardada globalmente en el servidor.', 'success');
    renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function resetDefaultColors() {
  if (confirm('¿Restablecer los colores institucionales originales de Fondacio Colombia?')) {
    try {
      await DB.saveThemeConfig(DEFAULT_THEME_CONFIG);
      applyCustomColorsToDOM(DEFAULT_THEME_CONFIG);
      syncColorInputsWithConfig(DEFAULT_THEME_CONFIG);
      closeModal('modal-customizer');
      showToast('Colores restablecidos a la paleta institucional por defecto.', 'info');
      renderDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

async function openCustomizerModal() {
  try {
    const config = await DB.getThemeConfig();
    syncColorInputsWithConfig(config);
    openModal('modal-customizer');
  } catch (err) {
    openModal('modal-customizer');
  }
}
