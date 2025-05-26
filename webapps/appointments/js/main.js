// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Configuración para Telegram Mini App
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Definir color de tema basado en Telegram
      if (window.Telegram.WebApp.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
      }
    }
    
    // Inicializar sistema de citas
    if (typeof initialize === 'function') {
      initialize();
    } else {
      console.error('La función initialize no está definida');
    }
    
    // Configurar event listeners
    if (typeof setupEventListeners === 'function') {
      setupEventListeners();
    } else {
      console.error('La función setupEventListeners no está definida');
    }
  } catch (error) {
    console.error('Error durante la inicialización:', error);
  }
});