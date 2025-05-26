// Variables globales
let appointments = [];
let currentAppointment = null;
let filteredAppointments = [];

// Elementos DOM - Corregidos para que coincidan con el HTML
const appointmentsList = document.getElementById('appointments-list');
const dateFromInput = document.getElementById('appointment-date-from'); // Corregido
const dateToInput = document.getElementById('appointment-date-to'); // Corregido
const statusFilter = document.getElementById('appointment-status-filter'); // Corregido
const applyFiltersBtn = document.getElementById('appointment-apply-filters'); // Corregido
const appointmentDetailsModal = document.getElementById('appointment-details-modal');
const appointmentDetails = document.getElementById('appointment-details');

// Inicializar fechas por defecto
const today = new Date();
const oneWeekAgo = new Date(today);
oneWeekAgo.setDate(today.getDate() - 7);

// Formatear fecha para input date
function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Cargar citas - Ahora usa la función centralizada de api.js
async function loadAppointments() {
  try {
    showLoader();
    
    // Inicializar fechas por defecto si no están establecidas
    if (dateFromInput && !dateFromInput.value) {
      dateFromInput.value = formatDateForInput(oneWeekAgo);
    }
    if (dateToInput && !dateToInput.value) {
      dateToInput.value = formatDateForInput(today);
    }
    
    // Usar función centralizada de api.js
    appointments = await getAppointments();
    filterAppointments();
    renderAppointments();
    
    hideLoader();
  } catch (error) {
    console.error('Error al cargar citas:', error);
    if (typeof showError === 'function') {
      showError('Error al cargar citas: ' + error.message);
    }
    hideLoader();
  }
}

// Filtrar citas según criterios
function filterAppointments() {
  const dateFrom = dateFromInput.value ? new Date(dateFromInput.value) : null;
  const dateTo = dateToInput.value ? new Date(dateToInput.value + 'T23:59:59') : null;
  const status = statusFilter.value;
  
  filteredAppointments = appointments.filter(appointment => {
    const appointmentDate = new Date(appointment.date);
    const matchesDateFrom = !dateFrom || appointmentDate >= dateFrom;
    const matchesDateTo = !dateTo || appointmentDate <= dateTo;
    const matchesStatus = !status || appointment.status === status;
    
    return matchesDateFrom && matchesDateTo && matchesStatus;
  });
}

// Helper function to get status information
function getStatusInfo(status) {
  switch (status) {
    case 'pending':
      return { class: 'pending', text: 'Pendiente' };
    case 'confirmed':
      return { class: 'confirmed', text: 'Confirmada' };
    case 'cancelled':
      return { class: 'cancelled', text: 'Cancelada' };
    default:
      return { class: '', text: 'Desconocido' };
  }
}

