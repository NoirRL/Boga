const express = require('express');
const router = express.Router();
const { Appointment, User } = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { handleCustomError } = require('../utils/errorHandler');

// Middleware para verificar propiedad de la cita
const verifyAppointmentOwnership = async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({
      where: {
        id: req.params.id,
        is_deleted: false
      }
    });
    
    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    
    // Verificar que el usuario tiene acceso a esta cita
    if (appointment.user_id !== req.user.id && !req.isAdmin) {
      return res.status(403).json({ error: 'No autorizado para acceder a esta cita' });
    }
    
    req.appointment = appointment;
    next();
  } catch (error) {
    handleCustomError(res, error, 'Error verificando propiedad de cita');
  }
};

// GET - Obtener citas del usuario autenticado
router.get('/', authenticateToken, async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { 
        user_id: req.user.id,
        is_deleted: false
      },
      include: [User],
      order: [['date', 'ASC']]
    });
    res.json(appointments);
  } catch (error) {
    handleCustomError(res, error, 'Error al obtener citas');
  }
});

// GET - Obtener citas por ID de usuario (solo admin)
router.get('/user/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { 
        user_id: req.params.userId,
        is_deleted: false
      },
      order: [['date', 'ASC']]
    });
    res.json(appointments);
  } catch (error) {
    handleCustomError(res, error, 'Error al obtener citas de usuario');
  }
});

// GET - Ruta para administradores (todas las citas)
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.findAll({
      where: { is_deleted: false },
      include: [{
        model: User,
        attributes: ['id', 'name', 'email', 'phone']
      }],
      order: [['date', 'ASC']]
    });
    res.json(appointments);
  } catch (error) {
    handleCustomError(res, error, 'Error al obtener citas');
  }
});

// GET - Obtener una cita por ID
router.get('/:id', authenticateToken, verifyAppointmentOwnership, (req, res) => {
  res.json(req.appointment);
});

// POST - Crear una nueva cita
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Asegura que el user_id corresponda al usuario autenticado a menos que sea admin
    const appointmentData = { ...req.body };
    if (!req.isAdmin) {
      appointmentData.user_id = req.user.id;
    }
    
    const appointment = await Appointment.create(appointmentData);
    res.status(201).json(appointment);
  } catch (error) {
    handleCustomError(res, error, 'Error al crear cita');
  }
});

// PUT - Actualizar una cita
router.put('/:id', authenticateToken, verifyAppointmentOwnership, async (req, res) => {
  try {
    // Evitar que se modifiquen campos sensibles si no es admin
    const updateData = { ...req.body };
    if (!req.isAdmin) {
      delete updateData.user_id;
      delete updateData.is_deleted;
      delete updateData.deleted_at;
      delete updateData.deleted_by;
    }
    
    await req.appointment.update(updateData);
    res.json(req.appointment);
  } catch (error) {
    handleCustomError(res, error, 'Error al actualizar cita');
  }
});

// PATCH - Actualizar estado de una cita
router.patch('/:id/status', authenticateToken, verifyAppointmentOwnership, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    req.appointment.status = status;
    await req.appointment.save();
    
    res.json(req.appointment);
  } catch (error) {
    handleCustomError(res, error, 'Error al actualizar estado de cita');
  }
});

// DELETE - Eliminar una cita
router.delete('/:id', authenticateToken, verifyAppointmentOwnership, async (req, res) => {
  try {
    // Realizar borrado lógico
    await req.appointment.update({
      is_deleted: true,
      deleted_at: new Date(),
      deleted_by: req.user.id
    });
    
    // Log para auditoría
    console.log(`Cita ${req.params.id} borrada lógicamente por usuario ${req.user.id}`);
    
    res.json({ 
      message: 'Cita eliminada correctamente',
      appointment_id: req.params.id,
      deleted_at: new Date()
    });
  } catch (error) {
    handleCustomError(res, error, 'Error al eliminar cita');
  }
});

module.exports = router;