// =============================================
// CHI BEST - SUPABASE CLIENT
// =============================================
// This module provides Supabase connectivity for the Chi Best e-commerce site
// Works with or without Supabase - uses localStorage fallback when not configured
// =============================================

// Supabase URL and key - UPDATE THESE with your Supabase credentials
const SUPABASE_URL = 'https://niuvzotnbjjbxeifkiqx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1WIzx5KYsW2RlJyjmURZ3Q_O-KK2NTF';
const SUPABASE_DEBUG = false;

// Create Supabase client (dynamically load the library)
let supabase = null;
let supabaseLib = null;

async function loadSupabaseLib() {
    if (supabaseLib) return supabaseLib;
    
    // Dynamically load Supabase from CDN
    if (typeof createClient === 'undefined') {
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    supabaseLib = window.supabase;
    return supabaseLib;
}

async function initSupabase() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL') {
        if (SUPABASE_DEBUG) {
            console.warn('⚠️ Supabase not configured. Using localStorage fallback.');
            console.info('Get credentials from: https://app.supabase.com/project/_/settings/api');
        }
        return null;
    }

    if (!supabase) {
        const lib = await loadSupabaseLib();
        supabase = lib.createClient(SUPABASE_URL, SUPABASE_KEY, {
            global: {
                headers: { 'x-client-info': 'chibest-web' }
            },
            auth: {
                persistSession: true,
                autoRefreshToken: true
            }
        });

        if (SUPABASE_DEBUG) {
            console.log('✅ Supabase client initialized');
        }
    }

    return supabase;
}

// =============================================
// DATABASE HELPERS
// =============================================

const ProductsDB = {
    async getAll() {
        try {
            const client = await initSupabase();
            if (!client) return getLocalProducts();
            
            const { data, error } = await client
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error && SUPABASE_DEBUG) console.error('Products fetch error:', error);
            return data || [];
        } catch (e) {
            console.warn('Using local products:', e.message);
            return getLocalProducts();
        }
    },

    async getByCategory(category) {
        try {
            const client = await initSupabase();
            if (!client) return getLocalProducts().filter(p => p.category === category);
            
            const { data, error } = await client
                .from('products')
                .select('*')
                .eq('category', category)
                .order('created_at', { ascending: false });
            
            return data || [];
        } catch (e) {
            return getLocalProducts().filter(p => p.category === category);
        }
    },

    async getFeatured() {
        try {
            const client = await initSupabase();
            if (!client) return getLocalProducts().filter(p => p.featured);
            
            const { data, error } = await client
                .from('products')
                .select('*')
                .eq('featured', true)
                .order('created_at', { ascending: false });
            
            return data || [];
        } catch (e) {
            return getLocalProducts().filter(p => p.featured);
        }
    },

    async getById(id) {
        try {
            const client = await initSupabase();
            if (!client) return getLocalProducts().find(p => p.id === id);
            
            const { data, error } = await client
                .from('products')
                .select('*')
                .eq('id', id)
                .single();
            
            return data;
        } catch (e) {
            return getLocalProducts().find(p => p.id === id);
        }
    },

    async create(product) {
        try {
            const client = await initSupabase();
            if (!client) return saveToLocalProducts(product);
            
            const { data, error } = await client
                .from('products')
                .insert(product)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (e) {
            return saveToLocalProducts(product);
        }
    },

    async update(id, updates) {
        try {
            const client = await initSupabase();
            if (!client) return updateLocalProduct(id, updates);
            
            const { data, error } = await client
                .from('products')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (e) {
            return updateLocalProduct(id, updates);
        }
    },

    async delete(id) {
        try {
            const client = await initSupabase();
            if (!client) return deleteLocalProduct(id);
            
            const { error } = await client
                .from('products')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true };
        } catch (e) {
            deleteLocalProduct(id);
            return { success: true };
        }
    }
};

