// =============================================
// CHI BEST - CENTRALIZED PRODUCT DATABASE
// =============================================
// This file contains all product information.
// Update prices, stock, and product details here.
// Changes will automatically reflect across all pages.
// =============================================

const PRODUCTS = [
    // ==================
    // FASHION CATEGORY
    // ==================
    {
        id: "fashion-001",
        name: "Classic Men's Shirt",
        price: 5500,
        originalPrice: 8000,
        image: "images/fashion-shirt.jpg",
        category: "fashion",
        status: "in-stock",
        quantity: 25,
        rating: 4.5,
        reviews: 18,
        description: "High-quality cotton shirt perfect for both casual and formal occasions. Available in multiple colors and sizes.",
        badge: "Popular",
        featured: true
    },
    {
        id: "fashion-002",
        name: "Women's Ankara Dress",
        price: 12000,
        originalPrice: 18000,
        image: "images/ankara-dress.jpg",
        category: "fashion",
        status: "in-stock",
        quantity: 15,
        rating: 5,
        reviews: 32,
        description: "Beautiful African print dress with modern styling. Perfect for parties and special occasions.",
        badge: "New",
        featured: true
    },
    {
        id: "fashion-003",
        name: "Denim Jeans - Slim Fit",
        price: 7500,
        originalPrice: 10000,
        image: "images/denim-jeans.jpg",
        category: "fashion",
        status: "in-stock",
        quantity: 40,
        rating: 4,
        reviews: 45,
        description: "Premium quality denim jeans with comfortable stretch. Available in various sizes.",
        badge: null,
        featured: false
    },
    {
        id: "fashion-004",
        name: "Ladies Blouse - Floral",
        price: 4500,
        originalPrice: 6500,
        image: "images/floral-blouse.jpg",
        category: "fashion",
        status: "low-stock",
        quantity: 5,
        rating: 4.5,
        reviews: 12,
        description: "Elegant floral blouse perfect for office wear or casual outings.",
        badge: null,
        featured: false
    },

    // ==================
    // ELECTRONICS CATEGORY
    // ==================
    {
        id: "electronics-001",
        name: "Smart Watch Pro",
        price: 15000,
        originalPrice: 20000,
        image: "images/smart-watch.jpg",
        category: "electronics",
        status: "in-stock",
        quantity: 30,
        rating: 4.5,
        reviews: 45,
        description: "Feature-rich smartwatch with heart rate monitor, fitness tracking, and notification alerts. Water-resistant design.",
        badge: "Hot",
        featured: true
    },
    {
        id: "electronics-002",
        name: "Wireless Earbuds Pro",
        price: 8500,
        originalPrice: 12000,
        image: "images/earbuds.jpg",
        category: "electronics",
        status: "in-stock",
        quantity: 50,
        rating: 4,
        reviews: 28,
        description: "High-quality wireless earbuds with active noise cancellation. 24-hour battery life with charging case.",
        badge: null,
        featured: true
    },
    {
        id: "electronics-003",
        name: "Power Bank 20000mAh",
        price: 6000,
        originalPrice: 9000,
        image: "images/power-bank.jpg",
        category: "electronics",
        status: "in-stock",
        quantity: 35,
        rating: 4.5,
        reviews: 56,
        description: "High-capacity power bank with fast charging support. Charge multiple devices simultaneously.",
        badge: null,
        featured: false
    },
    {
        id: "electronics-004",
        name: "Bluetooth Speaker",
        price: 4500,
        originalPrice: 7000,
        image: "images/bluetooth-speaker.jpg",
        category: "electronics",
        status: "in-stock",
        quantity: 20,
        rating: 4,
        reviews: 22,
        description: "Portable Bluetooth speaker with powerful bass and 12-hour playtime.",
        badge: null,
        featured: false
    },
    {
        id: "electronics-005",
        name: "LED Desk Lamp",
        price: 3500,
        originalPrice: 5000,
        image: "images/desk-lamp.jpg",
        category: "electronics",
        status: "in-stock",
        quantity: 18,
        rating: 4,
        reviews: 15,
        description: "Adjustable LED desk lamp with multiple brightness levels and USB charging port.",
        badge: null,
        featured: false
    },

    // ==================
    // BEAUTY CATEGORY
    // ==================
    {
        id: "beauty-001",
        name: "Skincare Set - 5 Piece",
        price: 8500,
        originalPrice: 12000,
        image: "images/skincare-set.jpg",
        category: "beauty",
        status: "in-stock",
        quantity: 20,
        rating: 5,
        reviews: 38,
        description: "Complete skincare routine set including cleanser, toner, serum, moisturizer, and eye cream.",
        badge: "Best Seller",
        featured: true
    },
    {
        id: "beauty-002",
        name: "Makeup Brush Set - 12 Pcs",
        price: 4000,
        originalPrice: 6000,
        image: "images/makeup-brushes.jpg",
        category: "beauty",
        status: "in-stock",
        quantity: 45,
        rating: 4.5,
        reviews: 24,
        description: "Professional makeup brush set with synthetic bristles. Includes carrying case.",
        badge: null,
        featured: false
    },
    {
        id: "beauty-003",
        name: "Perfume Oil - Oud",
        price: 5500,
        originalPrice: 8000,
        image: "images/perfume-oud.jpg",
        category: "beauty",
        status: "in-stock",
        quantity: 30,
        rating: 5,
        reviews: 42,
        description: "Long-lasting Arabian oud perfume oil. Premium quality fragrance that lasts all day.",
        badge: "Popular",
        featured: true
    },
    {
        id: "beauty-004",
        name: "Hair Growth Oil",
        price: 3500,
        originalPrice: 5000,
        image: "images/hair-oil.jpg",
        category: "beauty",
        status: "in-stock",
        quantity: 60,
        rating: 4,
        reviews: 55,
        description: "Natural hair growth oil blend with essential nutrients for healthy hair growth.",
        badge: null,
        featured: false
    },

    // ==================
    // BAGS CATEGORY
    // ==================
    {
        id: "bags-001",
        name: "Designer Handbag - Brown",
        price: 12500,
        originalPrice: 18000,
        image: "images/designer-bag.jpg",
        category: "bags",
        status: "in-stock",
        quantity: 12,
        rating: 5,
        reviews: 32,
        description: "Elegant designer-inspired handbag with multiple compartments. Perfect for work and casual use.",
        badge: "New",
        featured: true
    },
    {
        id: "bags-002",
        name: "Laptop Bag - Professional",
        price: 8000,
        originalPrice: 12000,
        image: "images/laptop-bag.jpg",
        category: "bags",
        status: "in-stock",
        quantity: 25,
        rating: 4.5,
        reviews: 19,
        description: "Professional laptop bag with padded compartment. Fits up to 15.6-inch laptops.",
        badge: null,
        featured: false
    },
    {
        id: "bags-003",
        name: "Travel Backpack - 40L",
        price: 9500,
        originalPrice: 14000,
        image: "images/travel-backpack.jpg",
        category: "bags",
        status: "in-stock",
        quantity: 18,
        rating: 4.5,
        reviews: 28,
        description: "Spacious travel backpack with multiple pockets and USB charging port. Water-resistant material.",
        badge: null,
        featured: false
    },
    {
        id: "bags-004",
        name: "Mini Crossbody Bag",
        price: 4500,
        originalPrice: 7000,
        image: "images/crossbody-bag.jpg",
        category: "bags",
        status: "low-stock",
        quantity: 8,
        rating: 4,
        reviews: 14,
        description: "Trendy mini crossbody bag perfect for essentials. Adjustable strap included.",
        badge: null,
        featured: false
    },

    // ==================
    // SHOES CATEGORY
    // ==================
    {
        id: "shoes-001",
        name: "Classic Sneakers - White",
        price: 9800,
        originalPrice: 14000,
        image: "images/sneakers-white.jpg",
        category: "shoes",
        status: "in-stock",
        quantity: 35,
        rating: 4.5,
        reviews: 56,
        description: "Comfortable white sneakers with cushioned sole. Perfect for everyday wear.",
        badge: "-30%",
        featured: true
    },
    {
        id: "shoes-002",
        name: "Men's Leather Shoes",
        price: 15000,
        originalPrice: 22000,
        image: "images/leather-shoes.jpg",
        category: "shoes",
        status: "in-stock",
        quantity: 20,
        rating: 5,
        reviews: 23,
        description: "Premium genuine leather shoes perfect for formal occasions. Comfortable and durable.",
        badge: null,
        featured: false
    },
    {
        id: "shoes-003",
        name: "Ladies Heels - Black",
        price: 7500,
        originalPrice: 11000,
        image: "images/heels-black.jpg",
        category: "shoes",
        status: "in-stock",
        quantity: 22,
        rating: 4,
        reviews: 18,
        description: "Elegant black heels with comfortable design. Perfect for office and events.",
        badge: null,
        featured: false
    },
    {
        id: "shoes-004",
        name: "Sports Running Shoes",
        price: 11000,
        originalPrice: 16000,
        image: "images/running-shoes.jpg",
        category: "shoes",
        status: "in-stock",
        quantity: 28,
        rating: 4.5,
        reviews: 35,
        description: "Lightweight running shoes with breathable mesh and superior cushioning.",
        badge: null,
        featured: false
    },

    // ==================
    // TRENDING PRODUCTS
    // ==================
    {
        id: "trending-001",
        name: "Smart Fitness Band",
        price: 6500,
        originalPrice: 10000,
        image: "images/fitness-band.jpg",
        category: "trending",
        status: "in-stock",
        quantity: 40,
        rating: 4.5,
        reviews: 48,
        description: "Advanced fitness tracker with heart rate monitoring, sleep tracking, and 14-day battery life.",
        badge: "Trending",
        featured: true
    },
    {
        id: "trending-002",
        name: "Wireless Charging Pad",
        price: 3500,
        originalPrice: 5500,
        image: "images/wireless-charger.jpg",
        category: "trending",
        status: "in-stock",
        quantity: 55,
        rating: 4,
        reviews: 32,
        description: "Fast wireless charging pad compatible with all Qi-enabled devices. Sleek and compact design.",
        badge: "Trending",
        featured: true
    },
    {
        id: "trending-003",
        name: "Phone Ring Light - 10 inch",
        price: 4000,
        originalPrice: 6000,
        image: "images/ring-light.jpg",
        category: "trending",
        status: "in-stock",
        quantity: 30,
        rating: 4.5,
        reviews: 27,
        description: "Professional ring light with adjustable brightness and phone holder. Perfect for content creation.",
        badge: "Trending",
        featured: false
    },
    {
        id: "trending-004",
        name: "Mini Portable Fan",
        price: 2000,
        originalPrice: 3500,
        image: "images/portable-fan.jpg",
        category: "trending",
        status: "in-stock",
        quantity: 100,
        rating: 4,
        reviews: 65,
        description: "USB rechargeable mini fan with 3-speed settings. Compact and portable design.",
        badge: null,
        featured: false
    }
];

