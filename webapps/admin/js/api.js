const API_URL = window.location.origin + '/api';

// Helpers para agregar el ID de Telegram a las solicitudes
function getTelegramId() {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
}

function getAuthInfo() {
  // Verificar si estamos en Telegram WebApp
  const isInTelegram = window.Telegram && window.Telegram.WebApp;
  
  let token = null;
  let telegramId = null;
  
  if (isInTelegram) {
    // Obtener datos directamente de Telegram
    try {
      telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      console.log("Telegram ID obtenido:", telegramId);
    } catch (e) {
      console.error("Error al obtener Telegram ID:", e);
    }
  } else {
    // Intentar obtener de localStorage solo si no estamos en Telegram
    try {
      token = localStorage.getItem('adminToken');
    } catch (e) {
      console.warn('No se pudo acceder a localStorage:', e);
    }
  }
  
  return { token, telegramId };
}

function getAuthHeaders() {
  const { token, telegramId } = getAuthInfo();
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  // Añadir token JWT si existe
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Añadir Telegram ID como respaldo
  if (telegramId) {
    headers['X-Telegram-ID'] = telegramId.toString();
  }
  
  return headers;
}

// Función helper para realizar peticiones API
async function apiRequest(endpoint, method = 'GET', body = null) {
  const url = `${API_URL}${endpoint}`;
  const options = {
    method,
    headers: getAuthHeaders()
  };
  
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || `Error HTTP: ${response.status}`);
    }
    
    return method === 'DELETE' ? true : await response.json();
  } catch (error) {
    console.error(`Error en solicitud API ${method} ${endpoint}:`, error);
    throw error;
  }
}

// Funciones para productos
async function getProducts() {
  try {
    return await apiRequest('/products');
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

async function createProduct(product) {
  return apiRequest('/products', 'POST', product);
}

async function updateProduct(id, product) {
  return apiRequest(`/products/${id}`, 'PUT', product);
}

async function deleteProduct(productId) {
  return apiRequest(`/products/${productId}`, 'DELETE');
}

// Funciones para citas
async function getAppointments() {
  try {
    return await apiRequest('/appointments');
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}

async function confirmAppointment(appointmentId) {
  try {
    return await apiRequest(`/appointments/${appointmentId}/status`, 'PATCH', { status: 'confirmed' });
  } catch (error) {
    console.error('Error confirming appointment:', error);
    return false;
  }
}

async function cancelAppointment(appointmentId) {
  try {
    return await apiRequest(`/appointments/${appointmentId}/status`, 'PATCH', { status: 'cancelled' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return false;
  }
}

// Funciones para facturas
async function getInvoices() {
  try {
    return await apiRequest('/invoices');
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    return [];
  }
}

async function getInvoice(id) {
  try {
    return await apiRequest(`/invoices/${id}`);
  } catch (error) {
    console.error(`Error al obtener factura ${id}:`, error);
    return null;
  }
}

async function updateInvoiceStatus(id, status) {
  return apiRequest(`/invoices/${id}/status`, 'PATCH', { status });
}

// Funciones para administradores
async function getAdmins() {
  try {
    return await apiRequest('/users?is_admin=true');
  } catch (error) {
    console.error('Error fetching admins:', error);
    return [];
  }
}

// Función para promocionar a admin
async function addAdmin(telegramId) {
  return apiRequest(`/users/telegram/${telegramId}/admin`, 'PATCH', { is_admin: true });
}

// Función para quitar permisos de admin
async function removeAdmin(telegramId) {
  try {
    await apiRequest(`/users/telegram/${telegramId}/admin`, 'PATCH', { is_admin: false });
    return true;
  } catch (error) {
    console.error('Error removing admin:', error);
    throw error;
  }
}

// Función para verificar si el usuario actual es superadmin
async function checkIfSuperAdmin() {
  try {
    // Usar getAuthInfo para obtener credenciales
    const { token, telegramId } = getAuthInfo();
    
    if (!token && !telegramId) {
      console.error('No hay información de autenticación disponible');
      return false;
    }
    
    const userData = await apiRequest('/users/me');
    return userData.is_super_admin === true;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}

// Función para promocionar a superadmin
async function promoteToSuperAdmin(telegramId) {
  return apiRequest(`/users/telegram/${telegramId}/superadmin`, 'PATCH', { is_super_admin: true });
}

// Función utilitaria global para manejar errores de API de manera consistente
function handleApiError(error, defaultMessage = 'Error en la operación') {
  console.error(defaultMessage, error);
  const errorMessage = error.message || defaultMessage;
  
  // Si existe la función global para mostrar errores, úsala
  if (typeof showError === 'function') {
    showError(errorMessage);
  } else {
    // Fallback si no existe la función
    alert(errorMessage);
  }
  
  // También podemos ocultar el loader si existe
  if (typeof hideLoader === 'function') {
    hideLoader();
  }
  
  // Devolver falso para indicar error
  return false;
}