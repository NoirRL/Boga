// Variables globales
let cart = [];
let selectedSize = null;
let selectedColor = null;
let purchaseHistory = null; // Historial de compras del usuario

// Cargar carrito desde localStorage al iniciar
document.addEventListener('DOMContentLoaded', async () => {
  loadCart();
  updateCartIcon();
  
  // Verificar bibliotecas necesarias
  Utils.loadRequiredLibraries().then(success => {
    if (!success) {
      console.warn('Algunas funcionalidades de facturas pueden no estar disponibles');
    }
  });
  
  // Cargar historial de compras del usuario
  await loadPurchaseHistory();
  
  // Listener para el botón de mostrar carrito
  const cartIcon = document.getElementById('cart-icon');
  if (cartIcon) {
    cartIcon.addEventListener('click', showCart);
  }
  
  // Listeners para los botones del carrito
  const emptyCartBtn = document.getElementById('empty-cart');
  if (emptyCartBtn) {
    emptyCartBtn.addEventListener('click', emptyCart);
  }
  
  const generateInvoiceBtn = document.getElementById('generate-invoice');
  if (generateInvoiceBtn) {
    generateInvoiceBtn.addEventListener('click', proceedToCheckout);
  }
  
  // Listeners para cerrar modales
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });
});

// Cargar historial de compras
async function loadPurchaseHistory() {
  try {
    // Obtener información del usuario de Telegram
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!telegramUser || !telegramUser.id) {
      console.warn('No se pudo obtener información del usuario');
      return;
    }
    
    // Realizar petición a la API para obtener historial de compras
    const response = await fetch(`${window.location.origin}/api/invoices/user`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Telegram-ID': telegramUser.id.toString()
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error al obtener historial: ${response.status}`);
    }
    
    const invoices = await response.json();
    
    // Procesar el historial para facilitar las validaciones
    processInvoices(invoices);
    
  } catch (error) {
    console.error('Error al cargar historial de compras:', error);
    // Inicializar un historial vacío para no impedir el funcionamiento
    purchaseHistory = { productCounts: {}, totalPurchases: 0 };
  }
}

// Procesar facturas para obtener información relevante para validaciones
function processInvoices(invoices) {
  const productCounts = {};
  let totalPurchases = 0;
  
  if (Array.isArray(invoices)) {
    // Solo considerar facturas completadas
    const completedInvoices = invoices.filter(inv => inv.status === 'completed');
    
    completedInvoices.forEach(invoice => {
      if (Array.isArray(invoice.items)) {
        invoice.items.forEach(item => {
          const productId = item.id;
          const quantity = item.quantity || 0;
          
          if (!productCounts[productId]) {
            productCounts[productId] = 0;
          }
          
          productCounts[productId] += quantity;
          totalPurchases += quantity;
        });
      }
    });
  }
  
  purchaseHistory = { productCounts, totalPurchases };
  console.log('Historial de compras cargado:', purchaseHistory);
}

// Cargar carrito desde localStorage
function loadCart() {
  try {
    const savedCart = localStorage.getItem('shoppingCart');
    if (savedCart) {
      cart = JSON.parse(savedCart);
      if (!Array.isArray(cart)) cart = [];
    }
  } catch (e) {
    console.error('Error al cargar carrito:', e);
    cart = [];
  }
}

// Guardar carrito en localStorage
function saveCart() {
  try {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
    updateCartIcon();
  } catch (e) {
    console.error('Error al guardar carrito:', e);
  }
}

// Actualizar ícono del carrito con la cantidad de productos
function updateCartIcon() {
  const cartCounter = document.getElementById('cart-counter');
  if (!cartCounter) return;
  
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
  
  if (totalItems > 0) {
    cartCounter.textContent = totalItems;
    cartCounter.classList.add('active');
  } else {
    cartCounter.textContent = '';
    cartCounter.classList.remove('active');
  }
}

// Verificar límites de compra según historial y carrito actual - Optimizado
function checkPurchaseLimits(productId, newQuantity) {
  // Si no tenemos historial, permitir la compra pero con límite de 3
  if (!purchaseHistory) {
    return { allowed: newQuantity <= 3, message: newQuantity > 3 ? 
      'No puedes añadir más de 3 unidades del mismo producto en una sola compra' : null };
  }
  
  const historyQuantity = purchaseHistory.productCounts[productId] || 0;
  const totalQuantity = historyQuantity + newQuantity;
  
  // Verificación en orden de prioridad
  
  // 1. Límite global: máximo 20 productos en total (histórico)
  if (purchaseHistory.totalPurchases >= 20) {
    return { 
      allowed: false, 
      message: 'Has alcanzado el límite máximo de compras (20 productos)' 
    };
  }
  
  // 2. Límite por producto: máximo 5 unidades en total (histórico + actual)
  if (totalQuantity > 5) {
    const remaining = Math.max(0, 5 - historyQuantity);
    return { 
      allowed: false, 
      message: historyQuantity >= 5 ?
        'Ya has comprado el máximo de 5 unidades de este producto anteriormente' :
        `Solo puedes comprar ${remaining} unidad(es) más de este producto` 
    };
  }
  
  // 3. Límite por sesión: máximo 3 unidades por compra
  if (newQuantity > 3) {
    return { 
      allowed: false, 
      message: 'No puedes añadir más de 3 unidades del mismo producto en una sola compra' 
    };
  }
  
  // Todo en regla
  return { allowed: true, message: null };
}

// Añadir producto al carrito con validaciones mejoradas
function addToCart(product, quantity = 1, size = null, color = null) {
  // Validar cantidad
  if (quantity <= 0) {
    showToast('La cantidad debe ser mayor que cero');
    return false;
  }
  
  // Validar stock disponible
  if (product.stock <= 0) {
    showToast('Este producto está agotado');
    return false;
  }
  
  if (quantity > product.stock) {
    showToast(`Solo hay ${product.stock} unidades disponibles`);
    return false;
  }
  
  // Validar talla y color si son requeridos
  if (product.sizes && product.sizes.length > 0 && !size) {
    showToast('Por favor, selecciona una talla');
    return false;
  }
  
  if (product.colors && product.colors.length > 0 && !color) {
    showToast('Por favor, selecciona un color');
    return false;
  }
  
  // Buscar si el producto ya está en el carrito con la misma talla y color
  const existingItemIndex = cart.findIndex(item => 
    item.id === product.id && 
    item.size === size && 
    item.color === color
  );
  
  // Determinar la nueva cantidad total
  let newQuantity = quantity;
  if (existingItemIndex !== -1) {
    newQuantity = cart[existingItemIndex].quantity + quantity;
  }
  
  // Verificar límites de compra según historial
  const purchaseLimitCheck = checkPurchaseLimits(product.id, newQuantity);
  
  if (!purchaseLimitCheck.allowed) {
    showToast(purchaseLimitCheck.message);
    return false;
  }
  
  // Todo en orden, proceder a añadir al carrito
  if (existingItemIndex !== -1) {
    // Actualizar cantidad si ya existe
    cart[existingItemIndex].quantity = newQuantity;
  } else {
    // Añadir nuevo item
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      quantity: quantity,
      size: size,
      color: color,
      stock: product.stock
    });
  }
  
  // Guardar carrito y mostrar mensaje
  saveCart();
  showToast(`${product.name} añadido al carrito`);
  
  // Cerrar modal de producto si está abierto
  const productModal = document.getElementById('product-modal');
  if (productModal && productModal.classList.contains('show')) {
    productModal.classList.remove('show');
  }
  
  return true;
}

// Mostrar contenido del carrito
function showCart() {
  const cartModal = document.getElementById('cart-modal');
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  
  if (!cartModal || !cartItems || !cartTotal) return;
  
  renderCartItems();
  cartModal.classList.add('show');
}

// Renderizar items del carrito
function renderCartItems() {
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const cartEmpty = document.getElementById('cart-empty');
  const cartSummary = document.getElementById('cart-summary');
  
  if (!cartItems || !cartTotal) return;
  
  // Limpiar contenido actual
  cartItems.innerHTML = '';
  
  // Verificar si el carrito está vacío
  if (cart.length === 0) {
    if (cartEmpty) cartEmpty.style.display = 'block';
    if (cartSummary) cartSummary.style.display = 'none';
    return;
  }
  
  // Ocultar mensaje de carrito vacío y mostrar resumen
  if (cartEmpty) cartEmpty.style.display = 'none';
  if (cartSummary) cartSummary.style.display = 'block';
  
  // Crear fragmento para mejor rendimiento
  const fragment = document.createDocumentFragment();
  
  // Renderizar cada item
  cart.forEach((item, index) => {
    const itemElement = document.createElement('div');
    itemElement.className = 'cart-item';
    
    // Preparar texto de variantes
    let variantText = '';
    if (item.size || item.color) {
      let variants = [];
      if (item.size) variants.push(`Talla: ${item.size}`);
      if (item.color) variants.push(`Color: ${item.color}`);
      variantText = `<div class="cart-item-variant">${variants.join(' - ')}</div>`;
    }
    
    // Calcular subtotal
    const subtotal = (item.price * item.quantity).toFixed(2);
    
    itemElement.innerHTML = `
      <div class="cart-item-image">
        <img src="${item.image_url || 'https://via.placeholder.com/80x80?text=Producto'}" alt="${item.name}">
      </div>
      <div class="cart-item-details">
        <div class="cart-item-name">${item.name}</div>
        ${variantText}
        <div class="cart-item-price">€${parseFloat(item.price).toFixed(2)}</div>
      </div>
      <div class="cart-item-quantity">
        <button class="quantity-btn minus" data-index="${index}">-</button>
        <input type="number" value="${item.quantity}" min="1" max="${Math.min(item.stock, 3)}" class="quantity-input" data-index="${index}">
        <button class="quantity-btn plus" data-index="${index}">+</button>
      </div>
      <div class="cart-item-subtotal">€${subtotal}</div>
      <button class="remove-item" data-index="${index}">&times;</button>
    `;
    
    fragment.appendChild(itemElement);
  });
  
  // Añadir todos los items de una vez
  cartItems.appendChild(fragment);
  
  // Calcular y mostrar total
  const total = calculateCartTotal();
  cartTotal.textContent = `€${total.toFixed(2)}`;
  
  // Añadir event listeners a los botones
  attachCartItemEvents();
}

// Añadir event listeners a los elementos del carrito
function attachCartItemEvents() {
  document.querySelectorAll('.remove-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      removeCartItem(index);
    });
  });
  
  document.querySelectorAll('.quantity-btn.minus').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      updateCartItemQuantityByIndex(index, cart[index].quantity - 1);
    });
  });
  
  document.querySelectorAll('.quantity-btn.plus').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.index);
      updateCartItemQuantityByIndex(index, cart[index].quantity + 1);
    });
  });
  
  document.querySelectorAll('.quantity-input').forEach(input => {
    input.addEventListener('change', () => {
      const index = parseInt(input.dataset.index);
      const quantity = parseInt(input.value);
      updateCartItemQuantityByIndex(index, quantity);
    });
  });
}

// Cerrar modal del carrito
function closeCartModal() {
  const cartModal = document.getElementById('cart-modal');
  if (cartModal) {
    cartModal.classList.remove('show');
  }
}

// Eliminar item del carrito por índice
function removeCartItem(index) {
  if (index >= 0 && index < cart.length) {
    cart.splice(index, 1);
    saveCart();
    renderCartItems();
    showToast('Producto eliminado del carrito');
  }
}

// Actualizar cantidad de un ítem en el carrito por índice
function updateCartItemQuantityByIndex(index, quantity) {
  if (index < 0 || index >= cart.length) return false;
  
  const item = cart[index];
  
  // Validar cantidad
  if (quantity <= 0) {
    removeCartItem(index);
    return true;
  }
  
  // Validar stock disponible
  if (quantity > item.stock) {
    showToast(`Solo hay ${item.stock} unidades disponibles`);
    return false;
  }
  
  // Validar límites de compra según historial
  const purchaseLimitCheck = checkPurchaseLimits(item.id, quantity);
  
  if (!purchaseLimitCheck.allowed) {
    showToast(purchaseLimitCheck.message);
    return false;
  }
  
  // Actualizar cantidad
  item.quantity = quantity;
  saveCart();
  renderCartItems();
  
  return true;
}

// Vaciar carrito
function emptyCart() {
  cart = [];
  saveCart();
  renderCartItems();
}

// Calcular total del carrito
function calculateCartTotal() {
  return cart.reduce((total, item) => {
    return total + (parseFloat(item.price) * item.quantity);
  }, 0);
}

// Mostrar mensaje toast
function showToast(message, duration = 3000) {
  let toastContainer = document.getElementById('toast-container');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Mostrar el toast (con animación)
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Eliminar el toast después del tiempo especificado
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
      }
    }, 300); // Tiempo de la animación de salida
  }, duration);
}

// Proceder al checkout
function proceedToCheckout() {
  // Validación del carrito
  if (cart.length === 0) {
    showToast('El carrito está vacío');
    return;
  }
  
  // Validación única de stock e inventario
  const invalidItems = cart.filter(item => item.quantity > item.stock);
  if (invalidItems.length > 0) {
    showToast(`Algunos productos no tienen stock suficiente: ${invalidItems.map(item => item.name).join(', ')}`);
    return;
  }
  
  // Validación única de límites de compra
  for (const item of cart) {
    const purchaseLimitCheck = checkPurchaseLimits(item.id, item.quantity);
    if (!purchaseLimitCheck.allowed) {
      showToast(purchaseLimitCheck.message);
      return;
    }
  }
  
  // Proceder con la generación de factura
  generateInvoice();
}

// Generar y enviar factura - Optimizado
async function generateInvoice() {
  try {
    Utils.showLoader();
    
    // Verificar autenticación del usuario de Telegram
    const telegramUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    if (!telegramUser || !telegramUser.id) {
      Utils.showToast('Error: No se pudo identificar al usuario. Por favor, reinicia la aplicación.');
      Utils.hideLoader();
      return;
    }
    
    // Validar que todas las bibliotecas necesarias estén disponibles
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      console.error('Error: jsPDF no está disponible');
      Utils.showToast('No se pueden generar facturas en este momento. Contacta con soporte.');
      Utils.hideLoader();
      return;
    }
    
    // Calcular total
    const subtotal = calculateCartTotal();
    const tax = subtotal * 0.21; // IVA 21%
    const total = subtotal + tax;
    
    // Preparar items para la factura
    const invoiceItems = cart.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      size: item.size || null,
      color: item.color || null,
      image_url: item.image_url || null
    }));
    
    try {
      // Crear la factura en el servidor
      const invoiceData = {
        items: invoiceItems,
        total: total,
        notes: 'Pedido generado desde la webapp'
      };
      
      const response = await fetch(`${window.location.origin}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Telegram-ID': telegramId.toString()
        },
        body: JSON.stringify(invoiceData)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Error del servidor: ${response.status}`;
        throw new Error(errorMessage);
      }
      
      const createdInvoice = await response.json();
      
      if (!createdInvoice || !createdInvoice.id) {
        throw new Error('Formato de respuesta inválido del servidor');
      }
      
      // Generar PDF
      await generateInvoicePdf(createdInvoice, telegramUser);
      
      // Actualizar historial de compras local
      await loadPurchaseHistory();
      
      // Vaciar carrito
      emptyCart();
      
      // Mostrar mensaje de éxito
      Utils.showToast('Factura generada correctamente', 5000);
      
      // Cerrar modal del carrito
      closeCartModal();
      
    } catch (apiError) {
      console.error('Error en API de facturas:', apiError);
      Utils.showToast(`Error al generar factura: ${apiError.message}`);
      throw apiError;
    }
    
  } catch (error) {
    console.error('Error al generar factura:', error);
    Utils.showToast('Error al generar factura. Inténtalo de nuevo más tarde.');
  } finally {
    Utils.hideLoader();
  }
}

// Generar PDF de factura para el usuario - Optimizado
async function generateInvoicePdf(invoice, user) {
  try {
    // Verificar que jsPDF está disponible
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
      await Utils.loadRequiredLibraries();
      
      if (typeof window.jspdf === 'undefined') {
        throw new Error('Biblioteca jsPDF no disponible');
      }
    }
    
    // Crear documento PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Verificar que autoTable está disponible
    if (typeof doc.autoTable === 'undefined') {
      await Utils.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
      if (typeof doc.autoTable === 'undefined') {
        throw new Error('Plugin autoTable no disponible');
      }
    }
    
    // Configurar documento PDF
    setupInvoiceHeader(doc, invoice, user);
    
    // Verificar que los items de la factura son válidos
    if (!invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
      doc.setFontSize(12);
      doc.text('Error: No hay productos en la factura', 105, 100, { align: 'center' });
      doc.save(`factura-${invoice.id}.pdf`);
      return Promise.resolve();
    }
    
    // Generar tabla de productos
    const tableData = prepareInvoiceTableData(invoice.items);
    
    try {
      // Generar tabla
      doc.autoTable({
        head: [["Producto", "Variante", "Precio", "Cantidad", "Total"]],
        body: tableData.rows,
        startY: 80,
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185], textColor: 255 },
        foot: tableData.summaryRows,
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });
      
      // Añadir notas y pie de página
      addInvoiceFooterNotes(doc);
      
      // Guardar PDF
      doc.save(`factura-${invoice.id}.pdf`);
      Utils.showToast('Factura descargada correctamente');
      return Promise.resolve();
      
    } catch (tableError) {
      console.error('Error al generar tabla en PDF:', tableError);
      // Continuar con el documento básico sin tabla
      doc.setFontSize(12);
      doc.text('Error al generar tabla de productos', 105, 100, { align: 'center' });
      doc.save(`factura-${invoice.id}-basic.pdf`);
      return Promise.resolve();
    }
  } catch (error) {
    console.error('Error en generación de PDF:', error);
    Utils.showToast('Error al generar PDF de factura');
    return Promise.reject(error);
  }
}

// Configurar encabezado de la factura
function setupInvoiceHeader(doc, invoice, user) {
  // Título
  doc.setFontSize(20);
  doc.text(`Factura #${invoice.id}`, 105, 20, { align: 'center' });
  
  // Formatear fecha con manejo seguro
  let formattedDate = 'Fecha no disponible';
  try {
    const date = new Date(invoice.created_at);
    if (!isNaN(date.getTime())) {
      formattedDate = date.toLocaleDateString('es-ES');
    }
  } catch (e) {
    console.error('Error al formatear fecha para PDF:', e);
  }
  
  doc.setFontSize(10);
  doc.text(`Fecha: ${formattedDate}`, 20, 30);
  doc.text(`Estado: Pendiente`, 20, 35);
  
  // Información de la tienda
  doc.setFontSize(12);
  doc.text('Tienda de Ropa', 150, 30, { align: 'right' });
  doc.setFontSize(10);
  doc.text('Calle Principal 123, Madrid', 150, 35, { align: 'right' });
  doc.text('Email: info@tiendaropa.com', 150, 40, { align: 'right' });
  doc.text('Teléfono: +34 912345678', 150, 45, { align: 'right' });
  
  // Línea separadora
  doc.setLineWidth(0.5);
  doc.line(20, 50, 190, 50);
  
  // Información del cliente
  doc.setFontSize(12);
  doc.text('Cliente', 20, 60);
  doc.setFontSize(10);
  
  // Verificar que los datos del usuario son válidos
  if (user && typeof user === 'object') {
    const userName = (user.first_name || '') + ' ' + (user.last_name || '');
    doc.text(`Nombre: ${userName.trim() || 'No disponible'}`, 20, 65);
    doc.text(`ID Telegram: ${user.id || 'No disponible'}`, 20, 70);
  } else {
    doc.text('Datos de cliente no disponibles', 20, 65);
  }
}

