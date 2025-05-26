// Variables globales
let invoices = [];
let currentInvoice = null;
let filteredInvoices = [];

// Elementos DOM
const dateFromInput = document.getElementById('date-from');
const dateToInput = document.getElementById('date-to');
const statusFilter = document.getElementById('status-filter');
const applyFiltersBtn = document.getElementById('apply-filters');
const invoicesList = document.getElementById('invoices-list');
const invoiceDetailsModal = document.getElementById('invoice-details-modal');
const customerDetailsModal = document.getElementById('customer-details-modal');
const invoiceDetails = document.getElementById('invoice-details');
const customerDetails = document.getElementById('customer-details');
const downloadInvoiceBtn = document.getElementById('download-invoice-btn');
const completeInvoiceBtn = document.getElementById('complete-invoice-btn');
const cancelInvoiceBtn = document.getElementById('cancel-invoice-btn');
const loader = document.getElementById('loader');
const notification = document.getElementById('notification');

// Funciones específicas para facturas
function getStatusInfo(status) {
  switch (status) {
    case 'pending':
      return { class: 'status-pending', text: 'Pendiente' };
    case 'completed':
      return { class: 'status-completed', text: 'Completada' };
    case 'cancelled':
      return { class: 'status-cancelled', text: 'Cancelada' };
    default:
      return { class: 'status-unknown', text: 'Desconocido' };
  }
}

// Inicialización - esta función será llamada desde main.js
function loadInvoices() {
  try {
    Utils.showLoader();
    
    // Inicializar filtros de fecha
    initDateFilters();
    
    // Cargar facturas desde API
    getInvoices()
      .then(data => {
        invoices = data;
        filteredInvoices = [...invoices];
        filterInvoices();
        renderInvoices();
        Utils.hideLoader();
      })
      .catch(error => {
        console.error('Error al cargar facturas:', error);
        Utils.showNotification('Error al cargar facturas. Por favor, intenta de nuevo.', 'error');
        Utils.hideLoader();
      });
  } catch (error) {
    handleError(error);
  }
}

// Inicializar filtros de fecha
function initDateFilters() {
  // Establecer fecha por defecto: Últimos 30 días
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  dateFromInput.value = formatDateForInput(thirtyDaysAgo);
  dateToInput.value = formatDateForInput(today);
}

// Formatear fecha para input
function formatDateForInput(date) {
  if (!(date instanceof Date)) return '';
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Manejar errores
function handleError(error) {
  console.error('Error en módulo de facturas:', error);
  Utils.hideLoader();
  Utils.showNotification('Ha ocurrido un error. Por favor, intenta nuevamente.', 'error');
}

// Ejecutar operación API con manejo de errores estandarizado
async function executeApiCall(apiCall, errorMessage) {
  try {
    const result = await apiCall();
    return result;
  } catch (error) {
    console.error(errorMessage, error);
    Utils.showNotification(error.message || errorMessage, 'error');
    throw error;
  }
}

// Configurar event listeners
function setupInvoicesEventListeners() {
  // Botón de aplicar filtros
  applyFiltersBtn.addEventListener('click', () => {
    filterInvoices();
    renderInvoices();
  });
  
  // Cerrar modales
  document.querySelectorAll('#invoice-details-modal .close-button, #customer-details-modal .close-button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('show');
    });
  });
  
  // Eventos de filtro para aplicar al presionar Enter
  [dateFromInput, dateToInput].forEach(input => {
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        filterInvoices();
        renderInvoices();
      }
    });
  });
  
  statusFilter.addEventListener('change', function() {
    filterInvoices();
    renderInvoices();
  });
  
  // Botones de acción en modal de factura
  downloadInvoiceBtn.addEventListener('click', function() {
    if (currentInvoice) {
      try {
        generateInvoicePdf(currentInvoice);
      } catch (error) {
        console.error('Error al descargar factura desde detalles:', error);
        Utils.showNotification('Error al generar PDF', 'error');
      }
    }
  });
  
  // Completar factura
  completeInvoiceBtn.addEventListener('click', function() {
    if (currentInvoice && confirm('¿Marcar esta factura como completada?')) {
      changeInvoiceStatus(currentInvoice.id, 'completed');
    }
  });
  
  // Cancelar factura
  cancelInvoiceBtn.addEventListener('click', function() {
    if (currentInvoice && confirm('¿Estás seguro de cancelar esta factura?')) {
      changeInvoiceStatus(currentInvoice.id, 'cancelled');
    }
  });
}

