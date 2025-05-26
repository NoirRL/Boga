// Variables globales
let products = [];
let categories = [];
let selectedProduct = null;
let selectedSize = null;
let selectedColor = null;

// Elementos DOM
const productsContainer = document.getElementById('products-container');
const loadingElement = document.getElementById('loading');
const noProductsElement = document.getElementById('no-products');
const searchInput = document.getElementById('search-input');
const categoryFilter = document.getElementById('category-filter');
const productModal = document.getElementById('product-modal');
const productDetails = document.getElementById('product-details');

// Funciones
async function loadProducts() {
  try {
    // Mostrar indicador de carga y ocultar otros elementos
    loadingElement.style.display = 'flex';
    productsContainer.style.display = 'none';
    noProductsElement.style.display = 'none';
    
    // Obtener productos con manejo de fallos
    products = await getProductsWithFallback();
    
    if (!products || products.length === 0) {
      // No hay productos, mostrar mensaje
      loadingElement.style.display = 'none';
      noProductsElement.style.display = 'block';
      return;
    }
    
    // Extraer categorías únicas
    updateCategories();
    
    // Renderizar productos
    renderProducts();
    
    // Actualizar la UI
    loadingElement.style.display = 'none';
    productsContainer.style.display = 'grid';
  } catch (error) {
    console.error('Error al cargar productos:', error);
    loadingElement.style.display = 'none';
    noProductsElement.style.display = 'block';
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

function createProductCard(product) {
  const productCard = document.createElement('div');
  productCard.className = 'product-card';
  productCard.dataset.id = product.id;
  
  // Crear el HTML del producto
  productCard.innerHTML = `
    <div class="product-image-container">
      <img class="product-image" src="${product.image_url || 'https://via.placeholder.com/300x300?text=Sin+Imagen'}" alt="${product.name}">
      <button class="quick-add-btn" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>+</button>
    </div>
    <div class="product-info">
      <h3 class="product-name">${product.name}</h3>
      ${product.category ? `<span class="product-category">${product.category}</span>` : ''}
      <p class="product-price">€${parseFloat(product.price).toFixed(2)}</p>
      ${product.stock <= 0 ? '<span class="out-of-stock">Agotado</span>' : ''}
    </div>
  `;
  
  // Añadir evento para mostrar detalles al hacer clic en la tarjeta
  productCard.addEventListener('click', (e) => {
    // Evitar que se ejecute si se hace clic en el botón de añadir
    if (!e.target.classList.contains('quick-add-btn')) {
      showProductDetails(product.id);
    }
  });
  
  // Añadir evento al botón de añadir rápido
  const quickAddBtn = productCard.querySelector('.quick-add-btn');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Evitar que se abra el modal de detalles
      addToCart(product, 1);
    });
  }
  
  return productCard;
}

function renderProducts() {
  const filteredProducts = filterProducts();
  
  // Limpiar contenedor
  productsContainer.innerHTML = '';
  
  if (filteredProducts.length === 0) {
    productsContainer.style.display = 'none';
    noProductsElement.style.display = 'block';
    return;
  }
  
  noProductsElement.style.display = 'none';
  productsContainer.style.display = 'grid';
  
  // Crear fragmento para mejor rendimiento
  const fragment = document.createDocumentFragment();
  
  // Renderizar cada producto
  filteredProducts.forEach(product => {
    const productCard = createProductCard(product);
    fragment.appendChild(productCard);
  });
  
  // Añadir todos los productos de una vez
  productsContainer.appendChild(fragment);
}

function filterProducts() {
  const searchTerm = searchInput.value.toLowerCase();
  const categoryValue = categoryFilter.value;
  
  return products.filter(product => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm) || 
      (product.description && product.description.toLowerCase().includes(searchTerm));
    const matchesCategory = !categoryValue || product.category === categoryValue;
    
    return matchesSearch && matchesCategory;
  });
}