// Preparar datos de tabla para la factura
function prepareInvoiceTableData(items) {
  const rows = [];
  let subtotal = 0;
  
  items.forEach(item => {
    // Verificar que el ítem tiene estructura válida
    if (!item || typeof item !== 'object') return;
    
    const itemPrice = parseFloat(item.price) || 0;
    const itemQuantity = parseInt(item.quantity) || 0;
    const itemTotal = itemPrice * itemQuantity;
    subtotal += itemTotal;
    
    // Variantes
    let variant = 'N/A';
    if (item.size || item.color) {
      const variants = [];
      if (item.size) variants.push(`Talla: ${item.size}`);
      if (item.color) variants.push(`Color: ${item.color}`);
      variant = variants.join(', ');
    }
    
    rows.push([
      item.name || 'Producto sin nombre',
      variant,
      `€${itemPrice.toFixed(2)}`,
      itemQuantity,
      `€${itemTotal.toFixed(2)}`
    ]);
  });
  
  // IVA y total
  const tax = subtotal * 0.21;
  const total = subtotal + tax;
  
  // Filas de resumen para el pie de tabla
  const summaryRows = [
    ["", "", "", "Subtotal", `€${subtotal.toFixed(2)}`],
    ["", "", "", "IVA (21%)", `€${tax.toFixed(2)}`],
    ["", "", "", "Total", `€${total.toFixed(2)}`]
  ];
  
  return { rows, summaryRows, subtotal, tax, total };
}

