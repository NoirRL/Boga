import os
import logging
import datetime
from typing import Dict, Any

# Configuración de logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Importaciones para Telegram
from telegram import Update, ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler, MessageHandler, 
    ConversationHandler, ContextTypes, filters
)

# Importaciones para base de datos
import os
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, scoped_session
from dotenv import load_dotenv

###########################################
# CONFIGURACIÓN
###########################################

# Cargar variables de entorno
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
dotenv_path = os.path.join(project_root, '.env.local')

print(f"Buscando .env.local en: {dotenv_path}")
if os.path.exists(dotenv_path):
    print(".env.local existe!")
else:
    print("¡ADVERTENCIA! .env.local NO existe en esa ruta")

load_dotenv(dotenv_path)

# Token de Telegram
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")

# Lista de IDs de administradores
ADMIN_USER_IDS = [1870169979, 5338637494]  
SUPER_ADMIN_USER_IDS = [1870169979]

# URLs de las WebApps - Obtener la URL base desde variable de entorno con fallback a ngrok
BASE_URL ="https://78ca-185-107-56-137.ngrok-free.app"
CATALOG_WEBAPP_URL = f"{BASE_URL}/catalog"
APPOINTMENTS_WEBAPP_URL = f"{BASE_URL}/appointments"
ADMIN_WEBAPP_URL = f"{BASE_URL}/admin"

# Después de cargar las variables
logger.info(f"BASE_URL: {BASE_URL}")
logger.info(f"CATALOG_WEBAPP_URL: {CATALOG_WEBAPP_URL}")
logger.info(f"APPOINTMENTS_WEBAPP_URL: {APPOINTMENTS_WEBAPP_URL}")
logger.info(f"ADMIN_WEBAPP_URL: {ADMIN_WEBAPP_URL}")

# Configuración de la base de datos
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///store_bot.db")

# Si es PostgreSQL (Railway), ajustar la URL
if DATABASE_URL.startswith("postgres://"):
    # Railway proporciona URLs postgres://, pero SQLAlchemy usa postgresql://
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Crear motor con las opciones correctas para PostgreSQL
engine = create_engine(
    DATABASE_URL,
    # Para PostgreSQL en Railway necesitas estas opciones
    connect_args={"sslmode": "require"} if DATABASE_URL.startswith("postgresql") else {}
)
###########################################
# MODELOS DE BASE DE DATOS
###########################################

Base = declarative_base()

