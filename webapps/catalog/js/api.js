const API_URL = window.location.origin + '/api';

// Cache para almacenar resultados de API
const apiCache = {
  products: null,
  productDetails: {},
  // Tiempo de caducidad de caché en milisegundos (5 minutos)
  cacheExpiry: 5 * 60 * 1000,
  lastFetch: 0
};

// Función para obtener productos
async function getProducts(category = null) {
  try {
    // Si hay categoría o no hay caché, hacemos una nueva petición
    if (category || !apiCache.products || Date.now() - apiCache.lastFetch > apiCache.cacheExpiry) {
      const url = category ? `${API_URL}/products?category=${category}` : `${API_URL}/products`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Solo actualizar caché si no es una búsqueda por categoría
      if (!category) {
        apiCache.products = data;
        apiCache.lastFetch = Date.now();
      }
      
      return data;
    }
    
    // Devolver datos en caché si están disponibles
    return apiCache.products;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

// Función para obtener un producto por ID
async function getProduct(id) {
  try {
    // Verificar si el producto está en caché
    if (apiCache.productDetails[id]) {
      return apiCache.productDetails[id];
    }
    
    const response = await fetch(`${API_URL}/products/${id}`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const product = await response.json();
    
    // Guardar en caché
    apiCache.productDetails[id] = product;
    
    return product;
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    // Simplemente retornar null si no se encuentra el producto
    return null;
  }
}

// Si no hay productos en la API, devuelve un array vacío
async function getProductsWithFallback() {
  try {
    const products = await getProducts();
    return products && products.length > 0 ? products : [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}