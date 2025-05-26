// Variables globales
let admins = [];
let isSuperAdmin = false;
let filteredAdmins = [];

// Elementos DOM
const adminsList = document.getElementById('admins-list');
const adminSearchInput = document.getElementById('admin-search-input');
const addAdminBtn = document.getElementById('add-admin-btn');
const adminModal = document.getElementById('admin-modal');
const adminForm = document.getElementById('admin-form');
const cancelAdminBtn = document.getElementById('cancel-admin');
const adminModalTitle = document.getElementById('admin-modal-title');
const removeAdminModal = document.getElementById('remove-admin-modal');
const cancelRemoveAdminBtn = document.getElementById('cancel-remove-admin');
const confirmRemoveAdminBtn = document.getElementById('confirm-remove-admin');
const loader = document.getElementById('loader');
const notification = document.getElementById('notification');

// Funciones de API
async function apiRequest(url, options = {}) {
  try {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Comprueba si el usuario actual es superadmin
async function checkIfSuperAdmin() {
  try {
    const authInfo = getAuthInfo();
    if (!authInfo.token || !authInfo.telegramId) {
      return false;
    }
    
    const userData = await apiRequest(`/api/users/telegram/${authInfo.telegramId}`);
    return userData && userData.is_super_admin === true;
  } catch (error) {
    console.error('Error verificando permisos de superadmin:', error);
    return false;
  }
}

// Función para obtener administradores
async function getAdmins() {
  return await apiRequest('/api/users?is_admin=true');
}

// Funciones principales
async function loadAdmins() {
  try {
    showLoader();
    
    // Depuración
    console.log('Iniciando carga de administradores...');
    const authInfo = getAuthInfo();
    console.log('Información de autenticación:', 
                {hasToken: !!authInfo.token, 
                 hasTelegramId: !!authInfo.telegramId});
    
    // Verificar si el usuario actual es superadmin
    console.log('Verificando permisos de superadmin...');
    isSuperAdmin = await checkIfSuperAdmin();
    console.log('¿Es superadmin?', isSuperAdmin);
    
    // Cargar lista de administradores
    console.log('Cargando lista de administradores...');
    admins = await getAdmins();
    filteredAdmins = [...admins]; // Inicializar la lista filtrada
    console.log('Administradores cargados:', admins.length);
    
    renderAdmins();
  } catch (error) {
    console.error('Error al cargar administradores:', error);
    showNotification('Error al cargar administradores: ' + error.message, 'error');
  } finally {
    hideLoader();
  }
}

function renderAdmins() {
  // Aplicar filtro de búsqueda si existe
  const searchTerm = adminSearchInput ? adminSearchInput.value.toLowerCase().trim() : '';
  filteredAdmins = searchTerm ? 
    admins.filter(admin => 
      (admin.name && admin.name.toLowerCase().includes(searchTerm)) || 
      (admin.email && admin.email.toLowerCase().includes(searchTerm)) ||
      (admin.telegram_id && admin.telegram_id.toString().includes(searchTerm))
    ) : [...admins];
  
  // Limpiar la tabla
  adminsList.innerHTML = '';
  
  if (filteredAdmins.length === 0) {
    adminsList.innerHTML = '<tr><td colspan="6" class="text-center">No hay administradores registrados</td></tr>';
    return;
  }
  
  // Renderizar cada administrador
  filteredAdmins.forEach(admin => {
    const row = document.createElement('tr');
    
    // Formatear fecha
    let formattedDate = 'Fecha no disponible';
    try {
      const createdAt = new Date(admin.created_at);
      if (!isNaN(createdAt.getTime())) {
        formattedDate = createdAt.toLocaleDateString();
      }
    } catch (e) {
      console.error('Error al formatear fecha:', e);
    }
    
    // Verificar si es superadmin
    const isSuperAdminUser = admin.is_super_admin === true;
    
    row.innerHTML = `
      <td>${admin.telegram_id || 'N/A'}</td>
      <td>
        ${admin.name || 'N/A'}
        ${isSuperAdminUser ? '<span class="badge super-admin">Superadmin</span>' : ''}
      </td>
      <td>${admin.email || 'N/A'}</td>
      <td>${admin.phone || 'N/A'}</td>
      <td>${formattedDate}</td>
      <td class="actions">
        ${isSuperAdmin && !isSuperAdminUser ? `
          <button class="promote-btn" data-id="${admin.telegram_id}">Hacer Superadmin</button>
        ` : ''}
        ${isSuperAdmin && !isSuperAdminUser ? `
          <button class="delete-btn" data-id="${admin.telegram_id}">Quitar Admin</button>
        ` : ''}
      </td>
    `;
    
    adminsList.appendChild(row);
  });
  
  // Añadir event listeners a los botones
  if (isSuperAdmin) {
    attachButtonListeners();
  }
}

function attachButtonListeners() {
  document.querySelectorAll('.promote-btn').forEach(btn => {
    btn.addEventListener('click', () => promoteSuperAdmin(btn.dataset.id));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmRemoveAdmin(btn.dataset.id));
  });
}

async function promoteSuperAdmin(telegramId) {
  if (!isSuperAdmin) {
    showNotification('No tienes permisos para esta acción', 'error');
    return;
  }
  
  if (confirm('¿Estás seguro de que deseas hacer superadministrador a este usuario?')) {
    try {
      showLoader();
      await apiRequest(`/api/users/telegram/${telegramId}/superadmin`, {
        method: 'PATCH',
        body: JSON.stringify({ is_super_admin: true })
      });
      
      await loadAdmins(); // Recargar la lista
      showNotification('Usuario promovido a superadministrador correctamente', 'success');
    } catch (error) {
      showNotification(error.message, 'error');
    } finally {
      hideLoader();
    }
  }
}

function confirmRemoveAdmin(adminId) {
  if (!isSuperAdmin) {
    showNotification('No tienes permisos para esta acción', 'error');
    return;
  }
  
  const admin = admins.find(a => a.telegram_id == adminId);
  
  if (!admin) {
    showNotification('Administrador no encontrado', 'error');
    return;
  }
  
  if (admin.is_super_admin) {
    showNotification('No puedes eliminar a un superadministrador', 'error');
    return;
  }
  
  if (confirm(`¿Estás seguro de que deseas quitar los permisos de administrador a ${admin.name || 'este usuario'}?`)) {
    removeAdmin(adminId);
  }
}

async function removeAdmin(telegramId) {
  try {
    showLoader();
    await apiRequest(`/api/users/telegram/${telegramId}/admin`, {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: false })
    });
    
    await loadAdmins(); // Recargar la lista
    showNotification('Administrador eliminado correctamente', 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    hideLoader();
  }
}

