const express = require('express');
const router = express.Router();
const { Product } = require('../models');
const { handleError } = require('../utils/errorHandler');
const { isAdmin } = require('../middleware/auth');

// Middleware para encontrar un producto por ID
const findProductById = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    req.product = product;
    next();
  } catch (error) {
    handleError(res, 'buscar producto')(error);
  }
};

// GET - Obtener todos los productos
router.get('/', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    handleError(res, 'obtener productos')(error);
  }
});

// GET - Obtener un producto por ID
router.get('/:id', findProductById, (req, res) => {
  res.json(req.product);
});

// POST - Crear un nuevo producto (solo admin)
router.post('/', isAdmin, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (error) {
    handleError(res, 'crear producto')(error);
  }
});

// PUT - Actualizar un producto (solo admin)
router.put('/:id', isAdmin, findProductById, async (req, res) => {
  try {
    await req.product.update(req.body);
    res.json(req.product);
  } catch (error) {
    handleError(res, 'actualizar producto')(error);
  }
});

// DELETE - Eliminar un producto (solo admin)
router.delete('/:id', isAdmin, findProductById, async (req, res) => {
  try {
    await req.product.destroy();
    res.status(204).end();
  } catch (error) {
    handleError(res, 'eliminar producto')(error);
  }
});

module.exports = router;