class User(Base):
    """Modelo para almacenar información de los usuarios"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    telegram_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False)
    address = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    is_admin = Column(Boolean, default=False)
    is_super_admin = Column(Boolean, default=False)
    
    # Relaciones
    appointments = relationship("Appointment", back_populates="user")

class Product(Base):
    """Modelo para almacenar productos"""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price = Column(Float, nullable=False)
    image_url = Column(String(200))
    category = Column(String(50))
    stock = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Appointment(Base):
    """Modelo para almacenar citas"""
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    date = Column(DateTime, nullable=False)
    status = Column(String(20), default="pending")  # pending, confirmed, cancelled
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Relaciones
    user = relationship("User", back_populates="appointments")

###########################################
# ADMINISTRACIÓN DE BASE DE DATOS
###########################################

Session = scoped_session(sessionmaker(bind=engine))

def init_db():
    """Inicializa la base de datos creando todas las tablas"""
    Base.metadata.create_all(engine)

def get_session():
    """Obtiene una sesión de la base de datos"""
    return Session()

def is_admin(user_id):
    """Verifica si un usuario es administrador"""
    # Comprobar si está en la lista de administradores fijos
    if user_id in ADMIN_USER_IDS or user_id in SUPER_ADMIN_USER_IDS:
        return True
    
    # Comprobar en la base de datos
    user_data = get_user(user_id)
    return user_data and (user_data.get('is_admin', False) or user_data.get('is_super_admin', False))

def is_super_admin(user_id):
    """Verifica si un usuario es superadministrador"""
    # Comprobar si está en la lista de superadministradores fijos
    if user_id in SUPER_ADMIN_USER_IDS:
        return True
    
    # Comprobar en la base de datos
    user_data = get_user(user_id)
    return user_data and user_data.get('is_super_admin', False)

# Funciones para gestión de usuarios
def save_user(telegram_id, name, phone, email, address):
    """Guarda un nuevo usuario en la base de datos"""
    session = get_session()
    try:
        user = User(
            telegram_id=telegram_id,
            name=name,
            phone=phone,
            email=email,
            address=address
        )
        session.add(user)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error al guardar usuario: {e}")
        return False
    finally:
        session.close()

def user_exists(telegram_id):
    """Verifica si un usuario existe en la base de datos"""
    session = get_session()
    try:
        return session.query(User).filter_by(telegram_id=telegram_id).first() is not None
    finally:
        session.close()

def get_user(telegram_id):
    """Obtiene información de un usuario por su ID de Telegram"""
    session = get_session()
    try:
        user = session.query(User).filter_by(telegram_id=telegram_id).first()
        if user:
            return {
                'id': user.id,
                'name': user.name,
                'phone': user.phone,
                'email': user.email,
                'address': user.address,
                'is_admin': user.is_admin,
                'is_super_admin': user.is_super_admin
            }
        return None
    finally:
        session.close()

def update_user(telegram_id, **kwargs):
    """Actualiza la información de un usuario"""
    session = get_session()
    try:
        user = session.query(User).filter_by(telegram_id=telegram_id).first()
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            session.commit()
            return True
        return False
    except Exception as e:
        session.rollback()
        logger.error(f"Error al actualizar usuario: {e}")
        return False
    finally:
        session.close()

# Funciones para gestión de productos
def add_product(name, description, price, image_url=None, category=None, stock=0):
    """Añade un nuevo producto"""
    session = get_session()
    try:
        product = Product(
            name=name,
            description=description,
            price=price,
            image_url=image_url,
            category=category,
            stock=stock
        )
        session.add(product)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error al añadir producto: {e}")
        return False
    finally:
        session.close()

def get_products(category=None):
    """Obtiene todos los productos, opcionalmente filtrados por categoría"""
    session = get_session()
    try:
        query = session.query(Product)
        if category:
            query = query.filter_by(category=category)
        products = query.all()
        return [
            {
                'id': p.id,
                'name': p.name,
                'description': p.description,
                'price': p.price,
                'image_url': p.image_url,
                'category': p.category,
                'stock': p.stock
            }
            for p in products
        ]
    finally:
        session.close()

# Funciones para gestión de citas
def create_appointment(user_id, date, notes=None):
    """Crea una nueva cita"""
    session = get_session()
    try:
        appointment = Appointment(
            user_id=user_id,
            date=date,
            notes=notes
        )
        session.add(appointment)
        session.commit()
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error al crear cita: {e}")
        return False
    finally:
        session.close()

def get_user_appointments(telegram_id):
    """Obtiene todas las citas de un usuario"""
    session = get_session()
    try:
        user = session.query(User).filter_by(telegram_id=telegram_id).first()
        if not user:
            return []
        
        appointments = session.query(Appointment).filter_by(user_id=user.id).all()
        return [
            {
                'id': a.id,
                'date': a.date,
                'status': a.status,
                'notes': a.notes
            }
            for a in appointments
        ]
    finally:
        session.close()

###########################################
# TECLADOS
###########################################

def get_main_keyboard(is_admin=False):
    """Retorna el teclado principal para usuarios normales"""
    keyboard = [
        [
            KeyboardButton("📋 Información"),
        ],
        [
            KeyboardButton("🛍️ Catálogo"),
            KeyboardButton("📅 Agendar Cita")
        ],
        [
            KeyboardButton("❓ Ayuda"),
            KeyboardButton("📞 Contacto")
        ]
    ]

    # Añadir botón de Admin solo para administradores
    if is_admin:
        keyboard.append([KeyboardButton("🔐 Panel Admin")])
    
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def get_webapp_keyboard():
    """Retorna el teclado con botones para las WebApps"""
    keyboard = [
        [
            InlineKeyboardButton(
                "🛍️ Ver Catálogo", 
                web_app={"url": CATALOG_WEBAPP_URL}
            )
        ],
        [
            InlineKeyboardButton(
                "📅 Agendar Cita", 
                web_app={"url": APPOINTMENTS_WEBAPP_URL}
            )
        ],
        [
            InlineKeyboardButton("Volver", callback_data="back_to_main")
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_admin_keyboard():
    """Retorna el teclado para administradores"""
    keyboard = [
        [
            InlineKeyboardButton(
                "🖥️ Panel de Administración", 
                web_app={"url": ADMIN_WEBAPP_URL}
            )
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

###########################################
# ESTADOS PARA CONVERSACIONES
###########################################

# Estados para el formulario de usuario
NAME, PHONE, EMAIL, ADDRESS = range(4)

###########################################
# MANEJADORES PARA COMANDOS Y CALLBACKS
###########################################

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el comando /start"""
    user_id = update.effective_user.id
    username = update.effective_user.username
    
    logger.info(f"Comando /start recibido de usuario: {user_id} ({username})")
    
    # Comprobar si el usuario existe en la base de datos
    if not user_exists(user_id):
        logger.info(f"Usuario {user_id} no existe, iniciando registro")
        await update.message.reply_text(
            f"¡Hola {username}! Bienvenido a nuestra tienda de ropa. "
            f"Para comenzar, necesito algunos datos básicos."
        )
        # Iniciar conversación para recopilar datos
        await update.message.reply_text("Por favor, introduce tu nombre completo:")
        return NAME
    else:
        logger.info(f"Usuario {user_id} ya existe, mostrando menú principal")
        user_data = get_user(user_id)
        
        # Verificar si el usuario es administrador
        is_admin = user_id in ADMIN_USER_IDS or (user_data and user_data.get('is_admin', False))
        
        # Utilizar reply_text con reply_markup para mostrar el teclado
        keyboard = get_main_keyboard(is_admin)
        await update.message.reply_text(
            f"¡Bienvenido de nuevo, {user_data['name']}! ¿En qué puedo ayudarte hoy?",
            reply_markup=keyboard
        )
        # Mostrar el teclado con los botones de WebApp
        webapp_keyboard = get_webapp_keyboard()
        await update.message.reply_text(
            "También puedes acceder directamente a nuestras aplicaciones:",
            reply_markup=webapp_keyboard
        )
        return ConversationHandler.END