// Obtener facturas con filtros
async function getInvoices() {
  return executeApiCall(
    async () => {
      const response = await fetch('/api/invoices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }
      
      return await response.json();
    },
    'Error al obtener facturas'
  );
}

// Obtener una factura específica
async function getInvoice(id) {
  return executeApiCall(
    async () => {
      const response = await fetch(`/api/invoices/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error del servidor: ${response.status}`);
      }
      
      return await response.json();
    },
    `Error al obtener factura ${id}`
  );
}

// Filtrar facturas según criterios
function filterInvoices() {
  const dateFrom = dateFromInput.value ? new Date(dateFromInput.value) : null;
  const dateTo = dateToInput.value ? new Date(dateToInput.value + 'T23:59:59') : null;
  const status = statusFilter.value;
  
  filteredInvoices = invoices.filter(invoice => {
    if (!invoice) return false;
    
    const invoiceDate = new Date(invoice.created_at);
    const matchesDateFrom = !dateFrom || invoiceDate >= dateFrom;
    const matchesDateTo = !dateTo || invoiceDate <= dateTo;
    const matchesStatus = !status || invoice.status === status;
    
    return matchesDateFrom && matchesDateTo && matchesStatus;
  });
}

// Renderizar facturas en la tabla
function renderInvoices() {
  // Limpiar tabla
  invoicesList.innerHTML = '';
  
  if (!filteredInvoices.length) {
    invoicesList.innerHTML = '<tr><td colspan="6" class="text-center">No hay facturas que coincidan con los filtros</td></tr>';
    return;
  }
  
  // Ordenar por fecha (más recientes primero)
  filteredInvoices.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  // Renderizar cada factura
  filteredInvoices.forEach(invoice => {
    if (!invoice) return;
    
    const row = document.createElement('tr');
    const { class: statusClass, text: statusText } = getStatusInfo(invoice.status);
    const clientName = invoice.User && invoice.User.name 
      ? invoice.User.name 
      : `Cliente #${invoice.user_id || 'Desconocido'}`;
    
    row.innerHTML = `
      <td>${invoice.id || 'N/A'}</td>
      <td>
        <a href="#" class="view-customer" data-id="${invoice.id}">${clientName}</a>
      </td>
      <td>${Utils.formatDate(invoice.created_at)}</td>
      <td>${Utils.formatCurrency(invoice.total_amount || invoice.total)}</td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td class="actions">
        <button class="view-btn" data-id="${invoice.id}">Ver Detalles</button>
        <button class="download-btn" data-id="${invoice.id}">Descargar PDF</button>
      </td>
    `;
    
    invoicesList.appendChild(row);
  });
  
  // Añadir event listeners a los botones
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => viewInvoice(btn.dataset.id));
  });
  
  document.querySelectorAll('.download-btn').forEach(btn => {
    btn.addEventListener('click', () => downloadInvoicePdf(btn.dataset.id));
  });
  
  document.querySelectorAll('.view-customer').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      viewCustomer(link.dataset.id);
    });
  });
}