// ==================
// CATEGORIES
// ==================
const CATEGORIES = [
    { id: "all", name: "All Products", icon: "fas fa-th-large" },
    { id: "fashion", name: "Fashion", icon: "fas fa-tshirt" },
    { id: "electronics", name: "Electronics", icon: "fas fa-mobile-alt" },
    { id: "beauty", name: "Beauty", icon: "fas fa-spa" },
    { id: "bags", name: "Bags", icon: "fas fa-shopping-bag" },
    { id: "shoes", name: "Shoes", icon: "fas fa-shoe-prints" },
    { id: "trending", name: "Trending", icon: "fas fa-fire" }
];

// ==================
// STATUS CONFIGURATION
// ==================
const STATUS_CONFIG = {
    "in-stock": { label: "In Stock", class: "status-available", color: "#22c55e" },
    "low-stock": { label: "Low Stock", class: "status-low", color: "#f59e0b" },
    "out-of-stock": { label: "Out of Stock", class: "status-unavailable", color: "#ef4444" }
};

// ==================
// HELPER FUNCTIONS
// ==================

/**
 * Format price in Naira
 * @param {number} price - Price in Naira
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
    return '₦' + price.toLocaleString();
}

/**
 * Calculate discount percentage
 * @param {number} originalPrice - Original price
 * @param {number} currentPrice - Current price
 * @returns {number} Discount percentage
 */
