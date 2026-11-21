/**
 * DHL Arrivals Management - Frontend Application
 * Version 1.0.0
 *
 * Features:
 * - List and search arrivals
 * - View individual arrival details
 * - Manage documents/attachments
 * - Local storage persistence
 * - RESTful API integration (planned)
 */

// ===== STATE MANAGEMENT =====

let arrivals = [];
let currentView = 'list';
let selectedArrival = null;

// Initialize data from localStorage or use sample data
function initData() {
  const stored = localStorage.getItem('dhl_arrivals');
  if (stored) {
    arrivals = JSON.parse(stored);
  } else {
    arrivals = getSampleData();
    saveArrivals();
  }
}

function getSampleData() {
  return [
    {
      id: '1',
      awb: '1234567890',
      sender: 'DHL Express',
      origin: 'Paris, France',
      status: 'pending',
      arrivalDate: '2024-03-15',
      notes: 'Livraison express',
      attachments: []
    },
    {
      id: '2',
      awb: '9876543210',
      sender: 'Amazon Logistics',
      origin: 'Londres, UK',
      status: 'in-transit',
      arrivalDate: '2024-03-18',
      notes: 'Suivi en ligne',
      attachments: []
    },
    {
      id: '3',
      awb: '5556667778',
      sender: 'FedEx International',
      origin: 'Berlin, Allemagne',
      status: 'delivered',
      arrivalDate: '2024-03-20',
      notes: '',
      attachments: []
    }
  ];
}

function saveArrivals() {
  localStorage.setItem('dhl_arrivals', JSON.stringify(arrivals));
}

// ===== STATUS HELPERS =====

function getStatusLabel(status) {
  const labels = {
    'pending': 'En attente',
    'in-transit': 'En transit',
    'delivered': 'Livré'
  };
  return labels[status] || status;
}

function getStatusBadge(status) {
  return `<span class="status-badge ${status}">${getStatusLabel(status)}</span>`;
}

// ===== NAVIGATION =====

function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Show selected view
  const targetView = document.getElementById(`${viewName}-view`);
  if (targetView) {
    targetView.classList.add('active');
    currentView = viewName;
    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.dataset.view === viewName) item.classList.add('active');
    });
  }
  // If detail view, populate with selected arrival
  if (viewName === 'detail' && selectedArrival) {
    renderDetail(selectedArrival);
  } else if (viewName === 'list') {
    renderList();
  } else if (viewName === 'search') {
    document.getElementById('search-input').focus();
  }
}

// ===== LIST VIEW =====