// Renderizar citas en la tabla
function renderAppointments() {
  // Limpiar tabla
  appointmentsList.innerHTML = '';
  
  // Ordenar por fecha
  filteredAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Crear fragmento para mejor rendimiento
  const fragment = document.createDocumentFragment();
  
  // Renderizar cada cita
  filteredAppointments.forEach(appointment => {
    const row = document.createElement('tr');
    
    // Formatear fecha
    const date = new Date(appointment.date);
    const formattedDate = date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Obtener información de estado
    const statusInfo = getStatusInfo(appointment.status);
    
    // Cliente (obtener de la relación o mostrar ID si no está disponible)
    const clientName = appointment.user 
      ? appointment.user.name 
      : `Cliente #${appointment.user_id}`;
    
    row.innerHTML = `
      <td>${appointment.id}</td>
      <td>${clientName}</td>
      <td>${formattedDate}</td>
      <td><span class="status-badge ${statusInfo.class}">${statusInfo.text}</span></td>
      <td>${appointment.notes ? (appointment.notes.length > 30 ? appointment.notes.substring(0, 30) + '...' : appointment.notes) : '-'}</td>
      <td class="actions">
        <button class="view-btn" data-id="${appointment.id}">Ver</button>
        ${appointment.status === 'pending' ? `
          <button class="confirm-btn" data-id="${appointment.id}">Confirmar</button>
          <button class="cancel-btn delete-button" data-id="${appointment.id}">Cancelar</button>
        ` : ''}
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  // Añadir todos los elementos al DOM de una sola vez
  appointmentsList.appendChild(fragment);
  
  // Añadir event listeners a los botones
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => viewAppointment(btn.dataset.id));
  });
  
  document.querySelectorAll('.confirm-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmAppointmentHandler(btn.dataset.id));
  });
  
  document.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => cancelAppointmentHandler(btn.dataset.id));
  });
}

// Ver detalles de una cita
async function viewAppointment(appointmentId) {
  const appointment = appointments.find(a => a.id == appointmentId);
  if (!appointment) return;
  
  currentAppointment = appointment;
  
  // Formatear fecha
  const date = new Date(appointment.date);
  const formattedDate = date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const formattedTime = date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  // Usar la función helper para obtener información de estado
  const statusInfo = getStatusInfo(appointment.status);
  
  // Obtener datos del cliente
  let clientHTML = '';
  if (appointment.user) {
    clientHTML = `
      <div class="detail-row">
        <strong>Cliente:</strong> ${appointment.user.name}
      </div>
      <div class="detail-row">
        <strong>Teléfono:</strong> ${appointment.user.phone}
      </div>
      <div class="detail-row">
        <strong>Email:</strong> ${appointment.user.email}
      </div>
      <div class="detail-row">
        <strong>Dirección:</strong> ${appointment.user.address}
      </div>
    `;
  } else {
    clientHTML = `
      <div class="detail-row">
        <strong>ID de cliente:</strong> ${appointment.user_id}
      </div>
    `;
  }
  
  // Crear HTML de detalles
  appointmentDetails.innerHTML = `
    <div class="detail-row">
      <strong>ID de cita:</strong> ${appointment.id}
    </div>
    <div class="detail-row">
      <strong>Fecha:</strong> ${formattedDate}
    </div>
    <div class="detail-row">
      <strong>Hora:</strong> ${formattedTime}
    </div>
    <div class="detail-row">
      <strong>Estado:</strong> <span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>
    </div>
    ${clientHTML}
    <div class="detail-row">
      <strong>Notas:</strong> ${appointment.notes || '-'}
    </div>
    <div class="detail-row">
      <strong>Creada el:</strong> ${new Date(appointment.created_at).toLocaleString('es-ES')}
    </div>
    
    ${appointment.status === 'pending' ? `
      <div class="form-actions">
        <button id="confirm-detail-btn" class="btn-confirm">Confirmar Cita</button>
        <button id="cancel-detail-btn" class="btn-cancel">Cancelar Cita</button>
      </div>
    ` : ''}
  `;
  
  // Mostrar modal
  appointmentDetailsModal.classList.add('show');
  
  // Añadir event listeners a los botones del modal
  if (appointment.status === 'pending') {
    document.getElementById('confirm-detail-btn').addEventListener('click', () => {
      confirmAppointmentHandler(appointment.id);
      appointmentDetailsModal.classList.remove('show');
    });
    
    document.getElementById('cancel-detail-btn').addEventListener('click', () => {
      cancelAppointmentHandler(appointment.id);
      appointmentDetailsModal.classList.remove('show');
    });
  }
}

// Confirmar una cita - usando función centralizada
async function confirmAppointmentHandler(appointmentId) {
  if (confirm('¿Confirmar esta cita?')) {
    try {
      showLoader();
      const success = await confirmAppointment(appointmentId);
      if (success) {
        // Actualizar estado en el array local
        const appointment = appointments.find(a => a.id == appointmentId);
        if (appointment) {
          appointment.status = 'confirmed';
          filterAppointments();
          renderAppointments();
          showSuccess('Cita confirmada correctamente');
        }
      }
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Error al confirmar cita:', error);
      showError('No se pudo confirmar la cita. Inténtalo de nuevo.');
    }
  }
}

// Cancelar una cita - usando función centralizada
async function cancelAppointmentHandler(appointmentId) {
  if (confirm('¿Cancelar esta cita?')) {
    try {
      showLoader();
      const success = await cancelAppointment(appointmentId);
      if (success) {
        // Actualizar estado en el array local
        const appointment = appointments.find(a => a.id == appointmentId);
        if (appointment) {
          appointment.status = 'cancelled';
          filterAppointments();
          renderAppointments();
          showSuccess('Cita cancelada correctamente');
        }
      }
      hideLoader();
    } catch (error) {
      hideLoader();
      console.error('Error al cancelar cita:', error);
      showError('No se pudo cancelar la cita. Inténtalo de nuevo.');
    }
  }
}

// Configurar event listeners con comprobaciones
function setupAppointmentsEventListeners() {
  // Aplicar filtros si los elementos existen
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
      filterAppointments();
      renderAppointments();
    });
  }
  
  // Cerrar modal de detalles
  document.querySelectorAll('#appointment-details-modal .close-button').forEach(btn => {
    btn.addEventListener('click', () => {
      appointmentDetailsModal.classList.remove('show');
    });
  });
  
  // También se debe cerrar al hacer clic fuera
  if (appointmentDetailsModal) {
    appointmentDetailsModal.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
      }
    });
  }
}