const OrdersDB = {
    async create(orderData) {
        try {
            const client = await initSupabase();
            if (!client) return saveLocalOrder(orderData);
            
            const orderNumber = orderData.order_number || generateOrderNumber();
            
            const { data: order, error: orderError } = await client
                .from('orders')
                .insert({
                    order_number: orderNumber,
                    customer_name: orderData.customer_name,
                    customer_phone: orderData.customer_phone,
                    customer_whatsapp: orderData.customer_whatsapp,
                    delivery_address: orderData.delivery_address,
                    delivery_city: orderData.delivery_city,
                    delivery_state: orderData.delivery_state,
                    notes: orderData.notes,
                    subtotal: orderData.subtotal,
                    delivery_fee: orderData.delivery_fee,
                    total: orderData.total,
                    payment_status: 'pending',
                    status: 'pending'
                })
                .select()
                .single();
            
            if (orderError) throw orderError;
            
            if (orderData.items && orderData.items.length > 0) {
                const orderItems = orderData.items.map(item => ({
                    order_id: order.id,
                    product_id: item.id,
                    product_name: item.name,
                    product_price: item.price,
                    quantity: item.quantity,
                    total: item.price * item.quantity
                }));
                
                await client.from('order_items').insert(orderItems);
            }
            
            return order;
        } catch (e) {
            return saveLocalOrder(orderData);
        }
    },

    async getAll() {
        try {
            const client = await initSupabase();
            if (!client) return getLocalOrders();
            
            const { data, error } = await client
                .from('orders')
                .select('*, order_items(*)')
                .order('created_at', { ascending: false });
            
            return data || [];
        } catch (e) {
            return getLocalOrders();
        }
    },

    async getByOrderNumber(orderNumber) {
        try {
            const client = await initSupabase();
            if (!client) return getLocalOrders().find(o => o.order_number === orderNumber);
            
            const { data, error } = await client
                .from('orders')
                .select('*, order_items(*)')
                .eq('order_number', orderNumber)
                .single();
            
            return data;
        } catch (e) {
            return getLocalOrders().find(o => o.order_number === orderNumber);
        }
    },

    async updateStatus(orderId, status) {
        try {
            const client = await initSupabase();
            if (!client) return updateLocalOrderStatus(orderId, status);
            
            const { data, error } = await client
                .from('orders')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('id', orderId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (e) {
            return updateLocalOrderStatus(orderId, status);
        }
    }
};

const RequestsDB = {
    async create(requestData) {
        try {
            const client = await initSupabase();
            if (!client) return saveLocalRequest(requestData);
            
            const { data, error } = await client
                .from('product_requests')
                .insert({
                    customer_name: requestData.customer_name,
                    customer_whatsapp: requestData.customer_whatsapp,
                    description: requestData.description,
                    product_link: requestData.product_link,
                    images: requestData.images || [],
                    quantity: requestData.quantity,
                    notes: requestData.notes,
                    status: 'new'
                })
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (e) {
            return saveLocalRequest(requestData);
        }
    },

    async getAll() {
        try {
            const client = await initSupabase();
            if (!client) return getLocalRequests();
            
            const { data, error } = await client
                .from('product_requests')
                .select('*')
                .order('created_at', { ascending: false });
            
            return data || [];
        } catch (e) {
            return getLocalRequests();
        }
    }
};

const ReceiptsDB = {
    async getAll() {
        try {
            const client = await initSupabase();
            if (!client) return getLocalReceipts();
            
            const { data, error } = await client
                .from('receipts')
                .select('*, orders(order_number, customer_name)')
                .order('created_at', { ascending: false });
            
            return data || [];
        } catch (e) {
            return getLocalReceipts();
        }
    }
};

// =============================================
// LOCAL STORAGE FALLBACK
// =============================================

function getLocalProducts() {
    const stored = localStorage.getItem('chibest_products');
    if (stored) return JSON.parse(stored);
    
    const defaults = [
        { id: 'fashion-001', name: "Classic Men's Shirt", price: 5500, originalPrice: 8000, category: 'fashion', status: 'in-stock', quantity: 25, rating: 4.5, reviews: 18, badge: 'Popular', featured: true, description: 'High-quality cotton shirt.', image: '' },
        { id: 'electronics-001', name: 'Smart Watch Pro', price: 15000, originalPrice: 20000, category: 'electronics', status: 'in-stock', quantity: 30, rating: 4.5, reviews: 45, badge: 'Hot', featured: true, description: 'Feature-rich smartwatch.', image: '' },
        { id: 'beauty-001', name: 'Skincare Set - 5 Piece', price: 8500, originalPrice: 12000, category: 'beauty', status: 'in-stock', quantity: 20, rating: 5, reviews: 38, badge: 'Best Seller', featured: true, description: 'Complete skincare set.', image: '' },
        { id: 'bags-001', name: 'Designer Handbag - Brown', price: 12500, originalPrice: 18000, category: 'bags', status: 'in-stock', quantity: 12, rating: 5, reviews: 32, badge: 'New', featured: true, description: 'Elegant designer handbag.', image: '' },
        { id: 'shoes-001', name: 'Classic Sneakers - White', price: 9800, originalPrice: 14000, category: 'shoes', status: 'in-stock', quantity: 35, rating: 4.5, reviews: 56, badge: '-30%', featured: true, description: 'Comfortable white sneakers.', image: '' }
    ];
    
    localStorage.setItem('chibest_products', JSON.stringify(defaults));
    return defaults;
}

function saveLocalProducts(products) {
    localStorage.setItem('chibest_products', JSON.stringify(products));
}

function saveToLocalProducts(product) {
    const products = getLocalProducts();
    product.id = product.id || 'prod-' + Date.now();
    product.created_at = new Date().toISOString();
    products.unshift(product);
    saveLocalProducts(products);
    return product;
}

function updateLocalProduct(id, updates) {
    const products = getLocalProducts();
    const index = products.findIndex(p => p.id === id);
    if (index > -1) {
        products[index] = { ...products[index], ...updates, updated_at: new Date().toISOString() };
        saveLocalProducts(products);
    }
}

function deleteLocalProduct(id) {
    const products = getLocalProducts().filter(p => p.id !== id);
    saveLocalProducts(products);
}

function generateOrderNumber() {
    return 'CB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

function saveLocalOrder(orderData) {
    const orders = getLocalOrders();
    const order = {
        id: 'order-' + Date.now(),
        order_number: orderData.order_number || generateOrderNumber(),
        ...orderData,
        payment_status: 'pending',
        status: 'pending',
        created_at: new Date().toISOString()
    };
    orders.unshift(order);
    localStorage.setItem('chibest_orders', JSON.stringify(orders));
    return order;
}

function getLocalOrders() {
    return JSON.parse(localStorage.getItem('chibest_orders') || '[]');
}

function updateLocalOrderStatus(orderId, status) {
    const orders = getLocalOrders();
    const index = orders.findIndex(o => o.id === orderId);
    if (index > -1) {
        orders[index].status = status;
        orders[index].updated_at = new Date().toISOString();
        localStorage.setItem('chibest_orders', JSON.stringify(orders));
    }
}

function saveLocalRequest(requestData) {
    const requests = getLocalRequests();
    const request = {
        id: 'req-' + Date.now(),
        ...requestData,
        status: 'new',
        created_at: new Date().toISOString()
    };
    requests.unshift(request);
    localStorage.setItem('chibest_requests', JSON.stringify(requests));
    return request;
}

function getLocalRequests() {
    return JSON.parse(localStorage.getItem('chibest_requests') || '[]');
}

function getLocalReceipts() {
    return JSON.parse(localStorage.getItem('chibest_receipts') || '[]');
}

// =============================================
// EXPORTS
// =============================================

window.ChiBestDB = {
    initSupabase,
    Products: ProductsDB,
    Orders: OrdersDB,
    Requests: RequestsDB,
    Receipts: ReceiptsDB,
    generateOrderNumber
};

// Initialize with default products if needed
getLocalProducts();