function renderList() {
  const tbody = document.getElementById('arrivals-tbody');
  const emptyState = document.getElementById('empty-state');
  const totalCount = document.getElementById('count-total');
  const pendingCount = document.getElementById('count-pending');
  const inTransitCount = document.getElementById('count-in-transit');
  const deliveredCount = document.getElementById('count-delivered');

  // Clear tbody
  tbody.innerHTML = '';

  if (arrivals.length === 0) {
    emptyState.style.display = 'block';
    document.querySelector('.table-wrapper').style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  document.querySelector('.table-wrapper').style.display = 'block';

  // Update counts
  totalCount.textContent = arrivals.length;
  pendingCount.textContent = arrivals.filter(a => a.status === 'pending').length;
  inTransitCount.textContent = arrivals.filter(a => a.status === 'in-transit').length;
  deliveredCount.textContent = arrivals.filter(a => a.status === 'delivered').length;

  // Populate table
  arrivals.forEach(arrival => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${arrival.awb}</strong></td>
      <td>${arrival.sender}</td>
      <td>${arrival.origin}</td>
      <td>${formatDate(arrival.arrivalDate)}</td>
      <td>${getStatusBadge(arrival.status)}</td>
      <td class="action-cell">
        <button class="view-arrival-btn" onclick="viewArrival('${arrival.id}')">
          Voir ${arrival.attachments.length > 0 ? `(${arrival.attachments.length})` : ''}
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

// ===== SEARCH VIEW =====

function searchArrivals(query) {
  const resultsContainer = document.getElementById('search-results');
  const normalizedQuery = query.toLowerCase().trim();

  if (!normalizedQuery) {
    resultsContainer.style.display = 'none';
    return;
  }

  const results = arrivals.filter(a =>
    a.awb.toLowerCase().includes(normalizedQuery) ||
    a.sender.toLowerCase().includes(normalizedQuery) ||
    a.origin.toLowerCase().includes(normalizedQuery) ||
    a.status.toLowerCase().includes(normalizedQuery)
  );

  if (results.length === 0) {
    resultsContainer.innerHTML = '<div class="empty-state" style="padding:16px;">Aucun résultat trouvé</div>';
    resultsContainer.style.display = 'block';
    return;
  }

  resultsContainer.innerHTML = results.map(r =>
    `<div class="search-result-item" onclick="viewArrival('${r.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${r.awb}</strong>
          <p style="font-size:12px;color:var(--medium-gray);">${r.sender} · ${r.origin}</p>
        </div>
        ${getStatusBadge(r.status)}
      </div>
    </div>`
  ).join('');
  resultsContainer.style.display = 'block';
}

// ===== DETAIL VIEW =====

function viewArrival(id) {
  selectedArrival = arrivals.find(a => a.id === id);
  if (selectedArrival) {
    showView('detail');
  }
}

function renderDetail(arrival) {
  const detailContent = document.getElementById('detail-content');
  const backBtn = document.getElementById('back-btn');

  // Show back button
  backBtn.style.display = 'block';

  detailContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-title-row">
        <h2>${arrival.awb}</h2>
        ${getStatusBadge(arrival.status)}
      </div>
      <p class="detail-sender">Expéditeur : <strong>${arrival.sender}</strong></p>
      <p class="detail-origin">Origine : <strong>${arrival.origin}</strong></p>
    </div>

    <div class="detail-section">
      <h3>Informations de suivi</h3>
      <dl class="detail-grid">
        <div><dt>Date d'arrivage</dt><dd>${formatDate(arrival.arrivalDate)}</dd></div>
        <div><dt>Statut</dt><dd>${getStatusLabel(arrival.status)}</dd></div>
      </dl>
      ${arrival.notes ? `<p class="detail-notes"><strong>Notes :</strong> ${arrival.notes}</p>` : ''}
    </div>

    <div class="detail-section">
      <h3>Pièces jointes (${arrival.attachments.length})</h3>
      ${arrival.attachments.length === 0
        ? '<p class="muted">Aucune pièce jointe</p>'
        : `<ul class="attachments-list">
            ${arrival.attachments.map(att => `
              <li class="attachment-item" onclick="previewDocument('${att.id}', '${att.name}')">
                <div class="attachment-icon">📄</div>
                <div class="attachment-info">
                  <strong>${att.name}</strong>
                  <small>${att.size} · ${att.type}</small>
                </div>
                <button class="attachment-btn">Voir</button>
              </li>
            `).join('')}
          </ul>`
      }
    </div>

    <div class="detail-actions">
      <button class="btn-secondary" onclick="deleteArrival('${arrival.id}')">Supprimer</button>
      <button class="btn-primary" onclick="editArrival('${arrival.id}')">Modifier</button>
    </div>
  `;
}

// ===== MODALS =====

function showModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

function addArrival() {
  showModal('add-modal');
}

function deleteArrival(id) {
  if (confirm('Supprimer cet arrivage ?')) {
    arrivals = arrivals.filter(a => a.id !== id);
    saveArrivals();
    showView('list');
  }
}

function editArrival(id) {
  // TODO: Implement edit functionality
  alert('Modification à implémenter');
}

function previewDocument(attId, attName) {
  // TODO: Implement document preview
  const docModal = document.getElementById('doc-modal');
  document.getElementById('doc-title').textContent = attName;
  showModal('doc-modal');
}

// ===== FORM HANDLING =====

document.getElementById('add-form').addEventListener('submit', function(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const newArrival = {
    id: Date.now().toString(),
    awb: formData.get('awb'),
    sender: formData.get('sender'),
    origin: formData.get('origin'),
    status: formData.get('status'),
    arrivalDate: formData.get('arrivalDate'),
    notes: formData.get('notes'),
    attachments: []
  };

  arrivals.unshift(newArrival);
  saveArrivals();
  hideModal('add-modal');

  // Reset form
  e.target.reset();

  // Navigate to list
  showView('list');
  renderList();
});

// ===== DATE UTILITIES =====

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

// ===== EVENT LISTENERS =====

document.addEventListener('DOMContentLoaded', function() {
  // Initialize data
  initData();

  // Render initial list
  renderList();

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const view = this.dataset.view;
      showView(view);
    });
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchArrivals(this.value);
    }, 200);
  });

  // Search shortcut
  document.addEventListener('keydown', function(e) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'k') {
        e.preventDefault();
        showView('search');
        document.getElementById('search-input').focus();
      }
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
    }
  });

  // Modal close buttons
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', function() {
      hideModal(this.dataset.modal);
    });
  });

  // Add arrival button
  document.getElementById('add-arrival-btn').addEventListener('click', addArrival);

  // Back button
  document.getElementById('back-btn').addEventListener('click', () => showView('list'));
});

// ===== PUBLIC API (for future backend integration) =====

window.DHL = {
  getArrivals: () => [...arrivals],
  addArrival: (arrival) => {
    arrivals.unshift(arrival);
    saveArrivals();
    return true;
  },
  updateArrival: (id, data) => {
    const index = arrivals.findIndex(a => a.id === id);
    if (index !== -1) {
      arrivals[index] = { ...arrivals[index], ...data };
      saveArrivals();
      return true;
    }
    return false;
  },
  deleteArrival: (id) => {
    arrivals = arrivals.filter(a => a.id !== id);
    saveArrivals();
    return true;
  },
  searchArrivals: (query) => searchArrivals(query)
};