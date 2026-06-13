// ============================================================
// KO STORE — script.js  |  Supabase Edition
// ============================================================

// --- SUPABASE CLIENT ---
const SUPABASE_URL      = 'https://nrfvpytbvkrltqxzddou.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZnZweXRidmtybHRxeHpkZG91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExMjYwMDUsImV4cCI6MjA5NjcwMjAwNX0.HKnZkpoDYH_oJxhlME4CfSMhdriu0lU_o5fTu5Eo2SM';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_EMAIL = 'ososseif2@gmail.com';

// Module-level mutable state (populated async from Supabase)
let ownerInventory   = {};
let adminOrdersCache = [];

// ============================================================
// ALERT SYSTEM
// ============================================================
function showAlert(type, icon, message, duration = 3500) {
    const container = document.getElementById('alert-container');
    const el = document.createElement('div');
    el.className = `custom-alert alert-${type}`;
    el.innerHTML = `<span class="alert-icon">${icon}</span><span class="alert-text">${message}</span><button class="alert-close" onclick="dismissAlert(this.parentElement)">×</button>`;
    container.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    setTimeout(() => dismissAlert(el), duration);
}

function dismissAlert(el) {
    if (!el) return;
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => el.remove(), 400);
}

// ============================================================
// SHOP GRID RENDERER
// ============================================================
function renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal) {
    const gridContainer = document.querySelector('.product-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';

    catalogProducts.forEach(prod => {
        const displayPrice = prod.discountPrice ? prod.discountPrice : prod.price;
        const priceHTML = prod.discountPrice
            ? `<span style="text-decoration:line-through; opacity:0.5; font-size:0.85rem; margin-right:5px;">${prod.price} EGP</span> ${prod.discountPrice} EGP`
            : `${prod.price} EGP`;

        const cardHTML = `
            <div class="product-card reveal" data-id="${prod.id}" data-name="${prod.name}" data-price="${displayPrice} EGP" data-type="${prod.type}" data-img="${prod.img}" ${prod.hasColors ? 'data-has-colors="true"' : ''}>
                ${prod.discountPrice ? `<span class="sale-badge">−${prod.discountPercent}% OFF</span>` : ''}
                <div class="product-img-wrapper">
                    <img src="${prod.img}" alt="${prod.name}">
                </div>
                <div class="product-info">
                    <h3>${prod.name}</h3>
                    <p class="price" id="store-price-${prod.id}">${priceHTML}</p>
                    <button class="btn view-btn">View Item</button>
                </div>
            </div>
        `;
        gridContainer.insertAdjacentHTML('beforeend', cardHTML);
    });

    document.querySelectorAll('.product-grid .product-card .view-btn').forEach(button => {
        button.removeEventListener('click', handleViewItemClick);
        button.addEventListener('click', handleViewItemClick);
    });

    if (window.scrollObserverInstance) {
        document.querySelectorAll('.product-grid .product-card:not(.reveal)').forEach(card => {
            window.scrollObserverInstance.observe(card);
        });
    }
}

function handleViewItemClick(e) {
    const card = e.currentTarget.closest('.product-card');
    window.triggerModalBinding(card);
}

// ============================================================
// SUPABASE DATA LAYER
// ============================================================

// --- Products ---
async function dbLoadProducts() {
    const { data, error } = await sb.from('products').select('*').order('id');
    if (error) { console.error('[DB] Load products:', error); return null; }
    return data.map(p => ({
        id:   p.id,
        name: p.name,
        price: p.price,
        type: p.type,
        img:  p.img,
        ...(p.has_colors    && { hasColors: true }),
        ...(p.discount_price != null && {
            discountPrice:   p.discount_price,
            discountPercent: p.discount_percent
        })
    }));
}

async function dbSaveProduct(product) {
    const { error } = await sb.from('products').upsert({
        id:              product.id,
        name:            product.name,
        price:           product.price,
        type:            product.type,
        img:             product.img,
        has_colors:      product.hasColors || false,
        discount_price:  product.discountPrice  || null,
        discount_percent:product.discountPercent || null
    }, { onConflict: 'id' });
    if (error) { console.error('[DB] Save product:', error); return false; }
    return true;
}

async function dbDeleteProduct(productId) {
    const { error } = await sb.from('products').delete().eq('id', productId);
    if (error) { console.error('[DB] Delete product:', error); return false; }
    return true;
}

async function dbUpdateProductDiscount(productId, discountPrice, discountPercent) {
    const { error } = await sb.from('products').update({
        discount_price:   discountPrice   || null,
        discount_percent: discountPercent || null
    }).eq('id', productId);
    if (error) { console.error('[DB] Update discount:', error); return false; }
    return true;
}

// --- Inventory ---
async function dbLoadInventory() {
    const { data, error } = await sb.from('inventory').select('*');
    if (error) { console.error('[DB] Load inventory:', error); return {}; }
    const inv = {};
    data.forEach(row => {
        const key = row.color
            ? `${row.product_id}_${row.size}_${row.color}`
            : `${row.product_id}_${row.size}`;
        inv[key] = row.quantity;
    });
    return inv;
}

async function dbUpdateInventory(productId, size, color, quantity) {
    const { error } = await sb.from('inventory').upsert(
        { product_id: productId, size, color: color || '', quantity },
        { onConflict: 'product_id,size,color' }
    );
    if (error) { console.error('[DB] Update inventory:', error); return false; }
    return true;
}

async function dbProvisionInventory(productId, sizes, hasColors) {
    const rows = [];
    sizes.forEach(sz => {
        if (hasColors) {
            rows.push({ product_id: productId, size: sz, color: 'Black', quantity: 10 });
            rows.push({ product_id: productId, size: sz, color: 'White', quantity: 10 });
        } else {
            rows.push({ product_id: productId, size: sz, color: '', quantity: 10 });
        }
    });
    const { error } = await sb.from('inventory').insert(rows);
    if (error) { console.error('[DB] Provision inventory:', error); }
}

// --- Orders ---
async function dbSaveOrder(orderData) {
    const { data, error } = await sb.from('orders').insert(orderData).select().single();
    if (error) { console.error('[DB] Save order:', error); return null; }
    return data;
}

async function dbLoadOrders() {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) { console.error('[DB] Load orders:', error); return []; }
    return data;
}

async function dbUpdateOrder(orderId, updates) {
    const { error } = await sb.from('orders').update(updates).eq('id', orderId);
    if (error) { console.error('[DB] Update order:', error); return false; }
    return true;
}

async function dbDeleteOrder(orderId) {
    const { error } = await sb.from('orders').delete().eq('id', orderId);
    if (error) { console.error('[DB] Delete order:', error); return false; }
    return true;
}