function showProductDetails(productId) {
  const product = products.find(p => p.id == productId);
  if (!product) return;
  
  selectedProduct = product;
  selectedSize = null;
  selectedColor = null;
  
  // Preparar opciones de tallas y colores
  const sizesOptions = product.sizes && product.sizes.length 
    ? product.sizes.map(size => `<option value="${size}">${size}</option>`).join('') 
    : '<option value="">No disponible</option>';
  
  const colorsOptions = product.colors && product.colors.length 
    ? product.colors.map(color => `<option value="${color}">${color}</option>`).join('') 
    : '<option value="">No disponible</option>';
  
  // Actualizar el contenido del modal
  productDetails.innerHTML = `
    <img class="product-details-image" src="${product.image_url || 'https://via.placeholder.com/500x500?text=Sin+Imagen'}" alt="${product.name}">
    
    <div class="product-details-info">
      <h2>${product.name}</h2>
      ${product.category ? `<span class="product-details-category">${product.category}</span>` : ''}
      
      <p class="product-details-description">${product.description || 'Sin descripción'}</p>
      
      <div class="product-details-price">€${parseFloat(product.price).toFixed(2)}</div>
      
      <div class="product-details-stock">
        ${product.stock > 0 ? `Disponibilidad: ${product.stock} unidades` : 'Agotado'}
      </div>
      
      <div class="product-options">
        <div class="product-option">
          <label for="product-size">Talla:</label>
          <select id="product-size" class="product-select" ${!product.sizes || !product.sizes.length ? 'disabled' : ''}>
            <option value="">Selecciona talla</option>
            ${sizesOptions}
          </select>
        </div>
        
        <div class="product-option">
          <label for="product-color">Color:</label>
          <select id="product-color" class="product-select" ${!product.colors || !product.colors.length ? 'disabled' : ''}>
            <option value="">Selecciona color</option>
            ${colorsOptions}
          </select>
        </div>
      </div>
      
      <div class="product-actions">
        <div class="quantity-selector">
          <button class="quantity-btn decrease" id="decrease-quantity">-</button>
          <input type="number" value="1" min="1" max="${product.stock > 3 ? 3 : product.stock}" id="product-quantity" class="quantity-input">
          <button class="quantity-btn increase" id="increase-quantity">+</button>
        </div>
        
        <button class="btn-add-to-cart" id="add-to-cart-btn" ${product.stock <= 0 ? 'disabled' : ''}>
          Añadir al carrito
        </button>
      </div>
      
      <button class="btn-contact" id="contact-button">Contactar para más información</button>
    </div>
  `;
  
  // Mostrar el modal
  productModal.classList.add('show');
  
  setupProductModalEvents(product);
}

function setupProductModalEvents(product) {
  // Obtener referencias a los selectores de talla y color
  const sizeSelect = document.getElementById('product-size');
  const colorSelect = document.getElementById('product-color');
  
  // Configurar eventos para la cantidad
  const quantityInput = document.getElementById('product-quantity');
  const decreaseBtn = document.getElementById('decrease-quantity');
  const increaseBtn = document.getElementById('increase-quantity');
  
  decreaseBtn.addEventListener('click', () => {
    let value = parseInt(quantityInput.value) || 1;
    if (value > 1) {
      quantityInput.value = value - 1;
    }
  });
  
  increaseBtn.addEventListener('click', () => {
    let value = parseInt(quantityInput.value) || 1;
    const maxValue = Math.min(product.stock, 3);
    if (value < maxValue) {
      quantityInput.value = value + 1;
    }
  });
  
  // Añadir evento al botón de añadir al carrito
  document.getElementById('add-to-cart-btn').addEventListener('click', () => {
    const size = sizeSelect.value;
    const color = colorSelect.value;
    const quantity = parseInt(quantityInput.value) || 1;
    
    // Validar selección de talla y color si están disponibles
    const needsSize = product.sizes && product.sizes.length > 0;
    const needsColor = product.colors && product.colors.length > 0;
    
    if (needsSize && !size) {
      showToast('Por favor, selecciona una talla');
      return;
    }
    
    if (needsColor && !color) {
      showToast('Por favor, selecciona un color');
      return;
    }
    
    // Validar cantidad máxima total (en carrito + nueva cantidad)
    if (!validateMaxQuantity(product.id, quantity)) {
      showToast('No puedes añadir más de 3 unidades de este producto');
      return;
    }
    
    // Todo correcto, añadir al carrito con talla y color
    addToCart(product, quantity, size, color);
  });
  
  // Añadir evento al botón de contacto
  document.getElementById('contact-button').addEventListener('click', () => {
    // Cerrar la mini-app y redirigir al usuario al bot para contacto
    window.Telegram.WebApp.close();
  });
}

// Event Listeners
function setupEventListeners() {
  searchInput.addEventListener('input', renderProducts);
  categoryFilter.addEventListener('change', renderProducts);
  
  document.querySelectorAll('.modal .close-button').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.remove('show');
    });
  });
  
  // Cerrar modal al hacer clic fuera del contenido
  productModal.addEventListener('click', (event) => {
    if (event.target === productModal) {
      productModal.classList.remove('show');
    }
  });
}

// Inicializar
loadProducts();
setupEventListeners();