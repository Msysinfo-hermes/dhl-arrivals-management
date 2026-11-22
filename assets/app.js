/**
 * DHL Arrivals Management - v3.0.0
 * Maroc Systèmes Informatiques SARL
 * Modern redesign: inline column filters, dedicated pieces page, card-based UI
 */

const API_BASE = 'api.php';


// ===== FILTER STATE =====
let filterState = {
  tracking: '',
  date: '',
  status: ''
};

let debounceTimer = null;
// ===== STATE =====
let arrivals = [];
let filteredArrivals = [];
let pieces = [];
let selectedArrival = null;
let currentView = 'list';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  await loadArrivals();
  initColumnFilters();
  initPiecesPage();
  initNavigation();
});

async function loadArrivals() {
  try {
    const data = await apiFetch('?action=list');
    arrivals = data || [];
    filteredArrivals = [...arrivals];
  } catch (e) {
    console.error('API error, using fallback:', e);
    arrivals = [];
  }
  renderTable();
}

// ===== TABLE RENDERING (4 columns only) =====
function renderTable() {
  const tbody = document.getElementById('arrivals-tbody');
  const emptyState = document.getElementById('empty-state');
  const totalCount = document.getElementById('count-total');
  const pendingCount = document.getElementById('count-pending');
  const inTransitCount = document.getElementById('count-in-transit');
  const deliveredCount = document.getElementById('count-delivered');

  if (!tbody) return;

  if (filteredArrivals.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    document.querySelector('.table-wrapper').style.display = 'none';
    if (totalCount) totalCount.textContent = 0;
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  document.querySelector('.table-wrapper').style.display = 'block';

  if (totalCount) totalCount.textContent = filteredArrivals.length;
  if (pendingCount) pendingCount.textContent = filteredArrivals.filter(a => a.status === 'pending').length;
  if (inTransitCount) inTransitCount.textContent = filteredArrivals.filter(a => a.status === 'in-transit').length;
  if (deliveredCount) deliveredCount.textContent = filteredArrivals.filter(a => a.status === 'delivered').length;

  tbody.innerHTML = filteredArrivals.map(arrival => {
    const statusClass = (arrival.status || 'unknown').toLowerCase().replace(' ', '-');
    const waybill = arrival.waybill || arrival.awb || '—';
    return `
      <tr onclick="viewArrival('${arrival.id}')">
        <td data-label="AWB / Tracking"><span class="waybill-text">${escapeHtml(waybill)}</span></td>
        <td data-label="Date arrivage">${formatDate(arrival.expected_date)}</td>
        <td data-label="Statut"><span class="status-badge ${statusClass}">${escapeHtml(arrival.status || '—')}</span></td>
        <td data-label="Nombre de Pièces">${arrival.pieces_count || 0}</td>
        <td data-label="">
          <span class="action-icon" title="Voir les détails">→</span>
        </td>
      </tr>
    `;
  }).join('');

  // Render KPI status cards
  renderStatusCards();

  // Initialize filters after rendering
  initColumnFilters();
}

// ===== NEW: STATUS CARDS FUNCTION =====
function renderStatusCards() {
  const container = document.getElementById('status-cards');
  if (!container) return;
  
  const total = arrivals.length;
  const pending = arrivals.filter(a => a.status === 'pending').length;
  const inTransit = arrivals.filter(a => a.status === 'in-transit').length;
  const delivered = arrivals.filter(a => a.status === 'delivered').length;
  
  container.innerHTML = `
    <div class="status-card" onclick="showView('list')">
      <div class="status-icon pending">⏳</div>
      <div class="status-info">
        <div class="status-number">${total}</div>
        <div class="status-label">Total</div>
      </div>
    </div>
    <div class="status-card" onclick="filterByStatus('pending')">
      <div class="status-icon pending">⏳</div>
      <div class="status-info">
        <div class="status-number">${pending}</div>
        <div class="status-label">En attente</div>
      </div>
    </div>
    <div class="status-card" onclick="filterByStatus('in-transit')">
      <div class="status-icon in-transit">🚚</div>
      <div class="status-info">
        <div class="status-number">${inTransit}</div>
        <div class="status-label">En transit</div>
      </div>
    </div>
    <div class="status-card" onclick="filterByStatus('delivered')">
      <div class="status-icon delivered">✅</div>
      <div class="status-info">
        <div class="status-number">${delivered}</div>
        <div class="status-label">Livré</div>
      </div>
    </div>
  `;
}

// Add filterByStatus function
function filterByStatus(status) {
  const statusFilter = document.getElementById('filter-status');
  if (statusFilter) {
    statusFilter.value = status;
    statusFilter.dispatchEvent(new Event('change'));
  }
}

// ===== INLINE COLUMN FILTERS (real-time) =====
function initColumnFilters() {
  // Create filter row in the table header
  const thead = document.querySelector('.arrivals-table thead');
  if (!thead) return;
  
  // Remove existing filter row if any
  const existingFilterRow = document.getElementById('filter-row');
  if (existingFilterRow) existingFilterRow.remove();
  
  // Create filter row
  const filterRow = document.createElement('tr');
  filterRow.id = 'filter-row';
  filterRow.className = 'filter-row';
  
  filterRow.innerHTML = `
    <td>
      <input type="text" id="filter-tracking" class="filter-input" placeholder="Filtrer par tracking...">
    </td>
    <td>
      <input type="date" id="filter-date" class="filter-input">
    </td>
    <td>
      <select id="filter-status" class="filter-select">
        <option value="">Tous les statuts</option>
        <option value="EnStock">EnStock</option>
        <option value="payé">Payé</option>
        <option value="documents_manquants">Documents Manquants</option>
      </select>
    </td>
    <td></td>
    <td></td>
  `;
  
  // Insert filter row after the header row
  const headerRow = thead.querySelector('tr');
  headerRow.parentNode.insertBefore(filterRow, headerRow.nextSibling);
  
  // Attach event listeners with debounce
  const trackingInput = document.getElementById('filter-tracking');
  const dateInput = document.getElementById('filter-date');
  const statusSelect = document.getElementById('filter-status');
  
  let debounceTimer = null;
  
  if (trackingInput) {
    trackingInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterState.tracking = e.target.value;
        applyFilters();
      }, 300);
    });
  }
  
  if (dateInput) {
    dateInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        filterState.date = e.target.value;
        applyFilters();
      }, 300);
    });
  }
  
  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      filterState.status = e.target.value;
      applyFilters();
    });
  }
}

