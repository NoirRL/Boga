const API_URL = window.location.origin + '/api';

// Helper function to handle API requests with timeout
async function makeApiRequest(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${url}`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Función para obtener datos del usuario autenticado
async function getUserData() {
  try {
    // Obtener ID de Telegram de la mini app
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const telegramId = telegramUser?.id;
    
    if (!telegramId) {
      throw new Error('No se pudo obtener el ID de Telegram');
    }
    
    // Obtener datos del usuario desde la API
    return await makeApiRequest(`${API_URL}/users/telegram/${telegramId}`);
  } catch (error) {
    console.error('Error fetching user data:', error);
    // Datos de ejemplo para desarrollo
    return {
      id: 123456789,
      name: 'Usuario de Telegram',
      phone: '+34 612345678',
      email: 'usuario@example.com',
      address: 'Calle Principal 123, Madrid'
    };
  }
}

// Función para obtener citas del usuario
async function getUserAppointments(userId) {
  try {
    return await makeApiRequest(`${API_URL}/appointments/user/${userId}`);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return [];
  }
}

// Función para crear una nueva cita
async function createAppointment(appointmentData) {
  try {
    return await makeApiRequest(`${API_URL}/appointments`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(appointmentData)
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    throw error;
  }
}

// Función para cancelar una cita
async function cancelAppointment(appointmentId) {
  try {
    await makeApiRequest(`${API_URL}/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ status: 'cancelled' })
    });
    return true;
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return false;
  }
}