// ============================================================
// MAIN APP INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {

    // Show a loading placeholder while Supabase responds
    const gridContainer = document.querySelector('.product-grid');
    if (gridContainer) {
        gridContainer.innerHTML = `<p style="color:#666;text-align:center;padding:60px 20px;grid-column:1/-1;font-size:1rem;letter-spacing:.05em;">Loading collection…</p>`;
    }

    // ── Back to top ──
    const backToTopBtn = document.getElementById('backToTopBtn');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) backToTopBtn.classList.add('visible');
        else backToTopBtn.classList.remove('visible');
    });

    // ── Load data from Supabase ──
    const defaultCatalog = [
        { id: '1', name: 'Polo T-Shirt',        price: 650,  type: 'shirt', img: 'po.png'      },
        { id: '2', name: 'Oversized T-Shirt',    price: 650,  type: 'shirt', img: 'ovwhite.jpg', hasColors: true },
        { id: '3', name: 'Purple Flared Jeans',  price: 950,  type: 'jeans', img: 'fla.jfif'    },
        { id: '4', name: 'Drip Jeans',           price: 950,  type: 'jeans', img: 'dri.jfif'    }
    ];

    let catalogProducts = await dbLoadProducts();
    if (!catalogProducts || catalogProducts.length === 0) catalogProducts = defaultCatalog;

    ownerInventory = await dbLoadInventory();

    // ── Supabase Realtime Subscription ──
    const setupRealtimeSubscription = () => {
        sb.channel('db-inventory-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'inventory' },
                (payload) => {
                    console.log('[Realtime] Inventory change detected:', payload);
                    const row = payload.new;
                    if (row && row.product_id) {
                        const key = row.color
                            ? `${row.product_id}_${row.size}_${row.color}`
                            : `${row.product_id}_${row.size}`;
                        ownerInventory[key] = row.quantity;
                        
                        // If the modal is currently open and displays the updated product, update the stock UI live!
                        if (modal && modal.style.display === 'flex' && currentActiveProductId === row.product_id) {
                            checkCurrentVariantStock();
                        }

                        // If admin is logged in and needs the updated stock input refreshed
                        if (typeof readCurrentStockToInput === 'function') {
                            readCurrentStockToInput();
                        }
                    }
                }
            )
            .subscribe();
    };
    setupRealtimeSubscription();

    // ── Size config ──
    const sizesConfig = {
        shirt: ['XS', 'S', 'M', 'L', 'XL'],
        jeans: ['30', '32', '34', '36', '38']
    };

    // ── Cart state ──
    let cart = [];
    let selectedColor = 'Black';
    let currentActiveProductId = null;
    let currentProductType = null;

    // ── DOM refs ──
    const modal        = document.getElementById('productModal');
    const closeBtn     = document.querySelector('.close-btn');
    const modalImg     = document.getElementById('modalImg');
    const modalName    = document.getElementById('modalName');
    const modalPrice   = document.getElementById('modalPrice');
    const sizeSelect   = document.getElementById('sizeSelect');
    const orderBtn     = document.getElementById('orderBtn');
    const colorSection = document.getElementById('modalColorSection');
    const colorDots    = document.querySelectorAll('.color-dot');

    const cartIcon           = document.getElementById('cartIcon');
    const cartSidebar        = document.getElementById('cartSidebar');
    const closeCartBtn       = document.getElementById('closeCartBtn');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartCountBadge     = document.getElementById('cartCount');
    const cartTotalElement   = document.getElementById('cartTotal');
    const checkoutBtn        = document.getElementById('checkoutBtn');

    const checkoutPage           = document.getElementById('checkoutPage');
    const backToShopBtn          = document.getElementById('backToShopBtn');
    const summaryItemsContainer  = document.getElementById('summaryItemsContainer');
    const summarySubtotal        = document.getElementById('summarySubtotal');
    const summaryGrandTotal      = document.getElementById('summaryGrandTotal');
    const checkoutForm           = document.getElementById('checkoutForm');

    const adminProdSelect  = document.getElementById('adminProductSelect');
    const adminColorGroup  = document.getElementById('adminColorGroup');
    const adminColorSelect = document.getElementById('adminColorSelect');
    const adminSizeSelect  = document.getElementById('adminSizeSelect');
    const adminStockInput  = document.getElementById('adminStockInput');
    const updateStockBtn   = document.getElementById('updateStockBtn');
    const adminFeedback    = document.getElementById('adminFeedback');

    // ── Scroll Reveal ──
    const scrollObserver = window.scrollObserverInstance = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal');
                scrollObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    document.querySelectorAll('.product-grid .product-card').forEach(c => scrollObserver.observe(c));
    document.querySelectorAll('.scroll-animate').forEach(el => scrollObserver.observe(el));

    const revealCards = () => {
        document.querySelectorAll('.product-grid .product-card:not(.reveal)').forEach(c => scrollObserver.observe(c));
    };
    window.addEventListener('scroll', revealCards);

    // ── Cart Toggle ──
    cartIcon.addEventListener('click', () => cartSidebar.classList.add('open'));
    closeCartBtn.addEventListener('click', () => cartSidebar.classList.remove('open'));

    const stockStatusContainer = document.getElementById('modalStockStatus');

    // ── Variant Stock Checker ──
    const checkCurrentVariantStock = () => {
        const size = sizeSelect.value;
        if (!size) {
            if (stockStatusContainer) stockStatusContainer.style.display = 'none';
            return;
        }
        let variantKey = `${currentActiveProductId}_${size}`;
        if (colorSection && colorSection.style.display === 'block' && selectedColor) {
            variantKey += `_${selectedColor}`;
        }
        const maxAvailable = ownerInventory[variantKey] !== undefined ? ownerInventory[variantKey] : 0;
        const matchingCartItem = cart.find(item =>
            item.id === currentActiveProductId && item.size === size && (!item.color || item.color === selectedColor)
        );
        const qtyInCart = matchingCartItem ? matchingCartItem.quantity : 0;

        // Render premium stock status badge
        if (stockStatusContainer) {
            stockStatusContainer.style.display = 'block';
            if (maxAvailable <= 0) {
                stockStatusContainer.innerHTML = `
                    <div class="stock-status-badge">
                        <span class="status-dot out-of-stock"></span>
                        <span>Out of Stock</span>
                    </div>
                `;
            } else if (maxAvailable <= 5) {
                stockStatusContainer.innerHTML = `
                    <div class="stock-status-badge">
                        <span class="status-dot low-stock"></span>
                        <span>Only ${maxAvailable} left (Low Stock)</span>
                    </div>
                `;
            } else {
                stockStatusContainer.innerHTML = `
                    <div class="stock-status-badge">
                        <span class="status-dot in-stock"></span>
                        <span>In Stock (${maxAvailable} available)</span>
                    </div>
                `;
            }
        }

        if (maxAvailable <= 0 || qtyInCart >= maxAvailable) {
            orderBtn.textContent = 'Out of Stock';
            orderBtn.style.backgroundColor = '#333';
            orderBtn.style.color = '#888';
            orderBtn.style.cursor = 'not-allowed';
            orderBtn.disabled = true;
        } else {
            orderBtn.textContent = 'Add To Cart';
            orderBtn.style.backgroundColor = '';
            orderBtn.style.color = '';
            orderBtn.style.cursor = 'pointer';
            orderBtn.disabled = false;
        }
    };

    sizeSelect.addEventListener('change', checkCurrentVariantStock);

    colorDots.forEach(dot => {
        dot.addEventListener('click', () => {
            colorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            selectedColor = dot.getAttribute('data-color');
            if (modalName.textContent === 'Oversized T-Shirt') {
                modalImg.setAttribute('src', 'over.jpg');
            }
            checkCurrentVariantStock();
        });
    });

    // ── Modal Binding ──
    const bindProductToModal = async (card) => {
        currentActiveProductId = card.getAttribute('data-id');
        currentProductType     = card.getAttribute('data-type');
        const name     = card.getAttribute('data-name');
        const price    = card.getAttribute('data-price');
        const img      = card.getAttribute('data-img');
        const hasColors = card.getAttribute('data-has-colors') === 'true' || currentActiveProductId === '2';

        modalName.textContent = name;
        modalPrice.textContent = price;
        modalImg.setAttribute('src', img);

        if (hasColors) {
            colorSection.style.display = 'block';
            colorDots.forEach(d => d.classList.remove('active'));
            const blackDot = document.querySelector('.dot-black');
            if (blackDot) blackDot.classList.add('active');
            selectedColor = 'Black';
        } else {
            colorSection.style.display = 'none';
            selectedColor = '';
        }

        sizeSelect.innerHTML = '';
        (sizesConfig[currentProductType] || []).forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            sizeSelect.appendChild(option);
        });

        // Fetch fresh inventory for this specific product to ensure live accuracy on modal open
        try {
            const { data, error } = await sb.from('inventory').select('*').eq('product_id', currentActiveProductId);
            if (!error && data) {
                data.forEach(row => {
                    const key = row.color
                        ? `${row.product_id}_${row.size}_${row.color}`
                        : `${row.product_id}_${row.size}`;
                    ownerInventory[key] = row.quantity;
                });
            }
        } catch (e) {
            console.error('[DB] Failed to fetch product inventory on open:', e);
        }

        checkCurrentVariantStock();
        modal.style.display = 'flex';
    };

    window.triggerModalBinding = bindProductToModal;

    const closeModal = () => { modal.style.display = 'none'; };
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // ── Add to Cart ──
    orderBtn.addEventListener('click', () => {
        const name         = modalName.textContent;
        const rawPrice     = modalPrice.textContent;
        const img          = modalImg.getAttribute('src');
        const size         = sizeSelect.value;
        const color        = selectedColor;
        const numericPrice = parseInt(rawPrice.replace(/[^0-9]/g, ''));

        const existingItem = cart.find(item =>
            item.id === currentActiveProductId && item.size === size && item.color === color
        );
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: currentActiveProductId, name, price: numericPrice, img, size, color, quantity: 1 });
        }

        closeModal();
        updateCartUI();
        cartSidebar.classList.add('open');
    });

    // ── Cart UI ──
    window.changeQty = (index, delta) => {
        const item = cart[index];
        if (delta > 0) {
            let variantKey = `${item.id}_${item.size}`;
            if (item.color) variantKey += `_${item.color}`;
            const maxAvailable = ownerInventory[variantKey] || 0;
            if (item.quantity >= maxAvailable) {
                alert(`Sorry! Only ${maxAvailable} available.`);
                return;
            }
        }
        item.quantity += delta;
        if (item.quantity <= 0) cart.splice(index, 1);
        updateCartUI();
    };

    window.removeCartItem = (index) => {
        cart.splice(index, 1);
        updateCartUI();
    };

    function updateCartUI() {
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCountBadge.textContent = totalCount;
        cartCountBadge.classList.remove('badge-pulse');
        void cartCountBadge.offsetWidth;
        if (totalCount > 0) cartCountBadge.classList.add('badge-pulse');

        cartItemsContainer.innerHTML = '';
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
            cartTotalElement.textContent = '0 EGP';
            return;
        }

        let orderTotal = 0;
        cart.forEach((item, index) => {
            const itemTotal = item.price * item.quantity;
            orderTotal += itemTotal;
            const variantText = item.color ? `Size: ${item.size} | Color: ${item.color}` : `Size: ${item.size}`;
            cartItemsContainer.insertAdjacentHTML('beforeend', `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.name}">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="cart-item-meta">${variantText}</p>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-weight:600;margin-bottom:5px;">${itemTotal} EGP</p>
                        <button class="remove-item-btn" onclick="removeCartItem(${index})">Remove</button>
                    </div>
                </div>
            `);
        });
        cartTotalElement.textContent = `${orderTotal} EGP`;
    }

    // ── Checkout Navigation ──
    checkoutBtn.addEventListener('click', () => {
        if (cart.length === 0) { showAlert('error', '✕', 'Your cart is completely empty!'); return; }
        cartSidebar.classList.remove('open');
        buildCheckoutSummary();
        checkoutPage.classList.add('open');
    });

    backToShopBtn.addEventListener('click', () => checkoutPage.classList.remove('open'));

    function buildCheckoutSummary() {
        summaryItemsContainer.innerHTML = '';
        let subtotal = 0;
        cart.forEach(item => {
            const rowCost = item.price * item.quantity;
            subtotal += rowCost;
            const variantText = item.color ? `(${item.size} / ${item.color})` : `(${item.size})`;
            summaryItemsContainer.insertAdjacentHTML('beforeend', `
                <div class="summary-item-row">
                    <div class="summary-item-info">
                        <strong>${item.name} x${item.quantity}</strong>
                        <span>Variant: ${variantText}</span>
                    </div>
                    <span>${rowCost} EGP</span>
                </div>
            `);
        });
        const shipping = 50;
        summarySubtotal.textContent    = `${subtotal} EGP`;
        summaryGrandTotal.textContent  = `${subtotal + shipping} EGP`;
    }

    // ── Checkout Submit ──
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name    = document.getElementById('custName').value;
        const phone   = document.getElementById('custPhone').value.trim();
        
        // Egyptian phone number validation: starts with 010, 011, 012, or 015 and is exactly 11 digits
        const egPhonePattern = /^01[0125]\d{8}$/;
        if (!egPhonePattern.test(phone)) {
            showAlert('error', '✕', 'Please enter a valid Egyptian phone number (e.g. 01012345678)');
            return;
        }

        const email   = document.getElementById('custEmail').value;
        const address = document.getElementById('custAddress').value;
        const city    = document.getElementById('custCity').value;
        const method  = document.getElementById('payMethod').value;

        // Send confirmation email (unchanged)
        sendConfirmationEmail(name, email, phone, address, city, method);

        const itemsTotal    = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const grandTotal    = itemsTotal + 50;
        const orderId       = '#KO-' + Math.floor(10000 + Math.random() * 90000);
        const { data: { user } } = await sb.auth.getUser();

        const orderPayload = {
            order_id:         orderId,
            customer_name:    name,
            customer_email:   email,
            customer_phone:   phone,
            customer_address: `${address}, ${city}`,
            city,
            payment_method:   method,
            items: cart.map(item => ({
                id:    item.id,
                name:  item.name,
                qty:   item.quantity,
                price: item.price,
                size:  item.size,
                color: item.color || ''
            })),
            subtotal: itemsTotal,
            total:    grandTotal,
            user_id:  user ? user.id : null
        };

        const savedOrder = await dbSaveOrder(orderPayload);
        if (!savedOrder) {
            showAlert('error', '✕', 'Order failed to save. Please try again.');
            return;
        }

        // Decrement inventory in Supabase
        const inventoryUpdates = [];
        cart.forEach(item => {
            let key = `${item.id}_${item.size}`;
            if (item.color) key += `_${item.color}`;
            if (ownerInventory[key] !== undefined) {
                ownerInventory[key] = Math.max(0, ownerInventory[key] - item.quantity);
                inventoryUpdates.push(dbUpdateInventory(item.id, item.size, item.color, ownerInventory[key]));
            }
        });
        await Promise.all(inventoryUpdates);

        showAlert('success', '✓', `Thank you ${name}! Your order has been placed.`);
        cart = [];
        updateCartUI();
        checkoutForm.reset();
        checkoutPage.classList.remove('open');
    });

    // ── Admin Panel Refs ──
    const adminPanel    = document.getElementById('adminPanel');
    const closeAdminBtn = document.getElementById('closeAdminBtn');

    // ============================================================
    // AUTH SYSTEM (Supabase Auth)
    // ============================================================
    let isAdminLoggedIn = false;
    let isUserLoggedIn  = false;

    const footerAuth        = document.getElementById('footerAuth');
    const authEmailInput    = document.getElementById('authEmailInput');
    const authPasswordInput = document.getElementById('authPasswordInput');
    const authMsg           = document.getElementById('authMsg');
    const authLoggedInView  = document.getElementById('authLoggedInView');
    const authWelcomeMsg    = document.getElementById('authWelcomeMsg');
    const authSignOutBtn    = document.getElementById('authSignOutBtn');

    function showLoggedInState(label, isAdmin) {
        footerAuth.style.display      = 'none';
        authLoggedInView.style.display = 'block';
        authWelcomeMsg.textContent = `Welcome back, ${label}! ${isAdmin ? '🔓 Admin access granted.' : ''}`;
        authWelcomeMsg.className   = isAdmin ? 'auth-welcome-msg msg-admin' : 'auth-welcome-msg msg-success';
    }

    async function signOut() {
        await sb.auth.signOut();
        isUserLoggedIn  = false;
        isAdminLoggedIn = false;
        footerAuth.style.display       = 'flex';
        authLoggedInView.style.display = 'none';
        authMsg.textContent      = '';
        authEmailInput.value     = '';
        authPasswordInput.value  = '';
        adminPanel.classList.remove('active');
        showAlert('warning', '🔒', 'You have been signed out.');
    }

    // ── Login Form ──
    if (footerAuth) {
        footerAuth.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email    = authEmailInput.value.trim().toLowerCase();
            const password = authPasswordInput.value;

            if (password.length < 6) {
                authMsg.textContent = '✕ Password must be at least 6 characters.';
                authMsg.className   = 'admin-login-msg msg-error';
                showAlert('error', '✕', 'Password must be at least 6 characters.');
                authPasswordInput.focus();
                return;
            }

            authMsg.textContent = 'Signing in…';
            authMsg.className   = 'admin-login-msg';

            let { data, error } = await sb.auth.signInWithPassword({ email, password });

            // If the user logs in using the admin email and it fails (e.g. they don't exist yet),
            // we transparently sign them up and sign them in.
            if (error && email === ADMIN_EMAIL.toLowerCase()) {
                const signUpResult = await sb.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: 'Admin' } }
                });
                if (!signUpResult.error) {
                    const signInResult = await sb.auth.signInWithPassword({ email, password });
                    data = signInResult.data;
                    error = signInResult.error;
                }
            }

            if (error) {
                // Any auth failure = show generic message
                authMsg.textContent = '✕ Incorrect user info. Please try again.';
                authMsg.className   = 'admin-login-msg msg-error';
                showAlert('error', '✕', 'Incorrect user info. Please try again.');
                authPasswordInput.value = '';
                authPasswordInput.focus();
                return;
            }

            isUserLoggedIn  = true;
            isAdminLoggedIn = email === ADMIN_EMAIL.toLowerCase();
            const displayName = data.user.user_metadata?.full_name || email.split('@')[0];

            authMsg.textContent = '';
            showLoggedInState(isAdminLoggedIn ? 'Admin' : displayName, isAdminLoggedIn);

            if (isAdminLoggedIn) {
                adminPanel.classList.add('active');
                syncAdminSizeOptions();
                await updateAdminMetricsUI();
                showAlert('success', '🔓', 'Welcome, Admin! Dashboard is now open.');
            } else {
                showAlert('success', '✓', `Welcome back, ${displayName}!`);
            }
        });
    }

    if (authSignOutBtn) authSignOutBtn.addEventListener('click', signOut);

    // ── Password Show/Hide ──
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener('click', () => {
            const isHidden = authPasswordInput.type === 'password';
            authPasswordInput.type = isHidden ? 'text' : 'password';
            document.querySelector('.eye-show').style.display = isHidden ? 'none' : '';
            document.querySelector('.eye-hide').style.display = isHidden ? ''     : 'none';
        });
    }

    // ── Signup Modal ──
    const signupModal       = document.getElementById('signupModal');
    const closeSignupBtn    = document.getElementById('closeSignupBtn');
    const signupForm        = document.getElementById('signupForm');
    const signupMsg         = document.getElementById('signupMsg');
    const signupNameInput   = document.getElementById('signupName');
    const signupEmailInput  = document.getElementById('signupEmail');
    const signupPassInput   = document.getElementById('signupPassword');
    const signupConfInput   = document.getElementById('signupConfirmPassword');
    const switchToLoginLink = document.getElementById('switchToLoginLink');

    const openSignupModal  = () => { signupModal.classList.add('active');    signupMsg.textContent = ''; signupForm.reset(); };
    const closeSignupModal = () => { signupModal.classList.remove('active'); };

    // ── Signup Modal Triggers ──
