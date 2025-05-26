const express = require('express');
const path = require('path');
const cors = require('cors');
const { sequelize } = require('./models');

// Import all routes consistently
const routes = {
  products: require('./routes/products'),
  appointments: require('./routes/appointments'),
  users: require('./routes/users'),
  invoices: require('./routes/invoices')
};

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use('/admin', express.static(path.join(__dirname, '../webapps/admin')));
app.use('/catalog', express.static(path.join(__dirname, '../webapps/catalog')));
app.use('/appointments', express.static(path.join(__dirname, '../webapps/appointments')));

// Rutas API 
app.use('/api/products', routes.products);
app.use('/api/appointments', routes.appointments);
app.use('/api/users', routes.users);
app.use('/api/invoices', routes.invoices);

// Error handling middleware
app.use((req, res, next) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error del servidor' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
let server;

/**
 * Configura un cierre ordenado del servidor cuando recibe señales de sistema
 * @param {http.Server} server - Instancia del servidor HTTP
 */
function setupGracefulShutdown(server) {
  const stopServer = async (signal) => {
    console.log(`\n${signal} recibido. Iniciando cierre ordenado...`);
    
    console.log('Cerrando servidor HTTP...');
    server.close(() => {
      console.log('Servidor HTTP cerrado.');
      
      console.log('Cerrando conexiones de base de datos...');
      sequelize.close()
        .then(() => {
          console.log('Conexiones de base de datos cerradas correctamente.');
          console.log('Proceso finalizado con éxito.');
          process.exit(0);
        })
        .catch(err => {
          console.error('Error al cerrar conexiones de base de datos:', err);
          process.exit(1);
        });
    });
    
    // Si después de 10 segundos no se ha cerrado, forzar cierre
    setTimeout(() => {
      console.error('Cierre forzado después de 10 segundos de espera');
      process.exit(1);
    }, 10000);
  };
  
  // Capturar señales del sistema
  process.on('SIGTERM', () => stopServer('SIGTERM'));
  process.on('SIGINT', () => stopServer('SIGINT'));
  
  console.log('Sistema de cierre ordenado configurado.');
}

// Inicializar servidor con manejo de errores
sequelize.sync()
  .then(() => {
    server = app.listen(PORT, () => {
      console.log(`Servidor escuchando en puerto ${PORT}`);
    });
    
    // Configurar cierre ordenado
    setupGracefulShutdown(server);
  })
  .catch(err => {
    console.error('Error al sincronizar con base de datos:', err);
    process.exit(1);
  });

// Exponer la función para detener el servidor (útil para tests o reinicio programado)
module.exports = { 
  app, 
  server,
  stopServer: () => {
    if (server) server.close();
    return sequelize.close();
  } 
};