const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  image_url: {
    type: DataTypes.STRING(200)
  },
  category: {
    type: DataTypes.STRING(50)
  },
  stock: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  sizes: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      return this._parseJsonField('sizes');
    },
    set(value) {
      this._setJsonField('sizes', value);
    }
  },
  colors: {
    type: DataTypes.TEXT,
    allowNull: true,
    get() {
      return this._parseJsonField('colors');
    },
    set(value) {
      this._setJsonField('colors', value);
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'products',
  timestamps: false
});

/**
 * Parses a JSON string field into an array
 * @param {string} fieldName - The name of the field to parse
 * @returns {Array} - The parsed array or empty array if parsing fails
 */
Product.prototype._parseJsonField = function(fieldName) {
  const value = this.getDataValue(fieldName);
  if (!value) return [];
  
  try {
    return JSON.parse(value);
  } catch (e) {
    console.error(`Error parsing ${fieldName}:`, e);
    return [];
  }
};

/**
 * Converts a value to JSON string and sets it on the model
 * @param {string} fieldName - The name of the field to set
 * @param {*} value - The value to stringify and store
 */
Product.prototype._setJsonField = function(fieldName, value) {
  try {
    this.setDataValue(fieldName, JSON.stringify(Array.isArray(value) ? value : []));
  } catch (e) {
    console.error(`Error setting ${fieldName}:`, e);
    this.setDataValue(fieldName, '[]');
  }
};

module.exports = Product;