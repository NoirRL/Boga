const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { authenticateToken, isAdmin, isSuperAdmin } = require('../middleware/auth');

// Helper function to filter sensitive user data
const filterUserData = (user, isSuperAdmin = false) => {
  const userData = user.toJSON ? user.toJSON() : { ...user };
  
  if (!isSuperAdmin) {
    delete userData.is_super_admin;
  }
  
  return userData;
};

// GET - Obtener datos del usuario autenticado
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Devolver datos del usuario autenticado (desde req.user)
    res.json({
      id: req.user.id,
      telegram_id: req.user.telegram_id,
      name: req.user.name,
      email: req.user.email,
      is_admin: req.user.is_admin,
      is_super_admin: req.user.is_super_admin
    });
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

// GET - Obtener todos los usuarios (requiere ser admin)
router.get('/', isAdmin, async (req, res) => {
  try {
    const whereClause = {};
    
    // Si hay filtro para admins, aplicarlo
    if (req.query.is_admin === 'true') {
      whereClause.is_admin = true;
    }
    
    const users = await User.findAll({ where: whereClause });
    
    // Procesar los usuarios aplicando filtro según nivel de permisos
    const processedUsers = users.map(user => 
      filterUserData(user, req.user.is_super_admin)
    );
    
    res.json(processedUsers);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// GET - Obtener usuario por ID de Telegram (requiere ser admin)
router.get('/telegram/:telegramId', isAdmin, async (req, res) => {
  try {
    const user = await User.findOne({
      where: { telegram_id: req.params.telegramId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(filterUserData(user, req.user.is_super_admin));
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// GET - Obtener usuario por ID (requiere ser admin)
router.get('/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json(filterUserData(user, req.user.is_super_admin));
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
});

// POST - Crear un nuevo usuario (requiere ser admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    // Si el usuario no es superadmin, no permitir crear superadmins
    if (!req.user.is_super_admin && req.body.is_super_admin) {
      return res.status(403).json({ 
        error: 'No tienes permisos para crear superadministradores' 
      });
    }
    
    const user = await User.create(req.body);
    
    res.status(201).json(filterUserData(user, req.user.is_super_admin));
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT - Actualizar un usuario (requiere ser admin)
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Si el usuario no es superadmin, no permitir modificar superadmins
    if (!req.user.is_super_admin && user.is_super_admin) {
      return res.status(403).json({ 
        error: 'No tienes permisos para modificar superadministradores' 
      });
    }
    
    // Si el usuario no es superadmin, no permitir convertir a otros en superadmin
    if (!req.user.is_super_admin && req.body.is_super_admin) {
      delete req.body.is_super_admin;
    }
    
    await user.update(req.body);
    
    res.json(filterUserData(user, req.user.is_super_admin));
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// PATCH - Actualizar estado de admin de un usuario (solo superadmin)
router.patch('/telegram/:telegramId/admin', isSuperAdmin, async (req, res) => {
  try {
    const { is_admin } = req.body;
    if (typeof is_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_admin debe ser un booleano' });
    }
    
    const user = await User.findOne({
      where: { telegram_id: req.params.telegramId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No permitir quitar permisos a otro superadmin
    if (user.is_super_admin && !is_admin) {
      return res.status(403).json({ 
        error: 'No se pueden quitar permisos de administrador a un superadministrador' 
      });
    }
    
    user.is_admin = is_admin;
    await user.save();
    
    // Registrar la actividad
    console.log(`Usuario ${req.user.telegram_id} ${is_admin ? 'otorgó' : 'revocó'} permisos de admin a ${user.telegram_id}`);
    
    res.json(filterUserData(user, true)); // Super admins can see all data
  } catch (error) {
    console.error('Error al actualizar estado admin:', error);
    res.status(500).json({ error: 'Error al actualizar estado admin' });
  }
});

// PATCH - Actualizar estado de superadmin de un usuario (solo superadmin)
router.patch('/telegram/:telegramId/superadmin', isSuperAdmin, async (req, res) => {
  try {
    const { is_super_admin } = req.body;
    if (typeof is_super_admin !== 'boolean') {
      return res.status(400).json({ error: 'is_super_admin debe ser un booleano' });
    }
    
    // No permitir que el superadmin se quite sus propios permisos
    if (req.user.telegram_id === req.params.telegramId && !is_super_admin) {
      return res.status(403).json({ 
        error: 'No puedes quitarte a ti mismo los permisos de superadministrador' 
      });
    }
    
    const user = await User.findOne({
      where: { telegram_id: req.params.telegramId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    user.is_super_admin = is_super_admin;
    
    // Si es superadmin, también debe ser admin
    if (is_super_admin) {
      user.is_admin = true;
    }
    
    await user.save();
    
    // Registrar la actividad
    console.log(`Usuario ${req.user.telegram_id} ${is_super_admin ? 'otorgó' : 'revocó'} permisos de superadmin a ${user.telegram_id}`);
    
    res.json(filterUserData(user, true)); // Super admins can see all data
  } catch (error) {
    console.error('Error al actualizar estado superadmin:', error);
    res.status(500).json({ error: 'Error al actualizar estado superadmin' });
  }
});

// DELETE - Eliminar un usuario (solo superadmin)
router.delete('/:id', isSuperAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // No permitir eliminar superadmins
    if (user.is_super_admin) {
      return res.status(403).json({ 
        error: 'No se puede eliminar un superadministrador' 
      });
    }
    
    await user.destroy();
    res.status(204).end();
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;