// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', function() {
  // Configurar tabs
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');

  // Función para cambiar entre tabs
  function switchTab(tabName) {
    // Cambiar active en botones
    tabButtons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.tab-button[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Cambiar active en contenidos
    tabContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
  }

  // Configurar event listeners para tabs
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
  
  // Inicializar módulos con manejo de errores más robusto
  initializeModules();
  
  // Configuración para Telegram Mini App con manejo de errores mejorado
  initializeTelegramWebApp();
  
  // Activar el primer tab por defecto si ninguno está activo
  if (!document.querySelector('.tab-button.active')) {
    const firstTab = tabButtons[0]?.dataset.tab;
    if (firstTab) switchTab(firstTab);
  }
});

// Función para inicializar todos los módulos con mejor manejo de errores
function initializeModules() {
  // Crear un array con las funciones de inicialización y sus nombres para depuración
  const modules = [
    { name: 'Productos', fn: loadProducts, setup: setupProductsEventListeners },
    { name: 'Citas', fn: loadAppointments, setup: setupAppointmentsEventListeners },
    { name: 'Administradores', fn: loadAdmins, setup: setupAdminsEventListeners },
    { name: 'Facturas', fn: loadInvoices, setup: setupInvoicesEventListeners }
  ];
  
  // Inicializar cada módulo de forma segura
  modules.forEach(module => {
    try {
      // Configurar event listeners
      if (typeof module.setup === 'function') {
        module.setup();
      }
      
      // Cargar datos
      if (typeof module.fn === 'function') {
        module.fn();
      }
    } catch (error) {
      console.error(`Error al inicializar módulo ${module.name}:`, error);
      // Mostrar una notificación más amigable al usuario
      if (typeof showError === 'function') {
        showError(`No se pudo cargar el módulo ${module.name}`);
      }
    }
  });
}

// Función para inicializar Telegram WebApp
function initializeTelegramWebApp() {
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      console.log('Telegram WebApp inicializado correctamente');
    }
  } catch (error) {
    console.error('Error al inicializar Telegram WebApp:', error);
  }
}