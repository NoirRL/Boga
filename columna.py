import sqlite3

# Telegram ID del usuario que será superadmin (debe coincidir con SUPER_ADMIN_USER_IDS en bot_main.py)
TELEGRAM_ID = 1870169979

# Conectar a la base de datos
conn = sqlite3.connect('./store_bot.db')
cursor = conn.cursor()

try:
    # Verificar si el usuario existe
    cursor.execute("SELECT id, name FROM users WHERE telegram_id = ?", (TELEGRAM_ID,))
    user = cursor.fetchone()
    
    if not user:
        print(f"❌ Error: No se encontró ningún usuario con Telegram ID {TELEGRAM_ID}")
    else:
        # Actualizar el usuario como admin y superadmin
        cursor.execute(
            "UPDATE users SET is_admin = 1, is_super_admin = 1 WHERE telegram_id = ?", 
            (TELEGRAM_ID,)
        )
        conn.commit()
        print(f"✅ ¡Éxito! El usuario {user[1]} (ID: {user[0]}) ahora es superadministrador")
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    conn.close()
    print("ℹ️ Conexión cerrada")