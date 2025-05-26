/**
 * Common validation functions for models and routes
 */

/**
 * Validates that a date is in the future
 * @param {Date} date - The date to validate
 * @returns {boolean} - Whether the date is valid and in the future
 */
const isValidFutureDate = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return false;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  return date > today;
};

/**
 * Validates item quantities against maximum allowed
 * @param {Array} items - Array of items with id and quantity
 * @param {number} maxPerItem - Maximum quantity allowed per item
 * @returns {Object|null} - Error object or null if valid
 */
const validateItemQuantities = (items, maxPerItem = 3) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { error: 'Se requiere al menos un producto' };
  }
  
  const productCounts = {};
  for (const item of items) {
    if (!item.id || !item.quantity) {
      return { error: 'Cada item debe tener id y quantity' };
    }
    
    productCounts[item.id] = (productCounts[item.id] || 0) + item.quantity;
    
    if (productCounts[item.id] > maxPerItem) {
      return { 
        error: `No puedes comprar más de ${maxPerItem} unidades del producto ${item.name || item.id}` 
      };
    }
  }
  
  return null;
};

module.exports = {
  isValidFutureDate,
  validateItemQuantities
};
