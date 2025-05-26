// Variables globales
let userData = null;
let userAppointments = [];
let availableHours = [
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30'
];
let selectedDateTime = null;

// Constantes para mapeos usados múltiples veces
const REASON_MAP = {
  'consulta': 'Consulta de tallas',
  'compra': 'Asesoramiento para compra',
  'devolución': 'Gestionar devolución',
  'otro': 'Otro'
};

const STATUS_MAP = {
  'pending': 'Pendiente',
  'confirmed': 'Confirmada',
  'cancelled': 'Cancelada'
};

// Elementos DOM
const userDataContainer = document.getElementById('user-data-container');
const userLoading = document.getElementById('user-loading');
const appointmentsContainer = document.getElementById('appointments-container');
const appointmentsLoading = document.getElementById('appointments-loading');
const appointmentForm = document.getElementById('appointment-form');
const appointmentDate = document.getElementById('appointment-date');
const appointmentTime = document.getElementById('appointment-time');
const appointmentReason = document.getElementById('appointment-reason');
const appointmentNotes = document.getElementById('appointment-notes');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmationDetails = document.getElementById('confirmation-details');
const confirmAppointmentBtn = document.getElementById('confirm-appointment');
const cancelBookingBtn = document.getElementById('cancel-booking');
const successModal = document.getElementById('success-modal');
const successDetails = document.getElementById('success-details');
const closeSuccessBtn = document.getElementById('close-success');

// Función principal de inicialización
async function initialize() {
  try {
    // Establecer fecha mínima (hoy)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    appointmentDate.min = `${yyyy}-${mm}-${dd}`;
    
    // Cargar datos del usuario
    await loadUserData();
    
    // Cargar citas existentes
    await loadUserAppointments();
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  }
}

// Funciones de utilidad para formateo de fechas
function formatDate(date) {
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function loadUserData() {
  try {
    userLoading.style.display = 'flex';
    
    // Obtener datos del usuario
    userData = await getUserData();
    
    // Mostrar datos del usuario
    userDataContainer.innerHTML = `
      <div class="user-info-card">
        <div class="user-info-item">
          <span class="user-info-label">Nombre:</span> ${userData.name}
        </div>
        <div class="user-info-item">
          <span class="user-info-label">Teléfono:</span> ${userData.phone}
        </div>
        <div class="user-info-item">
          <span class="user-info-label">Email:</span> ${userData.email}
        </div>
        <div class="user-info-item">
          <span class="user-info-label">Dirección:</span> ${userData.address}
        </div>
      </div>
    `;
    
    userLoading.style.display = 'none';
  } catch (error) {
    console.error('Error al cargar datos del usuario:', error);
    userLoading.style.display = 'none';
    userDataContainer.innerHTML = `
      <div class="error-message">
        No se pudieron cargar tus datos. Por favor, asegúrate de haber registrado tu información en el bot.
      </div>
    `;
  }
}

async function loadUserAppointments() {
  try {
    appointmentsLoading.style.display = 'flex';
    
    // Verificar que userData existe antes de intentar acceder a sus propiedades
    if (!userData || !userData.id) {
      throw new Error('Datos de usuario no disponibles');
    }
    
    // Obtener citas del usuario
    userAppointments = await getUserAppointments(userData.id);
    
    // Mostrar citas
    renderAppointments();
    
    appointmentsLoading.style.display = 'none';
  } catch (error) {
    console.error('Error al cargar citas:', error);
    appointmentsLoading.style.display = 'none';
    appointmentsContainer.innerHTML = `
      <div class="error-message">
        No se pudieron cargar tus citas. Por favor, intenta nuevamente más tarde.
      </div>
    `;
  }
}

function renderAppointments() {
  if (!userAppointments || userAppointments.length === 0) {
    appointmentsContainer.innerHTML = `
      <div class="no-appointments">
        No tienes citas programadas.
      </div>
    `;
    return;
  }
  
  // Ordenar citas por fecha
  userAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  let html = '<div class="appointments-list">';
  
  userAppointments.forEach(appointment => {
    const date = new Date(appointment.date);
    const formattedDate = formatDate(date);
    const formattedTime = formatTime(date);
    
    html += `
      <div class="appointment-card ${appointment.status}">
        <div class="appointment-date">
          ${formattedDate} a las ${formattedTime}
        </div>
        <div class="appointment-status ${appointment.status}">
          ${getStatusText(appointment.status)}
        </div>
        <div class="appointment-reason">
          <strong>Motivo:</strong> ${REASON_MAP[appointment.reason] || appointment.reason}
        </div>
        ${appointment.notes ? `<div class="appointment-notes">${appointment.notes}</div>` : ''}
        ${appointment.status === 'pending' ? `
          <button class="cancel-button" data-id="${appointment.id}">Cancelar Cita</button>
        ` : ''}
      </div>
    `;
  });
  
  html += '</div>';
  appointmentsContainer.innerHTML = html;
  
  // Añadir listeners a los botones de cancelar
  document.querySelectorAll('.cancel-button').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      if (await cancelAppointment(id)) {
        // Actualizar lista de citas
        const index = userAppointments.findIndex(a => a.id.toString() === id);
        if (index !== -1) {
          userAppointments[index].status = 'cancelled';
          renderAppointments();
        }
      }
    });
  });
}