async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el comando /admin"""
    user_id = update.effective_user.id
    
    # Verificar si el usuario es administrador
    if user_id in ADMIN_USER_IDS:
        keyboard = get_admin_keyboard()
        await update.message.reply_text(
            "Panel de Administración. Selecciona una opción:",
            reply_markup=keyboard
        )
    else:
        await update.message.reply_text("No tienes permisos para acceder a esta función.")

async def handle_user_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el botón de información del usuario"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    user_data = get_user(user_id)
    
    if user_data:
        # Mostrar información del usuario con opción para editar
        keyboard = [
            [InlineKeyboardButton("Editar información", callback_data="edit_info")],
            [InlineKeyboardButton("Volver", callback_data="back_to_main")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(
            f"📝 *Tu información*\n\n"
            f"*Nombre:* {user_data['name']}\n"
            f"*Teléfono:* {user_data['phone']}\n"
            f"*Email:* {user_data['email']}\n"
            f"*Dirección:* {user_data['address']}\n",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
    else:
        # Iniciar formulario si no hay datos
        await query.edit_message_text("Vamos a registrar tus datos. ¿Cuál es tu nombre completo?")
        return NAME

async def user_info_form(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Inicia el formulario para recopilar información del usuario"""
    logger.info("Iniciando formulario de registro")
    await update.message.reply_text("Por favor, introduce tu nombre completo:")
    return NAME  

async def name_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido nombre: {update.message.text}")
    context.user_data['name'] = update.message.text
    await update.message.reply_text("Gracias. Ahora necesito tu número de teléfono:")
    return PHONE

async def phone_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido teléfono: {update.message.text}")
    context.user_data['phone'] = update.message.text
    await update.message.reply_text("Perfecto. Ahora tu correo electrónico:")
    return EMAIL