// ===== PIECES PAGE =====
async function initPiecesPage() {
  const searchBtn = document.getElementById('pieces-search-btn');
  const searchInput = document.getElementById('pieces-search-input');
  const resultsContainer = document.getElementById('pieces-results');

  if (!searchBtn || !searchInput || !resultsContainer) return;

  const doSearch = async () => {
    const query = searchInput.value.trim();
    if (!query) {
      resultsContainer.innerHTML = '<p class="muted">Entrez un numéro OD pour rechercher les pièces.</p>';
      return;
    }

    resultsContainer.innerHTML = '<p class="muted">Recherche en cours...</p>';

    try {
      const allPieces = await apiFetch('?action=pieces_all');
      const q = query.toLowerCase();
      const matched = (allPieces || []).filter(p =>
        (p.od_customer_frontend && p.od_customer_frontend.toLowerCase().includes(q)) ||
        (p.part_number && p.part_number.toLowerCase().includes(q))
      );

      if (matched.length === 0) {
        resultsContainer.innerHTML = `
          <div class="pieces-empty">
            <div class="empty-icon">📦</div>
            <p>Aucune pièce trouvée pour « ${escapeHtml(query)} »</p>
          </div>
        `;
        return;
      }

      // Group by waybill
      const byWaybill = {};
      matched.forEach(p => {
        if (!byWaybill[p.waybill]) byWaybill[p.waybill] = [];
        byWaybill[p.waybill].push(p);
      });

      let html = `<div class="pieces-results-header">
        <strong>${matched.length}</strong> pièce(s) trouvée(s) sur <strong>${Object.keys(byWaybill).length}</strong> arrivage(s)
      </div>`;

      Object.keys(byWaybill).sort().forEach(waybill => {
        const items = byWaybill[waybill];
        html += `
          <div class="pieces-group">
            <div class="pieces-group-header" onclick="viewArrivalByWaybill('${waybill}')">
              <span class="waybill-link">${escapeHtml(waybill)}</span>
              <span class="pieces-group-count">${items.length} pièce(s)</span>
            </div>
            <div class="pieces-group-body">
              ${items.map(p => `
                <div class="piece-card">
                  <div class="piece-card-top">
                    <span class="part-number">${escapeHtml(p.part_number || '—')}</span>
                    <span class="quantity-badge">${p.quantite || 0}×</span>
                  </div>
                  <div class="piece-description">${escapeHtml(p.description || '')}</div>
                  <div class="piece-details">
                    ${p.od_customer_frontend ? `<span>OD: ${escapeHtml(p.od_customer_frontend)}</span>` : ''}
                    ${p.order_packing_list ? `<span>Order: ${escapeHtml(p.order_packing_list)}</span>` : ''}
                    ${p.poids_kg ? `<span>Poids: ${p.poids_kg} kg</span>` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });

      resultsContainer.innerHTML = html;
    } catch (error) {
      console.error('Pieces search error:', error);
      resultsContainer.innerHTML = '<p class="error">Erreur lors de la recherche des pièces</p>';
    }
  };

  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}




// ===== APPLY FILTERS =====
function applyFilters() {
  filteredArrivals = arrivals.filter(arrival => {
    const matchesTracking = !filterState.tracking || 
      (arrival.waybill && arrival.waybill.toLowerCase().includes(filterState.tracking.toLowerCase())) ||
      (arrival.awb && arrival.awb.toLowerCase().includes(filterState.tracking.toLowerCase()));
    
    const matchesDate = !filterState.date || 
      (arrival.expected_date && arrival.expected_date.includes(filterState.date));
    
    const matchesStatus = !filterState.status || 
      (arrival.status && arrival.status.toLowerCase() === filterState.status.toLowerCase());
    
    return matchesTracking && matchesDate && matchesStatus;
  });
  
  renderTable();
}

// ===== CLEAR FILTERS =====
function clearFilters() {
  filterState = { tracking: '', date: '', status: '' };
  const trackingInput = document.getElementById('filter-tracking');
  const dateInput = document.getElementById('filter-date');
  const statusSelect = document.getElementById('filter-status');
  
  if (trackingInput) trackingInput.value = '';
  if (dateInput) dateInput.value = '';
  if (statusSelect) statusSelect.value = '';
  
  filteredArrivals = [...arrivals];
  renderTable();
}
// ===== VIEW MANAGEMENT =====
function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`${viewName}-view`);
  if (target) {
    target.classList.add('active');
    currentView = viewName;
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.view === viewName) item.classList.add('active');
  });
  if (viewName === 'list') renderTable();
  if (viewName === 'detail' && selectedArrival) renderDetail(selectedArrival);
}

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      showView(item.dataset.view);
    });
  });

  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', () => showView('list'));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }
  });
}

