const sequelize = require('../config/database');
const User = require('./User');
const Product = require('./Product');
const Appointment = require('./Appointment');
const Invoice = require('./Invoice');

// Define model relationships
const setupAssociations = () => {
  // User relationships
  User.hasMany(Appointment, { foreignKey: 'user_id' });
  User.hasMany(Invoice, { foreignKey: 'user_id' });
  
  // Appointment relationships
  Appointment.belongsTo(User, { foreignKey: 'user_id' });
  
  // Invoice relationships
  Invoice.belongsTo(User, { foreignKey: 'user_id' });
  
  // Add any future relationships here
};

// Setup all model associations
setupAssociations();

// Export all models and sequelize instance
module.exports = {
  sequelize,
  User,
  Product,
  Appointment,
  Invoice
};