async def email_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibido email: {update.message.text}")
    context.user_data['email'] = update.message.text
    await update.message.reply_text("Por último, necesito tu dirección de entrega:")
    return ADDRESS

async def address_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    logger.info(f"Recibida dirección: {update.message.text}")
    user_id = update.effective_user.id
    context.user_data['address'] = update.message.text
    
    # Guardar datos del usuario
    save_success = save_user(
        user_id, 
        context.user_data['name'], 
        context.user_data['phone'], 
        context.user_data['email'], 
        context.user_data['address']
    )
    
    logger.info(f"Usuario guardado con éxito: {save_success}")
    
    # Verificar si el usuario es administrador
    is_admin = user_id in ADMIN_USER_IDS
    
    # Mostrar teclado principal
    keyboard = get_main_keyboard(is_admin)
    
    if save_success:
        await update.message.reply_text(
            "¡Gracias! Tus datos han sido guardados correctamente.",
            reply_markup=keyboard
        )
        
        # NO intentes enviar los botones WebApp hasta que tengas una URL HTTPS
        if BASE_URL.startswith("https://"):
            # Mostrar botones de WebApp solo si tenemos HTTPS
            webapp_keyboard = get_webapp_keyboard()
            await update.message.reply_text(
                "Puedes acceder a nuestros servicios usando estos botones:",
                reply_markup=webapp_keyboard
            )
    else:
        # Manejar el error de guardado
        await update.message.reply_text(
            "Hubo un problema al guardar tus datos. Por favor, intenta nuevamente más tarde.",
            reply_markup=keyboard
        )
    
    return ConversationHandler.END

