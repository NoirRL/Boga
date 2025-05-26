const express = require('express');
const router = express.Router();
const db = require('../models');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// Middleware para verificar propiedad de la factura
const verifyInvoiceOwnership = async (req, res, next) => {
  try {
    // Los administradores pueden acceder a todas las facturas
    if (req.isAdmin) {
      return next();
    }
    
    // Para usuarios normales, verificar si son dueños de la factura
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) {
      return res.status(401).json({ error: 'No autorizado - Identificación de usuario no proporcionada' });
    }
    
    // Buscar la factura por ID
    const invoice = await db.Invoice.findByPk(req.params.id, {
      include: [{
        model: db.User,
        attributes: ['telegram_id']
      }]
    });
    
    // Verificar si la factura existe
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    // Verificar si el usuario es dueño de la factura
    if (!invoice.User || invoice.User.telegram_id !== telegramId) {
      return res.status(403).json({ error: 'Acceso denegado - No es propietario de esta factura' });
    }
    
    // Usuario es propietario, continuar
    next();
  } catch (error) {
    console.error('Error verificando propiedad de factura:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ============= RUTAS DE ADMINISTRADOR =============

// Obtener todas las facturas (solo admin)
router.get('/', isAdmin, async (req, res) => {
  try {
    const invoices = await db.Invoice.findAll({
      include: [
        {
          model: db.User,
          attributes: ['telegram_id', 'name', 'email', 'phone', 'address']
        }
      ],
      order: [['created_at', 'DESC']]
    });
    
    res.json(invoices);
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// Actualizar estado de factura (solo admin)
router.patch('/:id/status', isAdmin, async (req, res) => {
  const transaction = await db.sequelize.transaction();
  
  try {
    const { status } = req.body;
    
    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Estado no válido' });
    }
    
    const invoice = await db.Invoice.findByPk(req.params.id, { 
      transaction,
      include: [db.User] // Incluir información del usuario
    });
    
    if (!invoice) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    // Prevenir cambios redundantes
    if (invoice.status === status) {
      await transaction.rollback();
      return res.status(400).json({ error: `La factura ya está en estado ${status}` });
    }
    
    // Registrar el admin que hace el cambio
    const adminAudit = {
      admin_id: req.adminId,
      action: `Cambio de estado de factura #${invoice.id} de ${invoice.status} a ${status}`,
      timestamp: new Date()
    };
    
    // Guardar en tabla de auditoría
    await db.AdminAudit.create(adminAudit, { transaction });
    
    // Si se cancela la factura, restaurar stock
    if (status === 'cancelled' && invoice.items && Array.isArray(invoice.items)) {
      console.log(`Restaurando stock para factura #${invoice.id}`);
      
      for (const item of invoice.items) {
        const product = await db.Product.findByPk(item.id, { transaction });
        if (product) {
          const newStock = product.stock + item.quantity;
          console.log(`Actualizando stock para producto ${product.id} de ${product.stock} a ${newStock}`);
          
          await product.update({ 
            stock: newStock 
          }, { transaction });
        } else {
          console.warn(`Producto ${item.id} no encontrado, no se actualizó el stock`);
        }
      }
    }
    
    // Guardar estado anterior para notificación
    const prevStatus = invoice.status;
    
    // Actualizar el estado
    invoice.status = status;
    await invoice.save({ transaction });
    
    // Si todo salió bien, confirmar transacción
    await transaction.commit();
    
    // Enviar notificación si es necesario (ej. al usuario)
    if (invoice.User && invoice.User.telegram_id) {
      try {
        // Aquí se podría implementar el envío de notificaciones
        console.log(`Notificación para usuario ${invoice.User.telegram_id}: Estado de factura actualizado`);
      } catch (notifError) {
        console.error('Error al enviar notificación:', notifError);
        // No interrumpimos el flujo por un error de notificación
      }
    }
    
    res.json(invoice);
  } catch (error) {
    // En caso de error, revertir cambios
    await transaction.rollback();
    console.error('Error al actualizar factura:', error);
    res.status(500).json({ error: 'Error al actualizar factura' });
  }
});

// ============= RUTAS DE USUARIO =============

// Obtener facturas de un usuario específico
router.get('/user', async (req, res) => {
  try {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    // Buscar usuario por Telegram ID
    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Obtener facturas del usuario
    const invoices = await db.Invoice.findAll({
      where: { user_id: user.id },
      order: [['created_at', 'DESC']]
    });
    
    res.json(invoices);
  } catch (error) {
    console.error('Error al obtener facturas del usuario:', error);
    res.status(500).json({ error: 'Error al obtener facturas' });
  }
});

// Obtener una factura específica (admin o propietario)
router.get('/:id', verifyInvoiceOwnership, async (req, res) => {
  try {
    const invoice = await db.Invoice.findByPk(req.params.id, {
      include: [
        {
          model: db.User,
          attributes: ['telegram_id', 'name', 'email', 'phone', 'address']
        }
      ]
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Error al obtener factura:', error);
    res.status(500).json({ error: 'Error al obtener factura' });
  }
});

// Crear nueva factura
router.post('/', async (req, res) => {
  try {
    const telegramId = req.headers['x-telegram-id'];
    if (!telegramId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    // Buscar usuario por Telegram ID
    const user = await db.User.findOne({ where: { telegram_id: telegramId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    // Validar datos de la factura
    const { items, total, billing_address, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La factura debe contener al menos un producto' });
    }
    
    if (typeof total !== 'number' || total <= 0) {
      return res.status(400).json({ error: 'El total debe ser un número positivo' });
    }
    
    // Verificar límite de compras (máximo 3 unidades del mismo producto por usuario)
    const productCounts = {};
    for (const item of items) {
      if (!productCounts[item.id]) {
        productCounts[item.id] = 0;
      }
      productCounts[item.id] += item.quantity;
      
      if (productCounts[item.id] > 3) {
        return res.status(400).json({ 
          error: `No puedes comprar más de 3 unidades del producto ${item.name}` 
        });
      }
    }
    
    // Crear la factura
    const invoice = await db.Invoice.create({
      user_id: user.id,
      total,
      items,
      billing_address: billing_address || user.address,
      notes,
      status: 'pending'
    });
    
    // Actualizar stock de productos
    for (const item of items) {
      const product = await db.Product.findByPk(item.id);
      if (product) {
        // Asegurar que no quede stock negativo
        const newStock = Math.max(0, product.stock - item.quantity);
        await product.update({ stock: newStock });
      }
    }
    
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error al crear factura:', error);
    res.status(500).json({ error: 'Error al crear factura' });
  }
});

module.exports = router;