// ===== ARRIVAL DETAIL =====
function viewArrival(id) {
  selectedArrival = arrivals.find(a => a.id == id);
  if (selectedArrival) {
    showView('detail');
  } else {
    apiFetch(`?action=get&id=${id}`)
      .then(data => { selectedArrival = data; showView('detail'); })
      .catch(err => { console.error(err); alert('Impossible de charger cet arrivage'); });
  }
}

function viewArrivalByWaybill(waybill) {
  selectedArrival = arrivals.find(a => (a.waybill || a.awb) === waybill);
  if (selectedArrival) {
    showView('detail');
  }
}

function renderDetail(arrival) {
  const container = document.getElementById('detail-content');
  if (!container) return;

  const statusClass = (arrival.status || 'unknown').toLowerCase().replace(' ', '-');
  const waybill = arrival.waybill || arrival.awb || '—';

  container.innerHTML = `
    <div class="detail-header modern-card">
      <div class="detail-title-row">
        <h2 class="detail-waybill">${escapeHtml(waybill)}</h2>
        <span class="status-badge ${statusClass}">${escapeHtml(arrival.status || '—')}</span>
      </div>
      ${arrival.dhl_ref ? `<p class="detail-sub">Réf DHL : ${escapeHtml(arrival.dhl_ref)}</p>` : ''}
    </div>

    <div class="detail-grid modern-card">
      <div class="detail-grid-item">
        <span class="detail-label">Date d'arrivage</span>
        <span class="detail-value">${formatDate(arrival.expected_date)}</span>
      </div>
      <div class="detail-grid-item">
        <span class="detail-label">Nombre de pièces</span>
        <span class="detail-value">${arrival.pieces_count || 0}</span>
      </div>
      ${arrival.customs_taxes_duties ? `
        <div class="detail-grid-item">
          <span class="detail-label">Taxes & droits douaniers</span>
          <span class="detail-value">${arrival.customs_taxes_duties} ${escapeHtml(arrival.currency || 'MAD')}</span>
        </div>` : ''}
      ${arrival.dhl_fee ? `
        <div class="detail-grid-item">
          <span class="detail-label">Frais DHL</span>
          <span class="detail-value">${arrival.dhl_fee} ${escapeHtml(arrival.currency || 'MAD')}</span>
        </div>` : ''}
      ${arrival.storage_fee ? `
        <div class="detail-grid-item">
          <span class="detail-label">Frais de stockage</span>
          <span class="detail-value">${arrival.storage_fee} ${escapeHtml(arrival.currency || 'MAD')}</span>
        </div>` : ''}
      ${arrival.mci_fee ? `
        <div class="detail-grid-item">
          <span class="detail-label">Frais MCI</span>
          <span class="detail-value">${arrival.mci_fee} ${escapeHtml(arrival.currency || 'MAD')}</span>
        </div>` : ''}
      ${arrival.forwarding_agent_fee ? `
        <div class="detail-grid-item">
          <span class="detail-label">Frais agent forwarder</span>
          <span class="detail-value">${arrival.forwarding_agent_fee} ${escapeHtml(arrival.currency || 'MAD')}</span>
        </div>` : ''}
      ${arrival.customs_payment_date ? `
        <div class="detail-grid-item">
          <span class="detail-label">Date paiement douane</span>
          <span class="detail-value">${formatDate(arrival.customs_payment_date)}</span>
        </div>` : ''}
    </div>

    <div class="detail-section modern-card">
      <h3 class="section-title">Pièces détachées</h3>
      <div id="pieces-container" class="pieces-container">
        <p class="muted">Chargement des pièces...</p>
      </div>
    </div>

    <div class="detail-section modern-card">
      <h3 class="section-title">Historique des modifications</h3>
      <div id="history-container" class="history-container">
        <p class="muted">Chargement de l'historique...</p>
      </div>
    </div>

    <div class="detail-actions">
      <button class="btn-primary" onclick="editArrival('${arrival.id}')">Modifier</button>
    </div>
  `;

  fetchPieces(arrival.waybill || arrival.awb);
  fetchHistory(arrival.id);
}

