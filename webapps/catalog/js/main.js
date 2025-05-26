// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Configuración para Telegram Mini App
    if (window.Telegram) {
      const telegramApp = window.Telegram.WebApp;
      telegramApp.ready();
      telegramApp.expand();
      
      // Definir color de tema basado en Telegram
      if (telegramApp.colorScheme === 'dark') {
        document.body.classList.add('dark-theme');
      }
    }
    
    // Inicializar catálogo
    loadProducts();
    
    // Configurar event listeners
    setupEventListeners();
  } catch (error) {
    console.error('Error inicializando la aplicación:', error);
  }
});