const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Cargar variables de entorno con manejo de errores
try {
  dotenv.config({ path: '.env.local' });
} catch (error) {
  console.warn('No se pudo cargar el archivo .env.local:', error.message);
}

// Definir la ruta del archivo de base de datos SQLite
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const DB_DIRECTORY = path.join(PROJECT_ROOT, 'data');
const SQLITE_PATH = path.join(DB_DIRECTORY, 'database.sqlite');

// Crear el directorio de datos si no existe
if (!fs.existsSync(DB_DIRECTORY)) {
  try {
    fs.mkdirSync(DB_DIRECTORY, { recursive: true });
    console.log(`Directorio de base de datos creado: ${DB_DIRECTORY}`);
  } catch (err) {
    console.error(`Error al crear directorio de base de datos: ${err.message}`);
    process.exit(1); // Salir si no se puede crear el directorio esencial
  }
}

// Obtener URL de base de datos
const DATABASE_URL = process.env.DATABASE_URL;

// Configuración por defecto para Sequelize
const defaultOptions = {
  logging: false
};

// Inicializar Sequelize según el tipo de base de datos
let sequelize;
try {
  if (DATABASE_URL?.startsWith('postgres')) {
    sequelize = new Sequelize(DATABASE_URL, {
      ...defaultOptions,
      dialect: 'postgres',
      dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false }
      }
    });
  } else if (DATABASE_URL?.startsWith('mysql')) {
    sequelize = new Sequelize(DATABASE_URL, {
      ...defaultOptions,
      dialect: 'mysql'
    });
  } else {
    // Usar SQLite con configuración explícita
    sequelize = new Sequelize({
      ...defaultOptions,
      dialect: 'sqlite',
      storage: SQLITE_PATH
    });
  }
  
  // Probar la conexión inmediatamente
  sequelize.authenticate()
    .then(() => console.log('Conexión a la base de datos establecida correctamente'))
    .catch(err => console.error('Error al conectar con la base de datos:', err));
    
} catch (error) {
  console.error('Error al inicializar Sequelize:', error.message);
  process.exit(1);
}

module.exports = sequelize;