// Ver detalles de factura
async function viewInvoice(invoiceId) {
  Utils.showLoader();
  try {
    // Si ya está cargada, usar la versión en memoria
    let invoice = invoices.find(inv => inv.id == invoiceId);
    
    // Si no está en memoria o faltan detalles, cargar de la API
    if (!invoice || !invoice.items) {
      invoice = await getInvoice(invoiceId);
      
      // Validar que se obtuvo una respuesta válida
      if (!invoice || typeof invoice !== 'object') {
        throw new Error('Respuesta inválida de la API');
      }
      
      // Actualizar en el array local
      const index = invoices.findIndex(inv => inv.id == invoiceId);
      if (index !== -1) {
        invoices[index] = invoice;
      }
    }
    
    if (!invoice) {
      Utils.showNotification('No se pudo cargar la factura', 'error');
      return;
    }
    
    currentInvoice = invoice;
    
    // Procesar items con validación
    let itemsHtml = '';
    let subtotal = 0;
    
    if (Array.isArray(invoice.items)) {
      invoice.items.forEach(item => {
        if (!item || typeof item !== 'object') return;
        
        const price = parseFloat(item.price) || 0;
        const quantity = parseInt(item.quantity) || 0;
        const itemTotal = price * quantity;
        subtotal += itemTotal;
        
        // Preparar detalles de variantes (talla/color)
        const variantDetails = [];
        if (item.size) variantDetails.push(`Talla: ${item.size}`);
        if (item.color) variantDetails.push(`Color: ${item.color}`);
        const variantText = variantDetails.length ? variantDetails.join(' - ') : '';
        
        itemsHtml += `
          <tr>
            <td>
              <div class="invoice-product">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" class="invoice-product-image">` : ''}
                <div>
                  <div class="invoice-product-name">${item.name || 'Producto sin nombre'}</div>
                  ${variantText ? `<div class="invoice-product-variant">${variantText}</div>` : ''}
                </div>
              </div>
            </td>
            <td>${Utils.formatCurrency(price)}</td>
            <td>${quantity}</td>
            <td>${Utils.formatCurrency(itemTotal)}</td>
          </tr>
        `;
      });
    } else {
      itemsHtml = '<tr><td colspan="4" class="text-center">No hay productos disponibles</td></tr>';
    }
    
    // Calcular IVA (21%)
    const tax = subtotal * 0.21;
    const total = subtotal + tax;
    
    // Definir si se muestran los botones de acción según el estado
    const showActionButtons = invoice.status === 'pending';
    const { class: statusClass, text: statusText } = getStatusInfo(invoice.status);
    
    // Renderizar HTML completo
    invoiceDetails.innerHTML = `
      <div class="invoice-header">
        <div class="invoice-number">Factura #${invoice.id}</div>
        <div class="invoice-date">Fecha: ${Utils.formatDate(invoice.created_at, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
        <div class="invoice-status">
          Estado: <span class="status-badge ${statusClass}">${statusText}</span>
        </div>
      </div>
      
      <div class="invoice-client">
        <h3>Cliente</h3>
        <div class="client-details">
          <p><strong>Nombre:</strong> ${invoice.User ? invoice.User.name : 'Cliente no disponible'}</p>
          ${invoice.User ? `
            <p><strong>Email:</strong> ${invoice.User.email || 'No disponible'}</p>
            <p><strong>Teléfono:</strong> ${invoice.User.phone || 'No disponible'}</p>
          ` : ''}
        </div>
      </div>
      
      <div class="invoice-address">
        <h3>Dirección de Facturación</h3>
        <p>${invoice.billing_address || (invoice.User ? invoice.User.address : 'No disponible')}</p>
      </div>
      
      <div class="invoice-items">
        <h3>Productos</h3>
        <table class="invoice-items-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Cantidad</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="text-right">Subtotal</td>
              <td>${Utils.formatCurrency(subtotal)}</td>
            </tr>
            <tr>
              <td colspan="3" class="text-right">IVA (21%)</td>
              <td>${Utils.formatCurrency(tax)}</td>
            </tr>
            <tr class="total-row">
              <td colspan="3" class="text-right">Total</td>
              <td>${Utils.formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      ${invoice.notes ? `
        <div class="invoice-notes">
          <h3>Notas</h3>
          <p>${invoice.notes}</p>
        </div>
      ` : ''}
    `;
    
    // Mostrar/ocultar botones de acción según el estado
    completeInvoiceBtn.style.display = showActionButtons ? 'block' : 'none';
    cancelInvoiceBtn.style.display = showActionButtons ? 'block' : 'none';
    
    // Mostrar modal
    invoiceDetailsModal.classList.add('show');
  } catch (error) {
    console.error('Error al cargar detalles de factura:', error);
    Utils.showNotification('Error al cargar detalles de factura', 'error');
  } finally {
    Utils.hideLoader();
  }
}

// Ver detalles del cliente
async function viewCustomer(invoiceId) {
  const invoice = invoices.find(inv => inv.id == invoiceId);
  
  if (!invoice || !invoice.User) {
    Utils.showNotification('No se encontraron datos del cliente', 'error');
    return;
  }
  
  const user = invoice.User;
  
  // Renderizar detalles del cliente
  customerDetails.innerHTML = `
    <div class="customer-info">
      <div class="customer-header">
        <h3>${user.name || 'Cliente sin nombre'}</h3>
        <p class="customer-id">ID: ${user.id || 'No disponible'}</p>
        <p class="customer-telegram-id">Telegram ID: ${user.telegram_id || 'No disponible'}</p>
      </div>
      
      <div class="customer-contact">
        <div class="contact-item">
          <strong>Email:</strong>
          ${user.email ? `<a href="mailto:${user.email}">${user.email}</a>` : 'No disponible'}
        </div>
        <div class="contact-item">
          <strong>Teléfono:</strong>
          ${user.phone ? `<a href="tel:${user.phone}">${user.phone}</a>` : 'No disponible'}
        </div>
      </div>
      
      <div class="customer-address">
        <strong>Dirección:</strong>
        <p>${user.address || 'No disponible'}</p>
      </div>
      
      <div class="customer-history">
        <strong>Cliente desde:</strong>
        <p>${Utils.formatDate(user.created_at)}</p>
      </div>
    </div>
  `;
  
  // Mostrar modal
  customerDetailsModal.classList.add('show');
}

// Descargar factura en PDF
function downloadInvoicePdf(invoiceId) {
  const invoice = invoices.find(inv => inv.id == invoiceId);
  
  if (!invoice) {
    Utils.showNotification('No se pudo generar la factura', 'error');
    return;
  }
  
  try {
    generateInvoicePdf(invoice);
  } catch (error) {
    console.error('Error al descargar factura:', error);
    Utils.showNotification('Error al generar el PDF de la factura', 'error');
  }
}

// Generar PDF de factura
function generateInvoicePdf(invoice) {
  // Verificar disponibilidad de las bibliotecas antes de continuar
  if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
    Utils.loadRequiredLibraries().then(loaded => {
      if (loaded) generateInvoicePdf(invoice);
      else Utils.showNotification('No se pudieron cargar las bibliotecas necesarias', 'error');
    });
    return;
  }
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Verificar que autoTable está disponible
    if (typeof doc.autoTable === 'undefined') {
      throw new Error('Plugin autoTable no disponible');
    }
    
    // Título
    doc.setFontSize(20);
    doc.text(`Factura #${invoice.id}`, 105, 20, { align: 'center' });
    
    // Información de cabecera
    doc.setFontSize(10);
    doc.text(`Fecha: ${Utils.formatDate(invoice.created_at)}`, 20, 30);
    doc.text(`Estado: ${getStatusInfo(invoice.status).text}`, 20, 35);
    
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
    if (invoice.User) {
      doc.text(`Nombre: ${invoice.User.name || 'No disponible'}`, 20, 65);
      doc.text(`Email: ${invoice.User.email || 'No disponible'}`, 20, 70);
      doc.text(`Teléfono: ${invoice.User.phone || 'No disponible'}`, 20, 75);
    } else {
      doc.text(`Cliente #${invoice.user_id || 'No disponible'}`, 20, 65);
    }
    
    // Dirección de facturación
    doc.setFontSize(12);
    doc.text('Dirección de Facturación', 110, 60);
    doc.setFontSize(10);
    const address = invoice.billing_address || (invoice.User ? invoice.User.address : 'No disponible');
    doc.text(address, 110, 65);
    
    // Validar items
    if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
      doc.setFontSize(12);
      doc.text('No hay productos en esta factura', 105, 100, { align: 'center' });
      doc.save(`factura-${invoice.id}.pdf`);
      Utils.showNotification('Factura básica generada', 'warning');
      return;
    }
    
    // Tabla de productos
    const tableColumn = ["Producto", "Precio", "Cantidad", "Total"];
    const tableRows = [];
    
    let subtotal = 0;
    
    invoice.items.forEach(item => {
      if (!item || typeof item !== 'object') return;
      
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = price * quantity;
      subtotal += itemTotal;
      
      // Variantes
      let productName = item.name || 'Producto sin nombre';
      if (item.size || item.color) {
        const variants = [];
        if (item.size) variants.push(`Talla: ${item.size}`);
        if (item.color) variants.push(`Color: ${item.color}`);
        productName += ` (${variants.join(', ')})`;
      }
      
      tableRows.push([
        productName,
        `€${price.toFixed(2)}`,
        quantity,
        `€${itemTotal.toFixed(2)}`
      ]);
    });
    
    // IVA y total
    const tax = subtotal * 0.21;
    const total = subtotal + tax;
    
    // Añadir resumen
    tableRows.push(
      ["", "", "Subtotal", `€${subtotal.toFixed(2)}`],
      ["", "", "IVA (21%)", `€${tax.toFixed(2)}`],
      ["", "", "Total", `€${total.toFixed(2)}`]
    );
    
    // Generar tabla
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 85,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    });
    
    // Notas
    if (invoice.notes) {
      const finalY = doc.lastAutoTable?.finalY + 10 || 130;
      doc.setFontSize(12);
      doc.text('Notas', 20, finalY);
      doc.setFontSize(10);
      doc.text(invoice.notes, 20, finalY + 5);
    }
    
    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Página ${i} de ${pageCount}`, 190, 286, { align: 'right' });
      doc.text('Esta factura es una simulación y no tiene validez fiscal.', 105, 286, { align: 'center' });
    }
    
    // Guardar PDF
    doc.save(`factura-${invoice.id}.pdf`);
    Utils.showNotification('Factura descargada correctamente', 'success');
  } catch (error) {
    console.error('Error al generar PDF:', error);
    Utils.showNotification('Error al generar PDF. Por favor, inténtelo de nuevo.', 'error');
    throw error;
  }
}

// Actualizar estado de factura
async function changeInvoiceStatus(invoiceId, status) {
  Utils.showLoader();
  try {
    // Verificar parámetros
    if (!invoiceId) throw new Error('ID de factura no proporcionado');
    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      throw new Error('Estado no válido');
    }
    
    const response = await fetch(`/api/invoices/${invoiceId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify({ status })
    });
    
    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status}`);
    }
    
    const updatedInvoice = await response.json();
    
    if (!updatedInvoice) {
      throw new Error('No se recibió respuesta del servidor');
    }
    
    // Actualizar en arrays locales
    const index = invoices.findIndex(inv => inv.id == invoiceId);
    if (index !== -1) {
      invoices[index].status = status;
    }
    
    // Si es la factura actual, actualizar también
    if (currentInvoice && currentInvoice.id == invoiceId) {
      currentInvoice.status = status;
    }
    
    // Cerrar modal
    invoiceDetailsModal.classList.remove('show');
    
    // Actualizar UI
    filterInvoices();
    renderInvoices();
    
    // Notificar al usuario
    const statusText = status === 'completed' ? 'completada' : 'cancelada';
    Utils.showNotification(`Factura ${statusText} correctamente`, 'success');
  } catch (error) {
    console.error('Error al actualizar estado de factura:', error);
    Utils.showNotification(`Error al actualizar estado de factura: ${error.message}`, 'error');
  } finally {
    Utils.hideLoader();
  }
}