function calculateDiscount(originalPrice, currentPrice) {
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * Get product by ID
 * @param {string} productId - Product ID
 * @returns {object|undefined} Product object or undefined
 */
function getProductById(productId) {
    return PRODUCTS.find(product => product.id === productId);
}

/**
 * Get products by category
 * @param {string} category - Category ID
 * @returns {array} Array of products
 */
function getProductsByCategory(category) {
    if (category === 'all') return PRODUCTS;
    return PRODUCTS.filter(product => product.category === category);
}

/**
 * Get featured products
 * @returns {array} Array of featured products
 */
function getFeaturedProducts() {
    return PRODUCTS.filter(product => product.featured);
}

/**
 * Search products by name or description
 * @param {string} query - Search query
 * @returns {array} Array of matching products
 */
function searchProducts(query) {
    const searchTerm = query.toLowerCase().trim();
    return PRODUCTS.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm)
    );
}

/**
 * Generate star rating HTML
 * @param {number} rating - Rating value (0-5)
 * @returns {string} HTML string for star rating
 */
function generateStarRating(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        PRODUCTS, 
        CATEGORIES, 
        STATUS_CONFIG, 
        formatPrice, 
        calculateDiscount,
        getProductById,
        getProductsByCategory,
        getFeaturedProducts,
        searchProducts,
        generateStarRating
    };
}
