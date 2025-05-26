// Variables globales
let products = [];
let categories = [];
let currentProduct = null;
let deleteProductId = null;

// Elementos DOM
const productsList = document.getElementById('products-list');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const addProductBtn = document.getElementById('add-product-btn');
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const cancelProductBtn = document.getElementById('cancel-product');
const modalTitle = document.getElementById('modal-title');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  // Esta inicialización se moverá a main.js para centralizar
  // La llamada a setupProductsEventListeners se mantiene aquí
});

// Funciones auxiliares para modales
function openModal(modal, onOpenCallback = null) {
  modal.classList.add('show');
  if (typeof onOpenCallback === 'function') {
    onOpenCallback();
  }
}

function closeModal(modal, onCloseCallback = null) {
  modal.classList.remove('show');
  if (typeof onCloseCallback === 'function') {
    onCloseCallback();
  }
}

// Función para parsear JSON de forma segura - Mejorada
function safeJsonParse(jsonString, defaultValue = []) {
  if (!jsonString || jsonString === 'null' || jsonString === 'undefined') {
    return defaultValue;
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    // Verificar que el resultado sea un array si esperamos un array
    if (Array.isArray(defaultValue) && !Array.isArray(parsed)) {
      console.warn('El JSON parseado no es un array:', parsed);
      return defaultValue;
    }
    return parsed;
  } catch (e) {
    console.error('Error al parsear JSON:', e, 'Valor original:', jsonString);
    return defaultValue;
  }
}

// Limpieza de formulario
function resetFormState() {
  productForm.reset();
  currentProduct = null;
  
  // Limpiar mensajes de error
  const errorContainer = document.querySelector('.form-errors');
  if (errorContainer) {
    errorContainer.innerHTML = '';
    errorContainer.style.display = 'none';
  }
  
  // Limpiar marcas de campos inválidos
  document.querySelectorAll('.invalid').forEach(field => {
    field.classList.remove('invalid');
  });
}

// Funciones
async function loadProducts() {
  try {
    showLoader();
    // Usar la función centralizada de API
    products = await getProducts();
    updateCategories();
    renderProducts();
    hideLoader();
  } catch (error) {
    console.error('Error al cargar productos:', error);
    showError('Error al cargar productos');
    hideLoader();
  }
}