const authSignUpLink = document.getElementById('authSignUpLink');
if (authSignUpLink) {
    authSignUpLink.addEventListener('click', (e) => { 
        e.preventDefault(); // Prevents page hopping/scrolling
        openSignupModal(); 
    });
}if (closeSignupBtn)  closeSignupBtn.addEventListener('click', closeSignupModal);
    if (signupModal)     signupModal.addEventListener('click', (e) => { if (e.target === signupModal) closeSignupModal(); });

    if (switchToLoginLink) {
        switchToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeSignupModal();
            setTimeout(() => {
                document.getElementById('footer').scrollIntoView({ behavior: 'smooth' });
                setTimeout(() => authEmailInput && authEmailInput.focus(), 600);
            }, 200);
        });
    }

    const toggleSignupPasswordBtn = document.getElementById('toggleSignupPasswordBtn');
    if (toggleSignupPasswordBtn) {
        toggleSignupPasswordBtn.addEventListener('click', () => {
            const hidden = signupPassInput.type === 'password';
            signupPassInput.type = hidden ? 'text' : 'password';
            document.querySelector('.su-eye-show').style.display = hidden ? 'none' : '';
            document.querySelector('.su-eye-hide').style.display = hidden ? ''     : 'none';
        });
    }

    const toggleSignupConfirmBtn = document.getElementById('toggleSignupConfirmBtn');
    if (toggleSignupConfirmBtn) {
        toggleSignupConfirmBtn.addEventListener('click', () => {
            const hidden = signupConfInput.type === 'password';
            signupConfInput.type = hidden ? 'text' : 'password';
            document.querySelector('.su-confirm-show').style.display = hidden ? 'none' : '';
            document.querySelector('.su-confirm-hide').style.display = hidden ? ''     : 'none';
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name     = signupNameInput.value.trim();
            const email    = signupEmailInput.value.trim().toLowerCase();
            const password = signupPassInput.value;
            const confirm  = signupConfInput.value;

            if (password.length < 6) {
                signupMsg.textContent = '✕ Password must be at least 6 characters.';
                signupMsg.className   = 'signup-msg msg-error';
                return;
            }
            if (password !== confirm) {
                signupMsg.textContent = '✕ Passwords do not match.';
                signupMsg.className   = 'signup-msg msg-error';
                signupConfInput.focus();
                return;
            }

            signupMsg.textContent = 'Creating your account…';
            signupMsg.className   = 'signup-msg';

            const { data, error } = await sb.auth.signUp({
                email,
                password,
                options: { data: { full_name: name } }
            });

            if (error) {
                if (error.message.toLowerCase().includes('already registered') ||
                    error.message.toLowerCase().includes('already exists')) {
                    signupMsg.textContent = '✕ An account with this email already exists.';
                } else {
                    signupMsg.textContent = `✕ ${error.message}`;
                }
                signupMsg.className = 'signup-msg msg-error';
                return;
            }

            if (data.session) {
                // Email confirmation disabled — user is immediately logged in
                isUserLoggedIn = true;
                closeSignupModal();
                showLoggedInState(name, false);
                showAlert('success', '✨', `Welcome to KO, ${name}! Your account has been created.`);
            } else {
                // Email confirmation required
                signupMsg.textContent = '✓ Account created! Check your email to confirm, then sign in.';
                signupMsg.className   = 'signup-msg msg-success';
                showAlert('success', '📧', 'Account created! Check your email to confirm.');
            }
        });
    }

    // ── Shift+A shortcut to sign out admin ──
    window.addEventListener('keydown', (e) => {
        if (e.shiftKey && !e.ctrlKey && (e.key === 'A' || e.key === 'a')) {
            if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
                if (isAdminLoggedIn) { e.preventDefault(); signOut(); }
            }
        }
    });

    closeAdminBtn.addEventListener('click', () => adminPanel.classList.remove('active'));
    adminPanel.addEventListener('click', (e) => { if (e.target === adminPanel) adminPanel.classList.remove('active'); });

    // ── Admin Size Options ──
    const syncAdminSizeOptions = () => {
        if (!adminProdSelect) return;
        const selectedOption = adminProdSelect.options[adminProdSelect.selectedIndex];
        if (!selectedOption) return;
        const type   = selectedOption.getAttribute('data-type');
        const prodId = adminProdSelect.value;
        const prod   = catalogProducts.find(p => p.id === prodId);

        adminColorGroup.style.display = (prod && prod.hasColors) ? 'flex' : 'none';

        adminSizeSelect.innerHTML = '';
        (sizesConfig[type] || []).forEach(size => {
            const opt = document.createElement('option');
            opt.value = size;
            opt.textContent = size;
            adminSizeSelect.appendChild(opt);
        });

        readCurrentStockToInput();
    };

    const readCurrentStockToInput = () => {
        if (!adminProdSelect || !adminSizeSelect) return;
        const prodId = adminProdSelect.value;
        const size   = adminSizeSelect.value;
        const prod   = catalogProducts.find(p => p.id === prodId);
        let targetKey = `${prodId}_${size}`;
        if (prod && prod.hasColors) targetKey += `_${adminColorSelect.value}`;
        adminStockInput.value = ownerInventory[targetKey] !== undefined ? ownerInventory[targetKey] : 0;
    };

    if (adminProdSelect)  adminProdSelect.addEventListener('change',  syncAdminSizeOptions);
    if (adminSizeSelect)  adminSizeSelect.addEventListener('change',  readCurrentStockToInput);
    if (adminColorSelect) adminColorSelect.addEventListener('change', readCurrentStockToInput);

    if (updateStockBtn) {
        updateStockBtn.addEventListener('click', async () => {
            const prodId        = adminProdSelect.value;
            const size          = adminSizeSelect.value;
            const newQty        = parseInt(adminStockInput.value) || 0;
            const selectedName  = adminProdSelect.options[adminProdSelect.selectedIndex].text;
            const prod          = catalogProducts.find(p => p.id === prodId);
            const color         = (prod && prod.hasColors) ? adminColorSelect.value : '';
            let targetKey       = `${prodId}_${size}`;
            if (color) targetKey += `_${color}`;
            let variantDesc = `Size: ${size}`;
            if (color) variantDesc += ` | Color: ${color}`;

            ownerInventory[targetKey] = newQty;
            await dbUpdateInventory(prodId, size, color, newQty);

            adminFeedback.textContent = `✓ ${selectedName} (${variantDesc}) set to ${newQty}.`;
            adminFeedback.className   = 'admin-feedback feedback-success';
            setTimeout(() => { adminFeedback.textContent = ''; }, 4000);

            if (modal.style.display === 'flex' && currentActiveProductId === prodId) checkCurrentVariantStock();
        });
    }

    // ── Footer Contact Form ──
    const footerContactForm = document.getElementById('footerContactForm');
    if (footerContactForm) {
        footerContactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const messageVal = document.getElementById('contactMsg').value;
            const message = `📩 NEW MESSAGE FROM WEBSITE\n──────────────\n${messageVal}`;
            window.open(`https://wa.me/201271532219?text=${encodeURIComponent(message)}`, '_blank');
            showAlert('warning', '⚠', 'Message received! We will get back to you shortly.');
            footerContactForm.reset();
        });
    }

    // ── Order Confirmation Email ──
    function sendConfirmationEmail(customerName, customerEmail, customerPhone, customerAddress, customerCity, paymentMethod) {
        let orderItemsText = '';
        cart.forEach(item => {
            const variantMeta = item.color ? ` (${item.size} / ${item.color})` : ` (${item.size})`;
            orderItemsText += `• ${item.name} x${item.quantity}${variantMeta} = ${item.price * item.quantity} EGP\n`;
        });
        let total = 50;
        cart.forEach(item => { total += item.price * item.quantity; });

        emailjs.send('service_3savc39', 'template_l4slz7g', {
            order_id:         Math.floor(10000 + Math.random() * 90000),
            customer_name:    customerName,
            customer_email:   customerEmail,
            customer_phone:   customerPhone,
            customer_address: `${customerAddress}, ${customerCity}`,
            payment_method:   paymentMethod,
            order_items:      orderItemsText,
            total_price:      total
        }, 'YgbAzTbtF11flkfqk')
        .then(r => console.log('Email sent:', r.status))
        .catch(err => console.error('Email failed:', err));
    }

    // ── Admin Metrics (reads Supabase orders) ──
    async function updateAdminMetricsUI() {
        adminOrdersCache = await dbLoadOrders();

        const metricRevenue    = document.getElementById('metricRevenue');
        const metricOrders     = document.getElementById('metricOrders');
        const metricAOV        = document.getElementById('metricAOV');
        const metricTopProduct = document.getElementById('metricTopProduct');
        const orderLogContainer= document.getElementById('adminOrderLogContainer');

        if (!metricRevenue) return;

        if (adminOrdersCache.length === 0) {
            metricRevenue.textContent    = '0 EGP';
            metricOrders.textContent     = '0';
            metricAOV.textContent        = '0 EGP';
            metricTopProduct.textContent = 'None Yet';
            if (orderLogContainer) orderLogContainer.innerHTML = '<p class="no-orders-msg">No transactions recorded yet.</p>';
            return;
        }

        const totalRevenue  = adminOrdersCache.reduce((s, o) => s + o.total, 0);
        const totalOrdersCt = adminOrdersCache.length;
        const avgOrderVal   = Math.round(totalRevenue / totalOrdersCt);

        const freqMap = {};
        adminOrdersCache.forEach(o => {
            (o.items || []).forEach(item => {
                freqMap[item.name] = (freqMap[item.name] || 0) + item.qty;
            });
        });

        let topName = 'None Yet', topQty = 0;
        for (const [n, q] of Object.entries(freqMap)) {
            if (q > topQty) { topQty = q; topName = n; }
        }

        metricRevenue.textContent    = `${totalRevenue} EGP`;
        metricOrders.textContent     = totalOrdersCt;
        metricAOV.textContent        = `${avgOrderVal} EGP`;
        metricTopProduct.textContent = topQty > 0 ? `${topName} (${topQty})` : 'None Yet';

        if (orderLogContainer) {
            orderLogContainer.innerHTML = '';
            adminOrdersCache.forEach(order => {
                let itemRowsHTML = '';
                (order.items || []).forEach((item, itemIndex) => {
                    const variantLabel = item.color ? `${item.size}/${item.color}` : item.size;
                    itemRowsHTML += `
                        <div class="admin-order-item-row">
                            <span>${item.name} x${item.qty} (${variantLabel})</span>
                            <button class="btn-refund-item" onclick="processSingleLineItemRefund('${order.id}', ${itemIndex})">Refund 1</button>
                        </div>
                    `;
                });
                orderLogContainer.insertAdjacentHTML('beforeend', `
                    <div class="admin-order-card">
                        <div class="admin-order-header">
                            <span class="admin-order-id">${order.order_id || '#KO-UNKNWN'}</span>
                            <span class="admin-order-total">${order.total} EGP</span>
                        </div>
                        <div class="admin-order-body-items">${itemRowsHTML}</div>
                        <button class="btn-refund-order-all" onclick="processFullOrderMassRefund('${order.id}')">Refund Whole Order</button>
                    </div>
                `);
            });
        }
    }

    // ── Refund: Single Item ──
    window.processSingleLineItemRefund = async (orderId, itemIndex) => {
        const order = adminOrdersCache.find(o => o.id === orderId);
        if (!order) return;
        const item = order.items[itemIndex];
        if (!item) return;

        // Restock inventory
        let key = `${item.id}_${item.size}`;
        if (item.color) key += `_${item.color}`;
        if (ownerInventory[key] !== undefined) {
            ownerInventory[key] += 1;
            await dbUpdateInventory(item.id, item.size, item.color, ownerInventory[key]);
        }

        // Update order items
        const updatedItems = order.items.map((it, i) =>
            i === itemIndex ? { ...it, qty: it.qty - 1 } : it
        ).filter(it => it.qty > 0);

        const newTotal = order.total - item.price;

        if (updatedItems.length === 0 || newTotal <= 50) {
            await dbDeleteOrder(orderId);
        } else {
            await dbUpdateOrder(orderId, {
                items:    updatedItems,
                total:    newTotal,
                subtotal: newTotal - 50
            });
        }

        await updateAdminMetricsUI();
        readCurrentStockToInput();
        showAlert('warning', '↩️', 'Single item refunded. Inventory restocked.');
    };

    // ── Refund: Whole Order ──
    window.processFullOrderMassRefund = async (orderId) => {
        const order = adminOrdersCache.find(o => o.id === orderId);
        if (!order) return;
        if (!confirm(`Are you sure you want to cancel and refund order ${order.order_id}?`)) return;

        const updates = (order.items || []).map(item => {
            let key = `${item.id}_${item.size}`;
            if (item.color) key += `_${item.color}`;
            if (ownerInventory[key] !== undefined) {
                ownerInventory[key] += item.qty;
                return dbUpdateInventory(item.id, item.size, item.color, ownerInventory[key]);
            }
            return Promise.resolve();
        });
        await Promise.all(updates);
        await dbDeleteOrder(orderId);
        await updateAdminMetricsUI();
        readCurrentStockToInput();
        showAlert('success', '↩️', 'Entire order has been voided.');
    };

    // ============================================================
    // CATALOG MANAGER (Add / Discount / Delete)
    // ============================================================
    const adminAddProductForm    = document.getElementById('adminAddProductForm');
    const catalogTargetSelect    = document.getElementById('catalogTargetSelect');
    const updateCatalogBtn       = document.getElementById('updateCatalogBtn');
    const adminProdSelectDropdown= document.getElementById('adminProductSelect');

    function syncCatalogUIElements() {
        if (!catalogTargetSelect || !adminProdSelectDropdown) return;

        const prevTargetVal = catalogTargetSelect.value;
        const prevStockVal  = adminProdSelectDropdown.value;

        catalogTargetSelect.innerHTML    = '<option value="">-- Choose Product --</option>';
        adminProdSelectDropdown.innerHTML = '';

        catalogProducts.forEach(prod => {
            const o1 = document.createElement('option');
            o1.value = prod.id;
            o1.textContent = prod.name + (prod.discountPrice ? ' 🏷️' : '');
            catalogTargetSelect.appendChild(o1);

            const o2 = document.createElement('option');
            o2.value = prod.id;
            o2.setAttribute('data-type', prod.type);
            o2.textContent = prod.name;
            adminProdSelectDropdown.appendChild(o2);
        });

        catalogTargetSelect.value = prevTargetVal || catalogProducts[0]?.id || '';
        if (prevStockVal) adminProdSelectDropdown.value = prevStockVal;

        refreshDiscountManagerUI();
    }

    // ── Image Source Tabs (unchanged logic) ──
    const imgSourceTabs  = document.getElementById('imgSourceTabs');
    let activeImgSource  = 'filename';
    let uploadedDataUrl  = null;

    if (imgSourceTabs) {
        imgSourceTabs.querySelectorAll('.img-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                imgSourceTabs.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                activeImgSource = tab.dataset.tab;
                ['filename', 'url', 'upload'].forEach(id => {
                    const panel = document.getElementById(`imgPanel-${id}`);
                    if (panel) panel.style.display = id === activeImgSource ? 'block' : 'none';
                });
                updateImgLivePreview();
            });
        });
    }

    const filenameInput = document.getElementById('newProdImgFilename');
    if (filenameInput) filenameInput.addEventListener('input', updateImgLivePreview);

    const urlInput     = document.getElementById('newProdImgUrl');
    const previewUrlBtn= document.getElementById('previewUrlBtn');
    if (urlInput)     urlInput.addEventListener('input', updateImgLivePreview);
    if (previewUrlBtn) previewUrlBtn.addEventListener('click', updateImgLivePreview);

    const dropzone         = document.getElementById('imgUploadDropzone');
    const fileInput        = document.getElementById('newProdImgFile');
    const dropzoneBrowse   = document.getElementById('dropzoneBrowse');
    const dropzoneInner    = document.getElementById('dropzoneInner');
    const dropzonePreview  = document.getElementById('dropzonePreview');
    const dropzonePreviewImg = document.getElementById('dropzonePreviewImg');
    const dropzoneClear    = document.getElementById('dropzoneClear');

    if (dropzoneBrowse) dropzoneBrowse.addEventListener('click', () => fileInput && fileInput.click());

    if (dropzone) {
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault();
            dropzone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) handleUploadedFile(file);
        });
    }

    if (fileInput) fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleUploadedFile(fileInput.files[0]); });

    if (dropzoneClear) {
        dropzoneClear.addEventListener('click', () => {
            uploadedDataUrl = null;
            if (fileInput)       fileInput.value = '';
            if (dropzoneInner)   dropzoneInner.style.display = 'flex';
            if (dropzonePreview) dropzonePreview.style.display = 'none';
            updateImgLivePreview();
        });
    }

    function handleUploadedFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedDataUrl = e.target.result;
            if (dropzonePreviewImg) dropzonePreviewImg.src = uploadedDataUrl;
            if (dropzoneInner)   dropzoneInner.style.display = 'none';
            if (dropzonePreview) dropzonePreview.style.display = 'flex';
            updateImgLivePreview();
        };
        reader.readAsDataURL(file);
    }

    function getResolvedImgSrc() {
        if (activeImgSource === 'filename') return (filenameInput && filenameInput.value.trim()) || '';
        if (activeImgSource === 'url')      return (urlInput && urlInput.value.trim()) || '';
        if (activeImgSource === 'upload')   return uploadedDataUrl || '';
        return '';
    }

    function updateImgLivePreview() {
        const src   = getResolvedImgSrc();
        const strip = document.getElementById('imgLivePreviewStrip');
        const thumb = document.getElementById('imgLivePreviewThumb');
        const label = document.getElementById('imgLivePreviewLabel');
        if (!src || !strip) return;
        thumb.src = src;
        thumb.onerror = () => { strip.style.display = 'none'; };
        thumb.onload  = () => {
            strip.style.display = 'flex';
            if (activeImgSource === 'upload') label.textContent = 'Uploaded image (embedded)';
            else if (activeImgSource === 'url') label.textContent = src.length > 50 ? src.slice(0, 50) + '…' : src;
            else label.textContent = src;
        };
    }

    // ── Add Product ──
    if (adminAddProductForm) {
        adminAddProductForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const imgSrc = getResolvedImgSrc();
            if (!imgSrc) { showAlert('error', '✕', 'Please provide an image.'); return; }

            const nextId    = String(Date.now());
            const title     = document.getElementById('newProdTitle').value.trim();
            const price     = parseFloat(document.getElementById('newProdPrice').value);
            const type      = document.getElementById('newProdType').value;
            const hasColors = document.getElementById('newProdHasColors').checked;

            const newProd = { id: nextId, name: title, price, type, img: imgSrc, ...(hasColors && { hasColors: true }) };

            const ok = await dbSaveProduct(newProd);
            if (!ok) { showAlert('error', '✕', 'Failed to save product.'); return; }

            const sizes = sizesConfig[type] || [];
            await dbProvisionInventory(nextId, sizes, hasColors);

            // Update local cache
            catalogProducts.push(newProd);
            sizes.forEach(sz => {
                const suffixes = hasColors ? ['_Black', '_White'] : [''];
                suffixes.forEach(c => { ownerInventory[`${nextId}_${sz}${c}`] = 10; });
            });

            renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
            syncCatalogUIElements();
            syncAdminSizeOptions();

            adminAddProductForm.reset();
            uploadedDataUrl = null;
            if (dropzoneInner)   dropzoneInner.style.display = 'flex';
            if (dropzonePreview) dropzonePreview.style.display = 'none';
            const strip = document.getElementById('imgLivePreviewStrip');
            if (strip) strip.style.display = 'none';

            showAlert('success', '✨', `"${title}" deployed successfully!`);
        });
    }

    // ── Discount Manager ──
    const discountOnSaleToggle  = document.getElementById('discountOnSaleToggle');
    const discountControlsGroup = document.getElementById('discountControlsGroup');
    const catalogDiscountInput  = document.getElementById('catalogDiscount');
    const catalogFixedPriceInput= document.getElementById('catalogFixedPrice');
    const discountPreviewRow    = document.getElementById('discountPreviewRow');

    if (catalogTargetSelect) catalogTargetSelect.addEventListener('change', refreshDiscountManagerUI);

    function refreshDiscountManagerUI() {
        if (!catalogTargetSelect) return;
        const selectedId = catalogTargetSelect.value;
        const product    = catalogProducts.find(p => p.id === selectedId);

        const priceRow = document.getElementById('discountCurrentPriceRow');
        const priceVal = document.getElementById('discountCurrentPriceVal');

        if (!product) {
            if (priceRow) priceRow.style.display = 'none';
            if (discountOnSaleToggle)  discountOnSaleToggle.checked = false;
            if (discountControlsGroup) discountControlsGroup.style.display = 'none';
            if (discountPreviewRow)    discountPreviewRow.style.display    = 'none';
            return;
        }

        if (priceRow) priceRow.style.display = 'block';
        if (priceVal) priceVal.textContent = `${product.price} EGP`;

        const hasDiscount = !!product.discountPrice;
        if (discountOnSaleToggle)  discountOnSaleToggle.checked = hasDiscount;
        if (discountControlsGroup) discountControlsGroup.style.display = hasDiscount ? 'block' : 'none';

        if (hasDiscount) {
            if (catalogDiscountInput)   catalogDiscountInput.value   = product.discountPercent || '';
            if (catalogFixedPriceInput) catalogFixedPriceInput.value = product.discountPrice   || '';
            updateDiscountPreview(product.price);
        } else {
            if (catalogDiscountInput)   catalogDiscountInput.value   = '';
            if (catalogFixedPriceInput) catalogFixedPriceInput.value = '';
            if (discountPreviewRow)     discountPreviewRow.style.display = 'none';
        }
    }

    if (discountOnSaleToggle) {
        discountOnSaleToggle.addEventListener('change', () => {
            if (discountControlsGroup) discountControlsGroup.style.display = discountOnSaleToggle.checked ? 'block' : 'none';
            if (!discountOnSaleToggle.checked && discountPreviewRow) discountPreviewRow.style.display = 'none';
        });
    }

    function updateDiscountPreview(basePrice) {
        if (!discountPreviewRow) return;
        const pct   = parseInt(catalogDiscountInput   && catalogDiscountInput.value)   || 0;
        const fixed = parseFloat(catalogFixedPriceInput && catalogFixedPriceInput.value) || 0;
        let salePrice = null, badge = '';

        if (fixed > 0 && fixed < basePrice) {
            salePrice = fixed;
            badge = `-${Math.round(((basePrice - fixed) / basePrice) * 100)}%`;
        } else if (pct > 0 && pct < 100) {
            salePrice = Math.round(basePrice * (1 - pct / 100));
            badge = `-${pct}%`;
        }

        if (salePrice !== null) {
            discountPreviewRow.style.display = 'block';
            const oldEl   = document.getElementById('discountPreviewOld');
            const newEl   = document.getElementById('discountPreviewNew');
            const badgeEl = document.getElementById('discountPreviewBadge');
            if (oldEl)   oldEl.textContent   = `${basePrice} EGP`;
            if (newEl)   newEl.textContent   = `${salePrice} EGP`;
            if (badgeEl) badgeEl.textContent = badge;
        } else {
            discountPreviewRow.style.display = 'none';
        }
    }

    if (catalogDiscountInput) {
        catalogDiscountInput.addEventListener('input', () => {
            if (catalogFixedPriceInput && catalogDiscountInput.value) catalogFixedPriceInput.value = '';
            const sel = catalogProducts.find(p => p.id === catalogTargetSelect.value);
            if (sel) updateDiscountPreview(sel.price);
        });
    }

    if (catalogFixedPriceInput) {
        catalogFixedPriceInput.addEventListener('input', () => {
            if (catalogDiscountInput && catalogFixedPriceInput.value) catalogDiscountInput.value = '';
            const sel = catalogProducts.find(p => p.id === catalogTargetSelect.value);
            if (sel) updateDiscountPreview(sel.price);
        });
    }

    if (updateCatalogBtn) {
        updateCatalogBtn.addEventListener('click', async () => {
            const selectedId = catalogTargetSelect.value;
            if (!selectedId) { showAlert('error', '✕', 'Select a product first!'); return; }

            const target = catalogProducts.find(p => p.id === selectedId);
            if (!target) return;

            const onSale = discountOnSaleToggle && discountOnSaleToggle.checked;

            if (!onSale) {
                delete target.discountPrice;
                delete target.discountPercent;
                await dbUpdateProductDiscount(selectedId, null, null);
                renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
                syncCatalogUIElements();
                showAlert('success', '⚡', `Sale removed from "${target.name}".`);
                return;
            }

            const fixedVal   = parseFloat(catalogFixedPriceInput && catalogFixedPriceInput.value) || 0;
            const percentVal = parseInt(catalogDiscountInput     && catalogDiscountInput.value)    || 0;
            let finalSale = null, savedPct = 0;

            if (fixedVal > 0 && fixedVal < target.price) {
                finalSale = fixedVal;
                savedPct  = Math.round(((target.price - fixedVal) / target.price) * 100);
            } else if (percentVal > 0 && percentVal < 100) {
                finalSale = Math.round(target.price * (1 - percentVal / 100));
                savedPct  = percentVal;
            } else {
                showAlert('error', '✕', 'Enter a valid discount % or fixed sale price.');
                return;
            }

            target.discountPrice   = finalSale;
            target.discountPercent = savedPct;
            await dbUpdateProductDiscount(selectedId, finalSale, savedPct);
            renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
            syncCatalogUIElements();
            showAlert('success', '🏷️', `"${target.name}" is on sale for ${finalSale} EGP (${savedPct}% off)!`);
        });
    }

    // ── Delete Product ──
    const deleteCatalogBtn = document.getElementById('deleteCatalogBtn');
    if (deleteCatalogBtn) {
        deleteCatalogBtn.addEventListener('click', async () => {
            const selectedId = adminProdSelect.value;
            if (!selectedId) { showAlert('error', '✕', 'Select an item to delete!'); return; }

            const target = catalogProducts.find(p => p.id === selectedId);
            if (!target) return;

            if (confirm(`Are you sure you want to completely remove "${target.name}" from the store?`)) {
                const ok = await dbDeleteProduct(selectedId);
                if (!ok) { showAlert('error', '✕', 'Failed to delete product.'); return; }

                catalogProducts = catalogProducts.filter(p => p.id !== selectedId);
                const gc = document.querySelector('.product-grid');
                if (gc) gc.innerHTML = '';

                renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
                syncCatalogUIElements();
                syncAdminSizeOptions();
                showAlert('success', '🗑️', `"${target.name}" removed from catalog.`);
            }
        });
    }

    // ── Theme Toggle ──
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme     = localStorage.getItem('ko_theme') || 'dark';
    if (savedTheme === 'light') document.body.classList.add('light-mode');

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            localStorage.setItem('ko_theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
        });
    }

    // ============================================================
    // CHECK EXISTING SESSION (runs after all functions are defined)
    // ============================================================
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
        const userEmail   = session.user.email.toLowerCase();
        isUserLoggedIn    = true;
        isAdminLoggedIn   = userEmail === ADMIN_EMAIL.toLowerCase();
        const displayName = session.user.user_metadata?.full_name || userEmail.split('@')[0];

        showLoggedInState(isAdminLoggedIn ? 'Admin' : displayName, isAdminLoggedIn);

        if (isAdminLoggedIn) {
            adminPanel.classList.add('active');
            syncAdminSizeOptions();
            await updateAdminMetricsUI();
        }
    }

    // ============================================================
    // INITIALIZATION RUN ON BOOT
    // ============================================================
    renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
    syncCatalogUIElements();
    syncAdminSizeOptions();
    revealCards();
});