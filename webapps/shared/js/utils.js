/**
 * Módulo de utilidades compartidas para la aplicación
 */

// Función para cargar scripts dinámicamente
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = (error) => reject(new Error(`Error al cargar script ${url}: ${error}`));
    document.head.appendChild(script);
  });
}

// Verificar y cargar bibliotecas necesarias
async function loadRequiredLibraries() {
  const requiredLibraries = [
    { 
      check: () => typeof window.jspdf !== 'undefined',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      message: 'jsPDF no está cargado, intentando cargar automáticamente...'
    },
    { 
      check: () => window.jspdf && typeof window.jspdf.jsPDF.prototype.autoTable !== 'undefined',
      url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js',
      message: 'jspdf-autotable no está cargado, intentando cargar automáticamente...'
    }
  ];
  
  try {
    for (const lib of requiredLibraries) {
      if (!lib.check()) {
        console.warn(lib.message);
        await loadScript(lib.url);
      }
    }
    return true;
  } catch (error) {
    console.error('Error cargando bibliotecas necesarias:', error);
    return false;
  }
}

// Formatear fecha con manejo seguro
function formatDate(date, options = {}) {
  if (!date || isNaN(new Date(date).getTime())) return 'Fecha no disponible';
  
  const defaultOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  
  try {
    return new Date(date).toLocaleDateString('es-ES', {...defaultOptions, ...options});
  } catch (e) {
    console.error('Error al formatear fecha:', e);
    return 'Fecha no disponible';
  }
}

// Formatear moneda
function formatCurrency(amount) {
  if (isNaN(parseFloat(amount))) return '€0.00';
  return `€${parseFloat(amount).toFixed(2)}`;
}

// Mostrar notificación toast
function showToast(message, duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Mostrar el toast (con animación)
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Eliminar el toast después del tiempo especificado
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300); // Tiempo de la animación de salida
  }, duration);
}

// Funciones para mostrar/ocultar loader
function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

// Funciones para mostrar mensajes de éxito/error
function showSuccess(message) {
  showNotification(message, 'success');
}

function showError(message) {
  showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  
  if (!notification) {
    // Intentar usar la función global si existe
    if (typeof window.showToast === 'function') {
      window.showToast(message);
      return;
    }
    
    // Si no hay alternativa, usar alert como último recurso
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

// Función de utilidad para validar URL
function isValidUrl(string) {
  if (!string) return false;
  
  try {
    const url = new URL(string);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (_) {
    return false;  
  }
}

// Función para marcar un campo como inválido
function markInvalid(field) {
  field.classList.add('invalid');
  
  // Limpiar el estado inválido al cambiar el valor
  field.addEventListener('input', function() {
    this.classList.remove('invalid');
    const existingError = this.parentElement.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
  }, { once: true });
}

// Exportar las funciones
window.Utils = {
  loadScript,
  loadRequiredLibraries,
  formatDate,
  formatCurrency,
  showToast,
  showLoader,
  hideLoader,
  showSuccess,
  showError,
  showNotification,
  isValidUrl,
  markInvalid
};

// También exportar como módulo ES si está disponible
export {
  loadScript,
  loadRequiredLibraries,
  formatDate,
  formatCurrency,
  showToast,
  showLoader,
  hideLoader,
  showSuccess,
  showError,
  showNotification,
  isValidUrl,
  markInvalid
};