function getStatusText(status) {
  return STATUS_MAP[status] || status;
}

function updateAvailableHours() {
  // Limpiar las opciones actuales
  appointmentTime.innerHTML = '<option value="">Selecciona una hora</option>';
  
  // Filtrar horas ya ocupadas para la fecha seleccionada
  const selectedDate = appointmentDate.value;
  if (!selectedDate) return;
  
  const bookedHours = userAppointments
    .filter(a => a.status !== 'cancelled' && a.date.startsWith(selectedDate))
    .map(a => {
      const date = new Date(a.date);
      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    });
  
  // Añadir horas disponibles
  const availableTimes = availableHours.filter(time => !bookedHours.includes(time));
  
  availableTimes.forEach(time => {
    const option = document.createElement('option');
    option.value = time;
    option.textContent = time;
    appointmentTime.appendChild(option);
  });
}

function showConfirmationModal() {
  // Obtener los valores del formulario
  const date = appointmentDate.value;
  const time = appointmentTime.value;
  const reason = appointmentReason.value;
  const notes = appointmentNotes.value;
  
  // Crear objeto de fecha/hora
  const dateTime = new Date(`${date}T${time}:00`);
  selectedDateTime = dateTime;
  
  // Llenar el modal de confirmación
  confirmationDetails.innerHTML = `
    <div class="confirmation-detail">
      <span class="confirmation-label">Fecha:</span>
      ${formatDate(dateTime)}
    </div>
    <div class="confirmation-detail">
      <span class="confirmation-label">Hora:</span>
      ${formatTime(dateTime)}
    </div>
    <div class="confirmation-detail">
      <span class="confirmation-label">Motivo:</span>
      ${REASON_MAP[reason] || reason}
    </div>
    ${notes ? `
      <div class="confirmation-detail">
        <span class="confirmation-label">Notas adicionales:</span>
        ${notes}
      </div>
    ` : ''}
  `;
  
  // Mostrar el modal
  confirmationModal.classList.add('show');
}

async function bookAppointment() {
  try {
    // Crear objeto de cita
    const appointmentData = {
      user_id: userData.id,
      date: selectedDateTime.toISOString(),
      reason: appointmentReason.value,
      notes: appointmentNotes.value,
      status: 'pending'
    };
    
    // Enviar la solicitud para crear la cita
    const newAppointment = await createAppointment(appointmentData);
    
    // Añadir la nueva cita a la lista
    userAppointments.push(newAppointment);
    
    // Ocultar modal de confirmación
    confirmationModal.classList.remove('show');
    
    // Mostrar modal de éxito
    showSuccessModal(newAppointment);
    
    // Limpiar formulario
    appointmentForm.reset();
    
    // Actualizar lista de citas
    renderAppointments();
  } catch (error) {
    console.error('Error al crear cita:', error);
    alert('Ha ocurrido un error al crear la cita. Por favor, intenta nuevamente.');
    confirmationModal.classList.remove('show');
  }
}