function updateCategories() {
  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
  categories = uniqueCategories;
  
  // Limpiar y volver a llenar el select de categorías
  categoryFilter.innerHTML = '<option value="">Todas las categorías</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function filterProducts() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const categoryFilter = document.getElementById('category-filter').value;
  
  return products.filter(product => {
    // Filtrar por búsqueda
    const matchesSearch = 
      product.name.toLowerCase().includes(searchTerm) || 
      (product.description && product.description.toLowerCase().includes(searchTerm));
    
    // Filtrar por categoría
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
}

function renderProducts() {
  const filteredProducts = filterProducts();
  
  // Limpiar la tabla
  productsList.innerHTML = '';
  
  if (filteredProducts.length === 0) {
    productsList.innerHTML = '<tr><td colspan="7" class="text-center">No se encontraron productos</td></tr>';
    return;
  }
  
  // Usar fragmento de documento para mejor rendimiento
  const fragment = document.createDocumentFragment();
  
  // Renderizar cada producto
  filteredProducts.forEach(product => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>${product.id}</td>
      <td>
        ${product.image_url 
          ? `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" class="product-thumbnail">` 
          : '<div class="no-image">Sin imagen</div>'}
      </td>
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category || '')}</td>
      <td>€${parseFloat(product.price).toFixed(2)}</td>
      <td>${product.stock}</td>
      <td class="actions">
        <button class="edit-btn" data-id="${product.id}">Editar</button>
        <button class="delete-btn delete-button" data-id="${product.id}">Eliminar</button>
      </td>
    `;
    
    fragment.appendChild(row);
  });
  
  productsList.appendChild(fragment);
  
  // Añadir event listeners a los botones de acciones
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => editProduct(parseInt(btn.dataset.id, 10)));
  });
  
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => confirmDelete(parseInt(btn.dataset.id, 10)));
  });
}

// Función para escapar HTML y prevenir XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function editProduct(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  currentProduct = product;
  modalTitle.textContent = 'Editar Producto';
  
  resetFormState();
  
  // Llenar el formulario con los datos del producto
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-description').value = product.description || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-category').value = product.category || '';
  document.getElementById('product-stock').value = product.stock || 0;
  document.getElementById('product-image').value = product.image_url || '';
  
  // Manejar tallas y colores con seguridad
  const sizes = safeJsonParse(product.sizes);
  const colors = safeJsonParse(product.colors);
  
  document.getElementById('product-sizes').value = JSON.stringify(sizes);
  document.getElementById('product-colors').value = JSON.stringify(colors);
  
  // Actualizar UI de tags después de un breve retraso para asegurar que el DOM está actualizado
  setTimeout(() => {
    initTagsInput();
  }, 100);
  
  // Mostrar el modal
  openModal(productModal);
}

// Inicializar controles de tags para tallas y colores
function initTagsInput() {
  setupTagsInput('product-sizes-input', 'product-sizes-tags', 'product-sizes');
  setupTagsInput('product-colors-input', 'product-colors-tags', 'product-colors');
}

// Configurar campo de tags
function setupTagsInput(inputId, tagsContainerId, hiddenInputId) {
  const input = document.getElementById(inputId);
  const tagsContainer = document.getElementById(tagsContainerId);
  const hiddenInput = document.getElementById(hiddenInputId);
  
  if (!input || !tagsContainer || !hiddenInput) {
    console.error(`No se encontraron elementos para el tag input: ${inputId}`);
    return;
  }
  
  // Cargar tags iniciales
  updateTagsFromValue();
  
  // Evento al presionar tecla
  input.addEventListener('keydown', function(e) {
    // Enter o coma para añadir tag
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      
      // Obtener valor y limpiar
      const value = input.value.trim();
      if (!value) return;
      
      // Añadir tag
      addTag(value);
      input.value = '';
      input.focus();
    }
  });
  
  // Evento de pérdida de foco para añadir el último tag
  input.addEventListener('blur', function() {
    const value = input.value.trim();
    if (value) {
      addTag(value);
      input.value = '';
    }
  });
  
  // Añadir tag a la UI y actualizar valor oculto
  function addTag(text) {
    // Normalizar texto (eliminar espacios extra)
    text = text.trim();
    
    // Si está vacío, no hacer nada
    if (!text) return;
    
    // Leer tags actuales con manejo seguro
    const tags = safeJsonParse(hiddenInput.value);
    
    // Verificar si ya existe (case insensitive)
    const exists = tags.some(tag => tag.toLowerCase() === text.toLowerCase());
    if (exists) return;
    
    // Añadir nuevo tag
    tags.push(text);
    hiddenInput.value = JSON.stringify(tags);
    
    // Actualizar UI
    updateTagsUI();
  }
  
  // Eliminar tag
  function removeTag(text) {
    const tags = safeJsonParse(hiddenInput.value);
    
    const filteredTags = tags.filter(tag => tag !== text);
    hiddenInput.value = JSON.stringify(filteredTags);
    updateTagsUI();
  }
  
  // Actualizar UI de tags
  function updateTagsUI() {
    const tags = safeJsonParse(hiddenInput.value);
    
    // Limpiar contenedor
    tagsContainer.innerHTML = '';
    
    // Crear elementos para cada tag
    tags.forEach(tag => {
      const tagElement = document.createElement('span');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      
      const removeButton = document.createElement('span');
      removeButton.className = 'tag-remove';
      removeButton.innerHTML = '&times;';
      removeButton.addEventListener('click', () => removeTag(tag));
      
      tagElement.appendChild(removeButton);
      tagsContainer.appendChild(tagElement);
    });
  }
  
  // Actualizar desde valor oculto
  function updateTagsFromValue() {
    // Solo actualizar la UI, los valores ya están en el input oculto
    updateTagsUI();
  }
}

function confirmDelete(productId) {
  deleteProductId = productId;
  openModal(deleteModal);
}

async function deleteProductHandler() {
  if (!deleteProductId) return;
  
  try {
    showLoader();
    // Usar función centralizada
    const success = await deleteProduct(deleteProductId);
    if (success) {
      // Eliminar el producto de la lista local
      products = products.filter(p => p.id !== deleteProductId);
      updateCategories();
      renderProducts();
      closeModal(deleteModal);
      showSuccess('Producto eliminado correctamente');
    } else {
      showError('No se pudo eliminar el producto');
    }
    hideLoader();
  } catch (error) {
    hideLoader();
    console.error('Error al eliminar producto:', error);
    showError(`Error al eliminar el producto: ${error.message || 'Error desconocido'}`);
  } finally {
    deleteProductId = null;
  }
}

async function saveProduct(event) {
  event.preventDefault();
  
  // Limpiar marcas de campos inválidos
  document.querySelectorAll('.invalid').forEach(field => {
    field.classList.remove('invalid');
  });
  
  // Obtener valores
  const nameField = document.getElementById('product-name');
  const descriptionField = document.getElementById('product-description');
  const priceField = document.getElementById('product-price');
  const categoryField = document.getElementById('product-category');
  const stockField = document.getElementById('product-stock');
  const imageField = document.getElementById('product-image');
  const sizesField = document.getElementById('product-sizes');
  const colorsField = document.getElementById('product-colors');
  
  const name = nameField.value.trim();
  const description = descriptionField.value.trim();
  const price = parseFloat(priceField.value);
  const category = categoryField.value.trim();
  const stock = parseInt(stockField.value);
  const imageUrl = imageField.value.trim();
  
  // Obtener tallas y colores de forma segura
  const sizes = safeJsonParse(sizesField.value);
  const colors = safeJsonParse(colorsField.value);
  
  // Validaciones
  const errors = [];
  const fieldsToValidate = [
    { field: nameField, value: name, validate: () => {
      if (!name) return 'El nombre del producto es obligatorio';
      if (name.length < 3) return 'El nombre debe tener al menos 3 caracteres';
      if (name.length > 100) return 'El nombre no puede exceder 100 caracteres';
      return null;
    }},
    { field: descriptionField, value: description, validate: () => {
      if (!description) return 'La descripción es obligatoria';
      if (description.length < 10) return 'La descripción debe tener al menos 10 caracteres';
      return null;
    }},
    { field: priceField, value: price, validate: () => {
      if (isNaN(price) || price <= 0) return 'El precio debe ser un número mayor que cero';
      if (price > 10000) return 'El precio no puede ser mayor a €10,000';
      return null;
    }},
    { field: categoryField, value: category, validate: () => {
      if (!category) return 'La categoría es obligatoria';
      return null;
    }},
    { field: stockField, value: stock, validate: () => {
      if (isNaN(stock) || stock < 0) return 'El stock debe ser un número mayor o igual a cero';
      if (stock > 1000) return 'El stock no puede ser mayor a 1000 unidades';
      return null;
    }},
    { field: imageField, value: imageUrl, validate: () => {
      if (imageUrl && !isValidUrl(imageUrl)) return 'La URL de la imagen no es válida';
      return null;
    }}
  ];
  
  // Ejecutar validaciones
  fieldsToValidate.forEach(item => {
    const error = item.validate();
    if (error) {
      errors.push(error);
      markInvalid(item.field);
    }
  });
  
  if (errors.length > 0) {
    // Mostrar mensaje de error global
    showError(errors.join('<br>'));
    return;
  }
  
  // Preparar datos del producto
  const productData = {
    name,
    description,
    price,
    category,
    stock,
    image_url: imageUrl,
    sizes: JSON.stringify(sizes),
    colors: JSON.stringify(colors)
  };
  
  try {
    showLoader();
    let success;
    if (currentProduct) {
      // Edición de producto - usar función centralizada
      success = await updateProduct(currentProduct.id, productData);
      if (success) {
        // Actualizar producto en la lista local
        const index = products.findIndex(p => p.id == currentProduct.id);
        if (index !== -1) {
          products[index] = { ...products[index], ...productData, id: currentProduct.id };
        }
        showSuccess('Producto actualizado correctamente');
      } else {
        showError('No se pudo actualizar el producto');
      }
    } else {
      // Nuevo producto - usar función centralizada
      success = await createProduct(productData);
      if (success) {
        // Añadir el nuevo producto a la lista local
        products.push({ ...productData, id: success.id });
        showSuccess('Producto creado correctamente');
      } else {
        showError('No se pudo crear el producto');
      }
    }
    
    hideLoader();
    closeModal(productModal);
    renderProducts();
  } catch (error) {
    hideLoader();
    console.error('Error al guardar producto:', error);
    showError('Error al guardar el producto');
  }
}

// Validar URL - Implementación más robusta
function isValidUrl(string) {
  if (!string) return false;
  
  try {
    const url = new URL(string);
    return ['http:', 'https:'].includes(url.protocol);
  } catch (_) {
    return false;  
  }
}

// Marcar campo como inválido
function markInvalid(field) {
  field.classList.add('invalid');
  
  // Mostrar mensaje de error específico para el campo
  const errorMessage = document.createElement('div');
  errorMessage.className = 'error-message';
  errorMessage.textContent = 'Este campo es inválido';
  field.parentElement.appendChild(errorMessage);
  
  // Eliminar mensaje de error al corregir el campo
  field.addEventListener('input', function() {
    field.classList.remove('invalid');
    const existingError = field.parentElement.querySelector('.error-message');
    if (existingError) {
      existingError.remove();
    }
  }, { once: true });
}

// Mostrar mensaje de éxito
function showSuccess(message) {
  const successMessage = document.createElement('div');
  successMessage.className = 'success-message';
  successMessage.textContent = message;
  
  document.body.appendChild(successMessage);
  
  // Remover mensaje después de 3 segundos
  setTimeout(() => {
    successMessage.remove();
  }, 3000);
}

// Mostrar mensaje de error
function showError(message) {
  const errorMessage = document.createElement('div');
  errorMessage.className = 'error-message global';
  errorMessage.innerHTML = message;
  
  document.body.appendChild(errorMessage);
  
  // Remover mensaje después de 4 segundos
  setTimeout(() => {
    errorMessage.remove();
  }, 4000);
}

// Mostrar loader
function showLoader() {
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.className = 'loader-container';
    loader.innerHTML = '<div class="loader"></div>';
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

// Ocultar loader
function hideLoader() {
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// Event Listeners
function setupProductsEventListeners() {
  // Evento para abrir modal de nuevo producto
  addProductBtn.addEventListener('click', () => {
    currentProduct = null;
    modalTitle.textContent = 'Añadir Nuevo Producto';
    resetFormState();
    
    // Inicializar campos de tags
    document.getElementById('product-sizes').value = '[]';
    document.getElementById('product-colors').value = '[]';
    
    // Inicializar UI de tags después de un breve retraso
    setTimeout(() => {
      initTagsInput();
    }, 100);
    
    openModal(productModal);
  });
  
  // Evento para cerrar modal
  cancelProductBtn.addEventListener('click', () => {
    closeModal(productModal, resetFormState);
  });
  
  // Evento para enviar formulario
  productForm.addEventListener('submit', saveProduct);
  
  // Eventos para filtrado
  searchInput.addEventListener('input', renderProducts);
  categoryFilter.addEventListener('change', renderProducts);
  
  // Configurar cierre de modales
  document.querySelectorAll('.modal .close-button').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.closest('.modal'));
    });
  });
  
  // Cerrar modales haciendo clic fuera
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) {
        closeModal(this);
      }
    });
  });
  
  // Eventos para modal de confirmación de eliminación
  cancelDeleteBtn.addEventListener('click', () => {
    closeModal(deleteModal, () => { deleteProductId = null; });
  });
  
  confirmDeleteBtn.addEventListener('click', deleteProductHandler);
  
  // Prevenir pérdida de datos accidental
  window.addEventListener('beforeunload', function(e) {
    if (productModal.classList.contains('show')) {
      const message = '¿Estás seguro de que quieres salir? Los cambios no guardados se perderán.';
      e.returnValue = message;
      return message;
    }
  });
}

// Inicializar tooltips para mejorar la UX
function initTooltips() {
  const tooltips = document.querySelectorAll('[data-tooltip]');
  tooltips.forEach(tooltip => {
    tooltip.addEventListener('mouseenter', function() {
      const message = this.getAttribute('data-tooltip');
      if (!message) return;
      
      const tip = document.createElement('div');
      tip.className = 'tooltip';
      tip.textContent = message;
      document.body.appendChild(tip);
      
      const rect = this.getBoundingClientRect();
      tip.style.left = rect.left + (rect.width / 2) - (tip.offsetWidth / 2) + 'px';
      tip.style.top = rect.bottom + 10 + 'px';
      
      this.addEventListener('mouseleave', function() {
        tip.remove();
      }, { once: true });
    });
  });
}

// Inicializar tooltips al cargar la página
document.addEventListener('DOMContentLoaded', initTooltips);