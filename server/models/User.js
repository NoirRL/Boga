const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegram_id: {
    type: DataTypes.BIGINT, 
    unique: true,
    allowNull: false,
    index: true 
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'El nombre no puede estar vacío'
      }
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      is: {
        args: /^(\+\d{1,3})?\s?\d{6,14}$/,
        msg: 'El formato del teléfono no es válido'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      isEmail: {
        msg: 'Por favor, introduce un email válido'
      }
    }
  },
  address: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'La dirección no puede estar vacía'
      },
      len: {
        args: [5, 200],
        msg: 'La dirección debe tener entre 5 y 200 caracteres'
      }
    }
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_super_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
}, {
  tableName: 'users',
  timestamps: false,
  indexes: [
    {
      name: 'idx_telegram_id',
      fields: ['telegram_id']
    },
    {
      name: 'idx_email',
      fields: ['email']
    }
  ]
});

module.exports = User;