function showSuccessModal(appointment) {
  const date = new Date(appointment.date);
  
  successDetails.innerHTML = `
    <p>Tu cita ha sido agendada para el <strong>${formatDate(date)}</strong> a las <strong>${formatTime(date)}</strong>.</p>
    <p>Recibirás una notificación cuando sea confirmada por el equipo de la tienda.</p>
  `;
  
  successModal.classList.add('show');
}

// Event Listeners
function setupEventListeners() {
  // Evento para cambio de fecha
  appointmentDate.addEventListener('change', updateAvailableHours);
  
  // Evento para envío de formulario
  appointmentForm.addEventListener('submit', event => {
    event.preventDefault();
    if (validateAppointmentForm()) {
      showConfirmationModal();
    }
  });
  
  // Eventos para modal de confirmación
  confirmAppointmentBtn.addEventListener('click', bookAppointment);
  
  cancelBookingBtn.addEventListener('click', () => {
    confirmationModal.classList.remove('show');
  });
  
  document.querySelectorAll('.modal .close-button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('show');
    });
  });
  
  // Evento para cerrar modal de éxito
  closeSuccessBtn.addEventListener('click', () => {
    successModal.classList.remove('show');
  });
}


// Validar formulario de cita
function validateAppointmentForm() {
  // Obtener valores
  const dateInput = document.getElementById('appointment-date');
  const timeInput = document.getElementById('appointment-time');
  const reasonInput = document.getElementById('appointment-reason');
  
  // Limpiar errores anteriores
  clearFormErrors();
  
  // Validar fecha
  const errors = [];
  
  // Validar campos obligatorios
  if (!dateInput.value) {
    errors.push('Debes seleccionar una fecha');
    Utils.markInvalid(dateInput);
    return false;
  } 
  
  if (!timeInput.value) {
    errors.push('Debes seleccionar una hora');
    Utils.markInvalid(timeInput);
    return false;
  }
  
  // Validar fecha en el futuro
  const selectedDate = new Date(`${dateInput.value}T${timeInput.value}`);
  const now = new Date();
  
  if (selectedDate < now) {
    errors.push('No puedes seleccionar una fecha en el pasado');
    Utils.markInvalid(dateInput);
  }
  
  // Comprobar que la hora esté dentro del horario comercial (10:00 - 20:00)
  const hour = parseInt(timeInput.value.split(':')[0]);
  if (hour < 10 || hour >= 20) {
    errors.push('El horario de citas es de 10:00 a 20:00');
    Utils.markInvalid(timeInput);
  }
  
  // Validar motivo
  if (!reasonInput.value.trim()) {
    errors.push('Debes indicar el motivo de la cita');
    Utils.markInvalid(reasonInput);
  } else if (reasonInput.value.trim().length < 3) {
    errors.push('El motivo debe tener al menos 3 caracteres');
    Utils.markInvalid(reasonInput);
  }
  
  // Mostrar errores si los hay
  if (errors.length > 0) {
    showFormErrors(errors);
    return false;
  }
  
  return true;
}

// Mostrar errores de formulario
function showFormErrors(errors) {
  const errorContainer = document.getElementById('form-errors') || createErrorContainer();
  errorContainer.innerHTML = '';
  
  const errorList = document.createElement('ul');
  errors.forEach(error => {
    const li = document.createElement('li');
    li.textContent = error;
    errorList.appendChild(li);
  });
  
  errorContainer.appendChild(errorList);
  errorContainer.style.display = 'block';
  
  // Añadir clase para animación
  errorContainer.classList.add('shake');
  setTimeout(() => {
    errorContainer.classList.remove('shake');
  }, 500);
}

// Crear contenedor de errores
function createErrorContainer() {
  const container = document.createElement('div');
  container.id = 'form-errors';
  container.className = 'error-container';
  
  const form = document.getElementById('appointment-form');
  form.insertBefore(container, form.firstChild);
  
  return container;
}

// Limpiar errores
function clearFormErrors() {
  const errorContainer = document.getElementById('form-errors');
  if (errorContainer) {
    errorContainer.innerHTML = '';
    errorContainer.style.display = 'none';
  }
  
  // Limpiar marcas de error en campos
  document.querySelectorAll('.invalid').forEach(element => {
    element.classList.remove('invalid');
  });
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initialize);