async def handle_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el botón de ayuda"""
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "🔍 *Centro de Ayuda*\n\n"
        "Aquí encontrarás información útil sobre cómo usar nuestro bot:\n\n"
        "• Para ver el catálogo: Toca en 'Catálogo'\n"
        "• Para agendar una cita: Toca en 'Agendar Cita'\n"
        "• Para ver tus datos: Toca en 'Información del Cliente'\n"
        "• Para contactarnos: Toca en 'Contacto'\n\n"
        "Si tienes dudas adicionales, no dudes en contactarnos.",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def handle_contact(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para el botón de contacto"""
    query = update.callback_query
    await query.answer()
    
    keyboard = [
        [InlineKeyboardButton("Volver", callback_data="back_to_main")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        "📞 *Información de Contacto*\n\n"
        "Puedes contactarnos a través de los siguientes medios:\n\n"
        "📱 *Teléfono*: +34 912345678\n"
        "📧 *Email*: info@tiendaropa.com\n"
        "🏠 *Dirección*: Calle Principal 123, Madrid\n\n"
        "Horario de atención:\n"
        "Lunes a Viernes: 10:00 - 19:00\n"
        "Sábados: 10:00 - 14:00",
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )

async def back_to_main(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para volver al menú principal"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    
    # Verificar si el usuario es administrador
    is_admin = user_id in ADMIN_USER_IDS or (get_user(user_id) and get_user(user_id).get('is_admin', False))
    
    # Mostrar teclado principal
    keyboard = get_main_keyboard(is_admin)
    await query.message.reply_text(
        "¿En qué puedo ayudarte hoy?",
        reply_markup=keyboard
    )
    
    # Mostrar opciones de WebApps
    webapp_keyboard = get_webapp_keyboard()
    await query.message.reply_text(
        "Puedes acceder a nuestros servicios:",
        reply_markup=webapp_keyboard
    )
    
    # Eliminar el mensaje anterior con los botones inline
    await query.message.delete()

async def handle_text_messages(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Manejador para mensajes de texto que coinciden con los botones del teclado"""
    text = update.message.text
    user_id = update.effective_user.id
    

     # Manejar botón de Panel Admin
    if "Panel Admin" in text:
        # Verificar que el usuario realmente sea admin (seguridad adicional)
        if user_id in ADMIN_USER_IDS or (get_user(user_id) and get_user(user_id).get('is_admin', False)):
            keyboard = get_admin_keyboard()
            await update.message.reply_text(
                "🔐 *Panel de Administración*\n\n"
                "Selecciona una opción:",
                reply_markup=keyboard,
                parse_mode='Markdown'
            )
        else:
            # Por seguridad, aunque no debería ocurrir
            await update.message.reply_text("No tienes permisos para acceder a esta función.")
        return
    
    if "Información" in text:
        user_id = update.effective_user.id
        user_data = get_user(user_id)
        
        if user_data:
            # Mostrar información del usuario
            await update.message.reply_text(
                f"📝 *Tu información*\n\n"
                f"*Nombre:* {user_data['name']}\n"
                f"*Teléfono:* {user_data['phone']}\n"
                f"*Email:* {user_data['email']}\n"
                f"*Dirección:* {user_data['address']}\n",
                parse_mode='Markdown'
            )
        else:
            # Iniciar formulario si no hay datos
            await update.message.reply_text("No tenemos tus datos registrados. Por favor, escribe /start para registrarte.")
    
    elif "Catálogo" in text:
        keyboard = [
            [InlineKeyboardButton("Ver Catálogo", web_app={"url": CATALOG_WEBAPP_URL})]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "Puedes explorar nuestro catálogo haciendo clic en el botón a continuación:",
            reply_markup=reply_markup
        )
    
    elif "Agendar Cita" in text:
        keyboard = [
            [InlineKeyboardButton("Agendar Cita", web_app={"url": APPOINTMENTS_WEBAPP_URL})]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "Puedes agendar una cita haciendo clic en el botón a continuación:",
            reply_markup=reply_markup
        )
    
    elif "Ayuda" in text:
        await update.message.reply_text(
            "🔍 *Centro de Ayuda*\n\n"
            "Aquí encontrarás información útil sobre cómo usar nuestro bot:\n\n"
            "• Para ver el catálogo: Toca en 'Catálogo'\n"
            "• Para agendar una cita: Toca en 'Agendar Cita'\n"
            "• Para ver tus datos: Toca en 'Información'\n"  # Corregido
            "• Para contactarnos: Toca en 'Contacto'\n\n"
            "Si tienes dudas adicionales, no dudes en contactarnos.",
            parse_mode='Markdown'
        )
    
    elif "Contacto" in text:
        await update.message.reply_text(
            "📞 *Información de Contacto*\n\n"
            "Puedes contactarnos a través de los siguientes medios:\n\n"
            "📱 *Teléfono*: +34 912345678\n"
            "📧 *Email*: info@tiendaropa.com\n"
            "🏠 *Dirección*: Calle Principal 123, Madrid\n\n"
            "Horario de atención:\n"
            "Lunes a Viernes: 10:00 - 19:00\n"
            "Sábados: 10:00 - 14:00",
            parse_mode='Markdown'
        )

###########################################
# FUNCIÓN PRINCIPAL
###########################################

def main():
    # Inicializar la base de datos
    init_db()
    
    # Crear la aplicación
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    
    # 1. PRIMERO: Registrar comandos y callbacks específicos
    application.add_handler(CommandHandler("admin", admin_command))
    application.add_handler(CallbackQueryHandler(back_to_main, pattern="^back_to_main$"))
    application.add_handler(CallbackQueryHandler(handle_help, pattern="^help$"))
    application.add_handler(CallbackQueryHandler(handle_contact, pattern="^contact$"))
    application.add_handler(CallbackQueryHandler(handle_user_info, pattern="^user_info$"))
    
    # 2. SEGUNDO: Registrar el ConversationHandler
    conv_handler = ConversationHandler(
        entry_points=[CommandHandler("start", start_command)],
        states={
            NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, name_handler)],
            PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, phone_handler)],
            EMAIL: [MessageHandler(filters.TEXT & ~filters.COMMAND, email_handler)],
            ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, address_handler)],
        },
        fallbacks=[CommandHandler("cancel", lambda u, c: ConversationHandler.END)],
        name="user_registration",
        persistent=False
    )
    application.add_handler(conv_handler)
    
    # 3. ÚLTIMO: Registrar el handler de mensajes de texto general
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND, 
        handle_text_messages
    ))
    
    # Iniciar el bot
    logger.info("Bot iniciado. Presiona Ctrl+C para detener.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()