function setupAdminsEventListeners() {
  if (addAdminBtn) {
    addAdminBtn.addEventListener('click', function() {
      // Verificar permiso de superadmin
      if (!isSuperAdmin) {
        showNotification('Solo los superadministradores pueden añadir administradores', 'error');
        return;
      }
      
      // Mostrar el modal
      adminModalTitle.textContent = 'Añadir Nuevo Administrador';
      if (adminForm) adminForm.reset();
      toggleModal(adminModal, true);
    });
  } else {
    console.error('Elemento addAdminBtn no encontrado');
  }
  
  if (cancelAdminBtn) {
    cancelAdminBtn.addEventListener('click', () => toggleModal(adminModal, false));
  }
  
  if (adminForm) {
    adminForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const telegramId = document.getElementById('admin-telegram-id').value;
      if (!telegramId) {
        showNotification('El ID de Telegram es obligatorio', 'error');
        return;
      }
      
      addAdminHandler(telegramId);
    });
  } else {
    console.error('Elemento adminForm no encontrado');
  }
  
  // Cierre de modales
  document.querySelectorAll('.modal .close-button').forEach(btn => {
    btn.addEventListener('click', function() {
      toggleModal(this.closest('.modal'), false);
    });
  });
  
  // Búsqueda de administradores
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', renderAdmins);
  }
}

async function addAdminHandler(telegramId) {
  if (!isSuperAdmin) {
    showNotification('No tienes permisos para esta acción', 'error');
    return;
  }
  
  try {
    showLoader();
    await apiRequest(`/api/users/telegram/${telegramId}/admin`, {
      method: 'PATCH',
      body: JSON.stringify({ is_admin: true })
    });
    
    toggleModal(adminModal, false);
    await loadAdmins(); // Recargar la lista
    showNotification('Administrador añadido correctamente', 'success');
  } catch (error) {
    showNotification(error.message, 'error');
  } finally {
    hideLoader();
  }
}

// Utilidades
function toggleModal(modal, show) {
  if (!modal) return;
  
  if (show) {
    modal.classList.add('show');
  } else {
    modal.classList.remove('show');
  }
}

function showLoader() {
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  if (loader) loader.style.display = 'none';
}

function showNotification(message, type = 'info') {
  if (!notification) {
    console.error('Elemento notification no encontrado');
    // Intentar usar notificaciones globales si existen
    if (typeof window.showSuccess === 'function' && type === 'success') {
      window.showSuccess(message);
      return;
    } else if (typeof window.showError === 'function' && (type === 'error' || type === 'warning')) {
      window.showError(message);
      return;
    }
    
    // Como último recurso, usar alert
    alert(message);
    return;
  }
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 3000);
}