function editArrival(id) {
  const arrival = arrivals.find(a => a.id == id);
  if (!arrival) return;

  // Show edit form (reuse add modal but pre-fill)
  const modal = document.getElementById('add-modal');
  const form = document.getElementById('add-form');
  if (!modal || !form) return;

  modal.style.display = 'flex';

  // Pre-fill fields
  const waybillField = document.getElementById('awb');
  const statusField = document.getElementById('status');
  const dateField = document.getElementById('arrival-date');

  if (waybillField) waybillField.value = arrival.waybill || arrival.awb || '';
  if (statusField) statusField.value = arrival.status || 'EnStock';
  if (dateField) dateField.value = arrival.expected_date || '';

  // Update form submit to call update instead of create
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updatedData = {
      waybill: formData.get('awb'),
      status: formData.get('status') || 'EnStock',
      expected_date: formData.get('arrivalDate') || null
    };

    try {
      await apiFetch(`?action=update&id=${id}`, {
        method: 'POST',
        body: JSON.stringify(updatedData)
      });
      await loadArrivals();
      showView('list');
      modal.style.display = 'none';
    } catch (err) {
      console.error('Update error:', err);
      alert('Erreur lors de la mise à jour');
    }
  };
}

// ===== API HELPERS =====
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaults = { headers: { 'Content-Type': 'application/json' } };
  const merged = { ...defaults, ...options };
  const response = await fetch(url, merged);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

