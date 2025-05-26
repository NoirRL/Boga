const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Define status options as a constant for better maintainability
const STATUS_OPTIONS = ['pending', 'confirmed', 'cancelled'];

const Appointment = sequelize.define('Appointment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: {
        msg: 'La fecha debe ser válida'
      },
      isAfterToday(value) {
        const appointmentDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
        
        if (appointmentDate <= today) {
          throw new Error('La fecha de la cita debe ser futura');
        }
      }
    }
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
    validate: {
      isIn: {
        args: [STATUS_OPTIONS],
        msg: 'El estado debe ser: pendiente, confirmado o cancelado'
      }
    }
  },
  reason: {
    type: DataTypes.STRING(50)
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'appointments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  paranoid: true,
  deletedAt: 'deleted_at'
});

module.exports = Appointment;