// Añadir notas y pie de página a la factura
function addInvoiceFooterNotes(doc) {
  try {
    // Notas importantes
    const finalY = doc.lastAutoTable?.finalY + 20 || 130;
    doc.setFontSize(12);
    doc.text('Información importante', 20, finalY);
    doc.setFontSize(10);
    doc.text('• Esta factura es una simulación para fines educativos.', 20, finalY + 10);
    doc.text('• No tiene validez legal ni fiscal.', 20, finalY + 18);
    doc.text('• Los productos no serán enviados realmente.', 20, finalY + 26);
    
    // Contacto
    doc.text('Para cualquier consulta, contáctanos a través del bot de Telegram.', 20, finalY + 40);
    
    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, 190, 286, { align: 'right' });
      doc.text('Simulación de factura - No válida para fines fiscales', 105, 286, { align: 'center' });
    }
  } catch (error) {
    console.error('Error al añadir notas a la factura:', error);
  }
}

// Función auxiliar para cargar scripts dinámicamente
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Error cargando script: ${url}`));
    document.head.appendChild(script);
  });
}

// Verificar y cargar bibliotecas necesarias al inicio
async function checkRequiredLibraries() {
  try {
    // Verificar si jsPDF ya está cargado
    if (typeof window.jspdf === 'undefined') {
      console.warn('jsPDF no está cargado, intentando cargar automáticamente...');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    
    // Verificar si autoTable ya está cargado (después de cargar jsPDF)
    if (window.jspdf && typeof window.jspdf.jsPDF.prototype.autoTable === 'undefined') {
      console.warn('jspdf-autotable no está cargado, intentando cargar automáticamente...');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
    }
    
    console.log('Bibliotecas para facturas verificadas correctamente');
    return true;
  } catch (error) {
    console.error('Error cargando bibliotecas necesarias:', error);
    return false;
  }
}

// Funciones de carga
function showLoader() {
  let loader = document.getElementById('loader');
  
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'loader';
    loader.className = 'loader-container';
    loader.innerHTML = '<div class="loader"></div>';
    document.body.appendChild(loader);
  }
  
  loader.style.display = 'flex';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// Verificar límites de compra según historial y carrito actual
function checkPurchaseLimits(productId, newQuantity) {
  // Si no tenemos historial, permitir la compra pero con límite de 3
  if (!purchaseHistory) {
    return { allowed: newQuantity <= 3, message: newQuantity > 3 ? 
      'No puedes añadir más de 3 unidades del mismo producto en una sola compra' : null };
  }
  
  const historyQuantity = purchaseHistory.productCounts[productId] || 0;
  const totalQuantity = historyQuantity + newQuantity;
  
  // Verificación en orden de prioridad
  
  // 1. Límite global: máximo 20 productos en total (histórico)
  if (purchaseHistory.totalPurchases >= 20) {
    return { 
      allowed: false, 
      message: 'Has alcanzado el límite máximo de compras (20 productos)' 
    };
  }
  
  // 2. Límite por producto: máximo 5 unidades en total (histórico + actual)
  if (totalQuantity > 5) {
    const remaining = Math.max(0, 5 - historyQuantity);
    return { 
      allowed: false, 
      message: historyQuantity >= 5 ?
        'Ya has comprado el máximo de 5 unidades de este producto anteriormente' :
        `Solo puedes comprar ${remaining} unidad(es) más de este producto` 
    };
  }
  
  // 3. Límite por sesión: máximo 3 unidades por compra
  if (newQuantity > 3) {
    return { 
      allowed: false, 
      message: 'No puedes añadir más de 3 unidades del mismo producto en una sola compra' 
    };
  }
  
  // Todo en regla
  return { allowed: true, message: null };
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  loadCart();
  updateCartIcon();
  
  // Verificar bibliotecas necesarias
  Utils.loadRequiredLibraries().then(success => {
    if (!success) {
      console.warn('Algunas funcionalidades de facturas pueden no estar disponibles');
    }
  });
  
  // Cargar historial de compras del usuario
  await loadPurchaseHistory();
  
  // Listener para el botón de mostrar carrito
  const cartIcon = document.getElementById('cart-icon');
  if (cartIcon) {
    cartIcon.addEventListener('click', showCart);
  }
  
  // Listeners para los botones del carrito
  const emptyCartBtn = document.getElementById('empty-cart');
  if (emptyCartBtn) {
    emptyCartBtn.addEventListener('click', emptyCart);
  }
  
  const generateInvoiceBtn = document.getElementById('generate-invoice');
  if (generateInvoiceBtn) {
    generateInvoiceBtn.addEventListener('click', proceedToCheckout);
  }
  
  // Listeners para cerrar modales
  document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', function() {
      const modal = this.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });
});