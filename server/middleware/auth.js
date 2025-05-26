const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Secreto para JWT - Extraer de variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Generar token JWT para un usuario
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      telegram_id: user.telegram_id,
      is_admin: user.is_admin 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Función auxiliar para autenticar por Telegram ID
const authenticateByTelegramId = async (telegramId) => {
  if (!telegramId) {
    throw new Error('No autorizado - Token no proporcionado');
  }
  
  console.log(`Autenticando con Telegram ID: ${telegramId}`);
  
  const user = await User.findOne({ where: { telegram_id: telegramId } });
  if (!user) {
    throw new Error('No autorizado - Usuario no encontrado');
  }
  
  return user;
};

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    // Si no hay token, intentar con telegramId
    if (!token) {
      try {
        const telegramId = req.headers['x-telegram-id'];
        const user = await authenticateByTelegramId(telegramId);
        
        // Adjuntar información del usuario a la solicitud
        req.user = user;
        req.isAdmin = user.is_admin;
        
        return next();
      } catch (error) {
        return res.status(401).json({ error: error.message });
      }
    }
    
    // Verificar token JWT
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
      }
      
      try {
        // Verificar que el usuario sigue existiendo
        const user = await User.findByPk(decoded.id);
        if (!user) {
          return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        // Verificar que el ID de telegram coincida
        if (user.telegram_id !== decoded.telegram_id) {
          return res.status(403).json({ error: 'Token inválido - Datos no coinciden' });
        }
        
        // Adjuntar información del usuario
        req.user = user;
        req.isAdmin = decoded.is_admin;
        next();
      } catch (error) {
        console.error('Error en verificación de token:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
      }
    });
  } catch (error) {
    console.error('Error en autenticación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Función auxiliar para verificar roles
const checkRole = (roleValidator, errorMessage) => async (req, res, next) => {
  try {
    await authenticateToken(req, res, () => {
      if (!roleValidator(req)) {
        return res.status(403).json({ error: errorMessage });
      }
      next();
    });
  } catch (error) {
    console.error(`Error verificando permisos:`, error);
    res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
  }
};

// Middleware para verificar si es admin
const isAdmin = checkRole(
  req => req.isAdmin === true,
  'Acceso denegado - Se requieren permisos de administrador'
);

// Middleware para verificar superadmin
const isSuperAdmin = checkRole(
  req => req.user.is_super_admin === true,
  'Acceso denegado - Se requieren permisos de superadministrador'
);

module.exports = {
  generateToken,
  authenticateToken,
  isAdmin,
  isSuperAdmin
};