async function fetchPieces(waybill) {
  const container = document.getElementById('pieces-container');
  if (!container) return;
  try {
    const items = await apiFetch(`?action=pieces&waybill=${waybill}`);
    renderPieces(container, items);
  } catch (e) {
    container.innerHTML = '<p class="error">Impossible de charger les pièces</p>';
  }
}

function renderPieces(container, items) {
  if (!items || items.length === 0) {
    container.innerHTML = '<p class="muted">Aucune pièce détachée répertoriée</p>';
    return;
  }
  const totalQty = items.reduce((s, p) => s + (p.quantite || 0), 0);
  container.innerHTML = `
    <div class="pieces-summary modern-chip">📦 ${items.length} type(s) — ${totalQty} pièce(s) au total</div>
    <div class="pieces-cards">
      ${items.map(p => `
        <div class="piece-card">
          <div class="piece-card-top">
            <span class="part-number">${escapeHtml(p.part_number || '—')}</span>
            <span class="quantity-badge">${p.quantite || 0}×</span>
          </div>
          <div class="piece-description">${escapeHtml(p.description || '')}</div>
          <div class="piece-details">
            ${p.od_customer_frontend ? `<span>OD: ${escapeHtml(p.od_customer_frontend)}</span>` : ''}
            ${p.order_packing_list ? `<span>Order: ${escapeHtml(p.order_packing_list)}</span>` : ''}
            ${p.box_tracking ? `<span>Box: ${escapeHtml(p.box_tracking)}</span>` : ''}
            ${p.poids_kg ? `<span>Poids: ${p.poids_kg} kg</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function fetchHistory(arrivalId) {
  const container = document.getElementById('history-container');
  if (!container) return;
  try {
    const history = await apiFetch(`?action=history&id=${arrivalId}`);
    renderHistory(container, history);
  } catch (e) {
    container.innerHTML = '<p class="error">Impossible de charger l\'historique</p>';
  }
}

function renderHistory(container, data) {
  if (!data || data.length === 0) {
    container.innerHTML = '<p class="muted">Aucun historique disponible pour cet arrivage</p>';
    return;
  }
  container.innerHTML = `
    <div class="history-timeline">
      ${data.map(item => `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-time">${formatDate(item.changed_at)}</div>
            <div class="timeline-field">${escapeHtml(item.field_name || 'Modification')}</div>
            ${item.old_value || item.new_value ? `<div class="timeline-change">
              <span class="old-val">${escapeHtml(String(item.old_value || ''))}</span>
              <span class="arrow">→</span>
              <span class="new-val">${escapeHtml(String(item.new_value || ''))}</span>
            </div>` : ''}
            <div class="timeline-meta">
              ${item.source ? `<span class="source-tag">${escapeHtml(item.source)}</span>` : ''}
              ${item.changed_by ? `<span class="by-tag">par ${escapeHtml(item.changed_by)}</span>` : ''}
            </div>
            ${item.note ? `<div class="timeline-note">${escapeHtml(item.note)}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ===== CRUD =====
async function createArrival(data) {
  try {
    const result = await apiFetch('?action=create', { method: 'POST', body: JSON.stringify(data) });
    if (result.success) { await loadArrivals(); return true; }
    return false;
  } catch (e) { console.error('Create error:', e); return false; }
}

// ===== UTILITIES =====
function formatDate(dateString) {
  if (!dateString) return 'Non défini';
  const d = new Date(dateString);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== PUBLIC API =====
window.DHL = {
  getArrivals: () => [...arrivals],
  createArrival: (d) => createArrival(d)
};