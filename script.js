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

// 1. ISOLATED HELPER FUNCTIONS FOR DYNAMIC SHOP RENDERING
function renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal) {
    const gridContainer = document.querySelector(".product-grid");
    if (!gridContainer) return;

    // Always do a full clean redraw so discounts/prices always reflect current catalog state
    gridContainer.innerHTML = "";

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
        gridContainer.insertAdjacentHTML("beforeend", cardHTML);
    });

    // Re-attach view button listeners globally
    document.querySelectorAll(".product-grid .product-card .view-btn").forEach(button => {
        button.removeEventListener("click", handleViewItemClick);
        button.addEventListener("click", handleViewItemClick);
    });

    // Re-observe new cards for scroll animations
    if (window.scrollObserverInstance) {
        document.querySelectorAll(".product-grid .product-card:not(.reveal)").forEach(card => {
            window.scrollObserverInstance.observe(card);
        });
    }
}

function handleViewItemClick(e) {
    const card = e.currentTarget.closest(".product-card");
    // Fires global modal binding sequence handled inside DOMContentLoaded
    window.triggerModalBinding(card);
}


// 2. MAIN APP INITIALIZATION PIPELINE
document.addEventListener("DOMContentLoaded", () => {
    const backToTopBtn = document.getElementById("backToTopBtn");
    window.addEventListener("scroll", () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add("visible");
        } else {
            backToTopBtn.classList.remove("visible");
        }
    });

    // --- OWNER'S MASTER VARIANT INVENTORY ---
    const ownerInventory = {
        "1_XS": 5, "1_S": 10, "1_M": 15, "1_L": 12, "1_XL": 8,
        "2_XS_Black": 5, "2_S_Black": 8, "2_M_Black": 0, "2_L_Black": 10, "2_XL_Black": 4,
        "2_XS_White": 3, "2_S_White": 0, "2_M_White": 12, "2_L_White": 7, "2_XL_White": 6,
        "3_30": 5, "3_32": 8, "3_34": 10, "3_36": 6, "3_38": 4,
        "4_30": 3, "4_32": 5, "4_34": 0, "4_36": 4, "4_38": 2
    };

    // PERSISTENT CATALOG DATABASE DATABASE ARRAY (Checks localStorage first)
    let catalogProducts = JSON.parse(localStorage.getItem("ko_catalog")) || [
        { id: "1", name: "Polo T-Shirt",       price: 650,  type: "shirt", img: "po.png"      },
        { id: "2", name: "Oversized T-Shirt",   price: 650,  type: "shirt", img: "ovwhite.jpg", hasColors: true },
        { id: "3", name: "Purple Flared Jeans", price: 950,  type: "jeans", img: "fla.jfif"    },
        { id: "4", name: "Drip Jeans",          price: 950,  type: "jeans", img: "dri.jfif"    }
    ];

    const sizesConfig = {
        shirt: ['XS', 'S', 'M', 'L', 'XL'],
        jeans: ['30', '32', '34', '36', '38']
    };

    let cart = [];
    let selectedColor = "Black"; 
    let currentActiveProductId = null; 
    let currentProductType = null;

    // --- DOM Elements ---
    const modal = document.getElementById("productModal");
    const closeBtn = document.querySelector(".close-btn");
    const modalImg = document.getElementById("modalImg");
    const modalName = document.getElementById("modalName");
    const modalPrice = document.getElementById("modalPrice");
    // --- Size Pill Shim (replaces <select> with pill buttons) ---
    const sizePillsContainer = document.getElementById("sizePills");
    const sizeSelect = {
        get value() {
            const active = sizePillsContainer.querySelector(".size-pill.active");
            return active ? active.dataset.size : "";
        }
    };
    const orderBtn = document.getElementById("orderBtn");
    const colorSection = document.getElementById("modalColorSection");
    const colorDots = document.querySelectorAll(".color-dot");

    const cartIcon = document.getElementById("cartIcon");
    const cartSidebar = document.getElementById("cartSidebar");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const cartItemsContainer = document.getElementById("cartItemsContainer");
    const cartCountBadge = document.getElementById("cartCount");
    const cartTotalElement = document.getElementById("cartTotal");
    const checkoutBtn = document.getElementById("checkoutBtn");

    // Checkout Page Elements
    const checkoutPage = document.getElementById("checkoutPage");
    const backToShopBtn = document.getElementById("backToShopBtn");
    const summaryItemsContainer = document.getElementById("summaryItemsContainer");
    const summarySubtotal = document.getElementById("summarySubtotal");
    const summaryGrandTotal = document.getElementById("summaryGrandTotal");
    const checkoutForm = document.getElementById("checkoutForm");

    // Admin Interface Selectors
    const adminProdSelect = document.getElementById("adminProductSelect");
    const adminColorGroup = document.getElementById("adminColorGroup");
    const adminColorSelect = document.getElementById("adminColorSelect");
    const adminSizeSelect = document.getElementById("adminSizeSelect");
    const adminStockInput = document.getElementById("adminStockInput");
    const updateStockBtn = document.getElementById("updateStockBtn");
    const adminFeedback = document.getElementById("adminFeedback");

    // --- Scroll Reveal Engine (IntersectionObserver) ---
    const scrollObserver = window.scrollObserverInstance = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("reveal");
                scrollObserver.unobserve(entry.target); // fire once only
            }
        });
    }, { threshold: 0.12 });

    // Observe product cards
    document.querySelectorAll(".product-grid .product-card").forEach(card => {
        scrollObserver.observe(card);
    });

    // Observe all other scroll-animate elements
    document.querySelectorAll(".scroll-animate").forEach(el => {
        scrollObserver.observe(el);
    });

    // Re-observe newly rendered product cards after grid redraws
    const revealCards = () => {
        document.querySelectorAll(".product-grid .product-card:not(.reveal)").forEach(card => {
            scrollObserver.observe(card);
        });
    };
    window.addEventListener("scroll", revealCards);
// --- Safe Cart Toggle Animations ---
   
    // --- Safe Cart Toggle Animations ---
    const cartOverlay = document.getElementById("cartOverlay");

    const openCart = () => {
        cartSidebar.classList.add("open");
        if (cartOverlay) cartOverlay.classList.add("active");
        // Prevent background document scrolling when full screen cart is open on phone
        document.body.style.overflow = "hidden";
    };

    const closeCart = () => {
        cartSidebar.classList.remove("open");
        if (cartOverlay) cartOverlay.classList.remove("active");
        document.body.style.overflow = "";
    };

    cartIcon.addEventListener("click", openCart);
    closeCartBtn.addEventListener("click", closeCart);
    if (cartOverlay) {
        cartOverlay.addEventListener("click", closeCart);
    }
    // --- Dynamic Stock Verifier ---
    const checkCurrentVariantStock = () => {
        const size = sizeSelect.value;
        let variantKey = `${currentActiveProductId}_${size}`;
        if (colorSection.style.display === "block" && selectedColor) {
            variantKey += `_${selectedColor}`;
        }

        const maxAvailable = ownerInventory[variantKey] !== undefined ? ownerInventory[variantKey] : 0;
        const matchingCartItem = cart.find(item => 
            item.id === currentActiveProductId && item.size === size && (!item.color || item.color === selectedColor)
        );
        const qtyInCart = matchingCartItem ? matchingCartItem.quantity : 0;

        if (maxAvailable <= 0 || qtyInCart >= maxAvailable) {
            orderBtn.textContent = "Out of Stock";
            orderBtn.style.backgroundColor = "#333";
            orderBtn.style.color = "#888";
            orderBtn.style.cursor = "not-allowed";
            orderBtn.disabled = true;
        } else {
            orderBtn.textContent = "Add To Cart";
            orderBtn.style.backgroundColor = ""; 
            orderBtn.style.color = "";
            orderBtn.style.cursor = "pointer";
            orderBtn.disabled = false;
        }
    };

    sizePillsContainer.addEventListener("click", (e) => {
        const pill = e.target.closest(".size-pill");
        if (!pill) return;
        sizePillsContainer.querySelectorAll(".size-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        checkCurrentVariantStock();
    });

    colorDots.forEach(dot => {
        dot.addEventListener("click", () => {
            colorDots.forEach(d => d.classList.remove("active"));
            dot.classList.add("active");
            selectedColor = dot.getAttribute("data-color");
            if(modalName.textContent === "Oversized T-Shirt") {
                modalImg.setAttribute("src", `over.jpg`);
            }
            checkCurrentVariantStock();
        });
    });

    // --- Core Modal Binding Logic Structure ---
    const bindProductToModal = (card) => {
        currentActiveProductId = card.getAttribute("data-id");
        currentProductType = card.getAttribute("data-type");
        const name = card.getAttribute("data-name");
        const price = card.getAttribute("data-price");
        const img = card.getAttribute("data-img");
        const hasColors = card.getAttribute("data-has-colors") === "true" || currentActiveProductId === "2";

        modalName.textContent = name;
        modalPrice.textContent = price;
        modalImg.setAttribute("src", img);

        if (hasColors) {
            colorSection.style.display = "block";
            colorDots.forEach(d => d.classList.remove("active"));
            const blackDot = document.querySelector(".dot-black");
            if (blackDot) blackDot.classList.add("active");
            selectedColor = "Black";
        } else {
            colorSection.style.display = "none";
            selectedColor = ""; 
        }

        sizePillsContainer.innerHTML = "";
        const sizes = sizesConfig[currentProductType] || [];
        sizes.forEach((size, i) => {
            const pill = document.createElement("button");
            pill.type = "button";
            pill.className = "size-pill" + (i === 0 ? " active" : "");
            pill.dataset.size = size;
            pill.textContent = size;
            sizePillsContainer.appendChild(pill);
        });

        checkCurrentVariantStock();
        modal.style.display = "flex";
    };

    // Expose binding safely onto global window scope for helper functions
    window.triggerModalBinding = bindProductToModal;

    const closeModal = () => { modal.style.display = "none"; };
    closeBtn.addEventListener("click", closeModal);
    window.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // --- Add to Cart Action ---
    orderBtn.addEventListener("click", () => {
        const name = modalName.textContent;
        const rawPrice = modalPrice.textContent;
        const img = modalImg.getAttribute("src");
        const size = sizeSelect.value;
        const color = selectedColor;
        const numericPrice = parseInt(rawPrice.replace(/[^0-9]/g, ''));

        const existingItem = cart.find(item => item.id === currentActiveProductId && item.size === size && item.color === color);

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ id: currentActiveProductId, name, price: numericPrice, img, size, color, quantity: 1 });
        }

        closeModal();
        updateCartUI();
        cartSidebar.classList.add("open"); 
        // Inside the orderBtn click event listener where the cart sidebar opens automatically:
    updateCartUI();
    openCart(); // Call the unified open function instead of just cartSidebar.classList.add("open");
    });

    // --- Cart Sidebar Engine ---
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
        cartCountBadge.classList.remove("badge-pulse");
        void cartCountBadge.offsetWidth; 
        if (totalCount > 0) {
            cartCountBadge.classList.add("badge-pulse");
        }

        cartItemsContainer.innerHTML = "";
        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="empty-msg">Your cart is empty.</p>';
            cartTotalElement.textContent = "0 EGP";
            return;
        }

        let orderTotalAccumulator = 0;
        cart.forEach((item, index) => {
            const itemTotalCost = item.price * item.quantity;
            orderTotalAccumulator += itemTotalCost;
            const variantMetaText = item.color ? `Size: ${item.size} | Color: ${item.color}` : `Size: ${item.size}`;

            const itemHTML = `
                <div class="cart-item">
                    <img src="${item.img}" alt="${item.name}">
                    <div class="cart-item-details">
                        <h4>${item.name}</h4>
                        <p class="cart-item-meta">${variantMetaText}</p>
                        <div class="cart-item-qty">
                            <button class="qty-btn" onclick="changeQty(${index}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button class="qty-btn" onclick="changeQty(${index}, 1)">+</button>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-weight:600; margin-bottom:5px;">${itemTotalCost} EGP</p>
                        <button class="remove-item-btn" onclick="removeCartItem(${index})">Remove</button>
                    </div>
                </div>
            `;
            cartItemsContainer.insertAdjacentHTML("beforeend", itemHTML);
        });
        cartTotalElement.textContent = `${orderTotalAccumulator} EGP`;
        
    }

    // --- CHECKOUT PAGE NAVIGATION SWITCHES ---
    checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) {
            showAlert('error', '✕', 'Your cart is completely empty!');
            return;
        }
        cartSidebar.classList.remove("open");
        buildCheckoutSummary();
        checkoutPage.classList.add("open");
    });

    backToShopBtn.addEventListener("click", () => {
        checkoutPage.classList.remove("open");
    });

    function buildCheckoutSummary() {
        summaryItemsContainer.innerHTML = "";
        let subtotalAccumulator = 0;

        cart.forEach(item => {
            const rowCost = item.price * item.quantity;
            subtotalAccumulator += rowCost;
            const variantText = item.color ? `(${item.size} / ${item.color})` : `(${item.size})`;

            const itemSummaryHTML = `
                <div class="summary-item-row">
                    <div class="summary-item-info">
                        <strong>${item.name} x${item.quantity}</strong>
                        <span>Variant: ${variantText}</span>
                    </div>
                    <span>${rowCost} EGP</span>
                </div>
            `;
            summaryItemsContainer.insertAdjacentHTML("beforeend", itemSummaryHTML);
        });

        const flatShippingRate = 50; 
        const totalInvoiceCost = subtotalAccumulator + flatShippingRate;

        summarySubtotal.textContent = `${subtotalAccumulator} EGP`;
        summaryGrandTotal.textContent = `${totalInvoiceCost} EGP`;
    }

    // Form submission processing loop 
    checkoutForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = document.getElementById("custName").value;
        const phone = document.getElementById("custPhone").value;
        const email = document.getElementById("custEmail").value; 
        const address = document.getElementById("custAddress").value;
        const city = document.getElementById("custCity").value;
        const method = document.getElementById("payMethod").value;

        sendConfirmationEmail(name, email, phone, address, city, method);

        let total = 50;
        cart.forEach(item => { total += item.price * item.quantity; });

        try {
            let orderHistory = JSON.parse(localStorage.getItem("ko_orders")) || [];
            let itemsTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            let finalGrandTotal = itemsTotal + 50; 

            let timestampId = "#KO-" + Math.floor(10000 + Math.random() * 90000);

            let currentOrderLog = {
                orderId: timestampId,
                totalRevenue: finalGrandTotal,
                itemsCount: cart.reduce((sum, item) => sum + item.quantity, 0),
                itemsList: cart.map(item => ({ 
                    id: item.id,
                    name: item.name, 
                    qty: item.quantity,
                    price: item.price,
                    size: item.size,
                    color: item.color || ""
                }))
            };
            orderHistory.push(currentOrderLog);
            localStorage.setItem("ko_orders", JSON.stringify(orderHistory));
        } catch (err) {
            console.error("Failed tracking local metrics log data:", err);
        }

        cart.forEach(item => {
            let key = `${item.id}_${item.size}`;
            if (item.color) key += `_${item.color}`;
            if (ownerInventory[key] !== undefined) {
                ownerInventory[key] = Math.max(0, ownerInventory[key] - item.quantity);
            }
        });

        const orderLines = cart.map(i =>
            `• ${i.name} x${i.quantity} (${i.size}${i.color ? '/' + i.color : ''}) = ${i.price * i.quantity} EGP`
        ).join("\n");

//         const message =
// `🛍️ NEW ORDER
// ──────────────
// 👤 Name: ${name}
// 📞 Phone: ${phone}
// 📧 Email: ${email}
// 📍 Address: ${address}, ${city}
// 💳 Payment: ${method}
// ──────────────
// ${orderLines}
// ──────────────
// 💰 Total: ${total} EGP`;

//         window.open(`https://wa.me/201271532219?text=${encodeURIComponent(message)}`, "_blank");

        showAlert('success', '✓', `Thank you ${name}! Your order has been placed.`);
        
        cart = [];
        updateCartUI();
        checkoutForm.reset();
        checkoutPage.classList.remove("open");
    });

    // --- LIVE OWNER STOCK MANAGEMENT LOGIC ---
    const adminPanel = document.getElementById("adminPanel");
    const closeAdminBtn = document.getElementById("closeAdminBtn");

    // --- LOGIN SYSTEM (Customers + Admin) ---
    const ADMIN_EMAIL = "ososseif2@gmail.com";
    const ADMIN_PASSWORD = "123456";
    let isAdminLoggedIn = false;
    let isUserLoggedIn = false;

    const footerAuth       = document.getElementById("footerAuth");
    const authEmailInput   = document.getElementById("authEmailInput");
    const authPasswordInput= document.getElementById("authPasswordInput");
    const authMsg          = document.getElementById("authMsg");
    const authLoggedInView = document.getElementById("authLoggedInView");
    const authWelcomeMsg   = document.getElementById("authWelcomeMsg");
    const authSignOutBtn   = document.getElementById("authSignOutBtn");

    // Simple in-memory customer store (extend with localStorage if needed)
    const customerAccounts = JSON.parse(localStorage.getItem("ko_customers")) || [];

    function showLoggedInState(label, isAdmin) {
        footerAuth.style.display = "none";
        authLoggedInView.style.display = "block";
        authWelcomeMsg.textContent = `Welcome back, ${label}! ${isAdmin ? "🔓 Admin access granted." : ""}`;
        authWelcomeMsg.className = isAdmin ? "auth-welcome-msg msg-admin" : "auth-welcome-msg msg-success";
    }

    function signOut() {
        isUserLoggedIn = false;
        isAdminLoggedIn = false;
        footerAuth.style.display = "flex";
        authLoggedInView.style.display = "none";
        authMsg.textContent = "";
        authEmailInput.value = "";
        authPasswordInput.value = "";
        adminPanel.classList.remove("active");
        showAlert('warning', '🔒', 'You have been signed out.');
    }

    if (footerAuth) {
        footerAuth.addEventListener("submit", (e) => {
            e.preventDefault();
            const email    = authEmailInput.value.trim().toLowerCase();
            const password = authPasswordInput.value;

            // --- Validate password length ---
            if (password.length < 6) {
                authMsg.textContent = "✕ Password must be at least 6 characters.";
                authMsg.className = "admin-login-msg msg-error";
                showAlert('error', '✕', 'Password must be at least 6 characters.');
                authPasswordInput.focus();
                return;
            }

            authMsg.textContent = "";

            // --- Check admin credentials first ---
            if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
                isAdminLoggedIn = true;
                isUserLoggedIn  = true;
                showLoggedInState("Admin", true);
                adminPanel.classList.add("active");
                syncAdminSizeOptions();
                updateAdminMetricsUI();
                showAlert('success', '🔓', 'Welcome, Admin! Dashboard is now open.');
                return;
            }

            // --- Check existing customer accounts ---
            const existingCustomer = customerAccounts.find(c => c.email === email);

            if (existingCustomer) {
                // Returning customer — check password
                if (existingCustomer.password === password) {
                    isUserLoggedIn = true;
                    showLoggedInState(existingCustomer.name || email, false);
                    showAlert('success', '✓', `Welcome back!`);
                } else {
                    authMsg.textContent = "✕ Incorrect password.";
                    authMsg.className = "admin-login-msg msg-error";
                    showAlert('error', '✕', 'Incorrect password.');
                }
            } else {
                // New customer — register them
                const newCustomer = { email, password, name: email.split("@")[0] };
                customerAccounts.push(newCustomer);
                localStorage.setItem("ko_customers", JSON.stringify(customerAccounts));
                isUserLoggedIn = true;
                showLoggedInState(newCustomer.name, false);
                showAlert('success', '✨', `Account created! Welcome, ${newCustomer.name}.`);
            }
        });
    }

    if (authSignOutBtn) {
        authSignOutBtn.addEventListener("click", signOut);
    }

    // --- PASSWORD SHOW / HIDE TOGGLE ---
    const togglePasswordBtn = document.getElementById("togglePasswordBtn");
    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener("click", () => {
            const isHidden = authPasswordInput.type === "password";
            authPasswordInput.type = isHidden ? "text" : "password";
            document.querySelector(".eye-show").style.display = isHidden ? "none" : "";
            document.querySelector(".eye-hide").style.display = isHidden ? "" : "none";
        });
    }

    // --- SIGNUP MODAL LOGIC ---
    const signupModal       = document.getElementById("signupModal");
    const closeSignupBtn    = document.getElementById("closeSignupBtn");
    const signupForm        = document.getElementById("signupForm");
    const signupMsg         = document.getElementById("signupMsg");
    const signupNameInput   = document.getElementById("signupName");
    const signupEmailInput  = document.getElementById("signupEmail");
    const signupPassInput   = document.getElementById("signupPassword");
    const signupConfInput   = document.getElementById("signupConfirmPassword");
    const switchToLoginLink = document.getElementById("switchToLoginLink");

    function openSignupModal() {
        signupModal.classList.add("active");
        signupMsg.textContent = "";
        signupForm.reset();
    }

    function closeSignupModal() {
        signupModal.classList.remove("active");
    }

    // "Don't have an account? Sign up" → open modal
    const authSignUpLink = document.getElementById("authSignUpLink");
    if (authSignUpLink) {
        authSignUpLink.addEventListener("click", (e) => {
            e.preventDefault();
            openSignupModal();
        });
    }

    // Close button
    if (closeSignupBtn) {
        closeSignupBtn.addEventListener("click", closeSignupModal);
    }

    // Click outside to close
    if (signupModal) {
        signupModal.addEventListener("click", (e) => {
            if (e.target === signupModal) closeSignupModal();
        });
    }

    // "Already have an account? Sign in" → close modal + scroll to footer login
    if (switchToLoginLink) {
        switchToLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            closeSignupModal();
            setTimeout(() => {
                document.getElementById("footer").scrollIntoView({ behavior: "smooth" });
                setTimeout(() => authEmailInput && authEmailInput.focus(), 600);
            }, 200);
        });
    }

    // Password show/hide toggles for signup modal
    const toggleSignupPasswordBtn = document.getElementById("toggleSignupPasswordBtn");
    if (toggleSignupPasswordBtn) {
        toggleSignupPasswordBtn.addEventListener("click", () => {
            const hidden = signupPassInput.type === "password";
            signupPassInput.type = hidden ? "text" : "password";
            document.querySelector(".su-eye-show").style.display = hidden ? "none" : "";
            document.querySelector(".su-eye-hide").style.display = hidden ? "" : "none";
        });
    }

    const toggleSignupConfirmBtn = document.getElementById("toggleSignupConfirmBtn");
    if (toggleSignupConfirmBtn) {
        toggleSignupConfirmBtn.addEventListener("click", () => {
            const hidden = signupConfInput.type === "password";
            signupConfInput.type = hidden ? "text" : "password";
            document.querySelector(".su-confirm-show").style.display = hidden ? "none" : "";
            document.querySelector(".su-confirm-hide").style.display = hidden ? "" : "none";
        });
    }

    // Signup form submission
    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const name     = signupNameInput.value.trim();
            const email    = signupEmailInput.value.trim().toLowerCase();
            const password = signupPassInput.value;
            const confirm  = signupConfInput.value;

            // Validate password length
            if (password.length < 6) {
                signupMsg.textContent = "✕ Password must be at least 6 characters.";
                signupMsg.className = "signup-msg msg-error";
                return;
            }

            // Validate passwords match
            if (password !== confirm) {
                signupMsg.textContent = "✕ Passwords do not match.";
                signupMsg.className = "signup-msg msg-error";
                signupConfInput.focus();
                return;
            }

            // Check if email already registered
            const existing = customerAccounts.find(c => c.email === email);
            if (existing) {
                signupMsg.textContent = "✕ An account with this email already exists.";
                signupMsg.className = "signup-msg msg-error";
                return;
            }

            // Register the new account
            const newCustomer = { name, email, password };
            customerAccounts.push(newCustomer);
            localStorage.setItem("ko_customers", JSON.stringify(customerAccounts));

            // Auto-login after signup
            isUserLoggedIn = true;
            closeSignupModal();
            showLoggedInState(name, false);
            showAlert("success", "✨", `Welcome to KO, ${name}! Your account has been created.`);
        });
    }

    // Shift+A to sign out admin (only when admin is logged in, not while typing)
    window.addEventListener("keydown", (e) => {
        if (e.shiftKey && !e.ctrlKey && (e.key === "A" || e.key === "a")) {
            if (document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "SELECT") {
                if (isAdminLoggedIn) {
                    e.preventDefault();
                    signOut();
                }
            }
        }
    });

    closeAdminBtn.addEventListener("click", () => adminPanel.classList.remove("active"));
    adminPanel.addEventListener("click", (e) => { if (e.target === adminPanel) adminPanel.classList.remove("active"); });

    const syncAdminSizeOptions = () => {
        if (!adminProdSelect) return;
        const selectedOption = adminProdSelect.options[adminProdSelect.selectedIndex];
        if (!selectedOption) return;
        const type = selectedOption.getAttribute("data-type");
        const prodId = adminProdSelect.value;

        if (prodId === "2") {
            adminColorGroup.style.display = "flex";
        } else {
            adminColorGroup.style.display = "none";
        }

        adminSizeSelect.innerHTML = "";
        const sizes = sizesConfig[type] || [];
        sizes.forEach(size => {
            const opt = document.createElement("option");
            opt.value = size;
            opt.textContent = size;
            adminSizeSelect.appendChild(opt);
        });

        readCurrentStockToInput();
    };

    const readCurrentStockToInput = () => {
        if (!adminProdSelect || !adminSizeSelect) return;
        const prodId = adminProdSelect.value;
        const size = adminSizeSelect.value;
        let targetKey = `${prodId}_${size}`;
        if (prodId === "2") targetKey += `_${adminColorSelect.value}`;

        const currentStockVal = ownerInventory[targetKey] !== undefined ? ownerInventory[targetKey] : 0;
        adminStockInput.value = currentStockVal;
    };

    if (adminProdSelect) adminProdSelect.addEventListener("change", syncAdminSizeOptions);
    if (adminSizeSelect) adminSizeSelect.addEventListener("change", readCurrentStockToInput);
    if (adminColorSelect) adminColorSelect.addEventListener("change", readCurrentStockToInput);

    if (updateStockBtn) {
        updateStockBtn.addEventListener("click", () => {
            const prodId = adminProdSelect.value;
            const size = adminSizeSelect.value;
            const newStockQty = parseInt(adminStockInput.value) || 0;
            const selectedItemName = adminProdSelect.options[adminProdSelect.selectedIndex].text;

            let targetKey = `${prodId}_${size}`;
            let variantDescription = `Size: ${size}`;

            if (prodId === "2") {
                const color = adminColorSelect.value;
                targetKey += `_${color}`;
                variantDescription += ` | Color: ${color}`;
            }

            ownerInventory[targetKey] = newStockQty;
            adminFeedback.textContent = `Success! ${selectedItemName} (${variantDescription}) stock set to ${newStockQty}.`;
            adminFeedback.className = "admin-feedback feedback-success";

            setTimeout(() => { adminFeedback.textContent = ""; }, 4000);

            if (modal.style.display === "flex" && currentActiveProductId === prodId) {
                checkCurrentVariantStock();
            }
        });
    }

    // Form handling for the footer contact submission
    const footerContactForm = document.getElementById("footerContactForm");
    if (footerContactForm) {
        footerContactForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const messageVal = document.getElementById("contactMsg").value;

            const message = `📩 NEW MESSAGE FROM WEBSITE\n──────────────\n${messageVal}`;
            window.open(`https://wa.me/201271532219?text=${encodeURIComponent(message)}`, "_blank");

            showAlert('warning', '⚠', 'Message received! We will get back to you shortly.');
            footerContactForm.reset();
        });
    }

    // --- Order Confirmation Email Transmitter Helper ---
    function sendConfirmationEmail(customerName, customerEmail, customerPhone, customerAddress, customerCity, paymentMethod) {
        let orderItemsText = "";
        cart.forEach(item => {
            const variantMeta = item.color ? ` (${item.size} / ${item.color})` : ` (${item.size})`;
            orderItemsText += `• ${item.name} x${item.quantity}${variantMeta} = ${item.price * item.quantity} EGP\n`;
        });

        let totalInvoiceCost = 50;
        cart.forEach(item => { totalInvoiceCost += item.price * item.quantity; });

        const randomOrderId = Math.floor(10000 + Math.random() * 90000);

        const templateParams = {
            order_id: randomOrderId, 
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
            customer_address: `${customerAddress}, ${customerCity}`,
            payment_method: paymentMethod,
            order_items: orderItemsText,
            total_price: totalInvoiceCost
        };

        emailjs.send('service_3savc39', 'template_l4slz7g', templateParams, 'YgbAzTbtF11flkfqk')
            .then((response) => {
                console.log('EMAIL SUCCESS!', response.status, response.text);
            }, (error) => {
                console.error('EMAIL DISPATCH FAILED...', error);
            });
    }

    // --- Live Analytics Dashboard & Interactive Refund Engine ---
    function updateAdminMetricsUI() {
        const orderHistory = JSON.parse(localStorage.getItem("ko_orders")) || [];
        
        const metricRevenue = document.getElementById("metricRevenue");
        const metricOrders = document.getElementById("metricOrders");
        const metricAOV = document.getElementById("metricAOV");
        const metricTopProduct = document.getElementById("metricTopProduct");
        const orderLogContainer = document.getElementById("adminOrderLogContainer");

        if (!metricRevenue || !metricOrders || !metricAOV || !metricTopProduct) return;

        if (orderHistory.length === 0) {
            metricRevenue.textContent = "0 EGP";
            metricOrders.textContent = "0";
            metricAOV.textContent = "0 EGP";
            metricTopProduct.textContent = "None Yet";
            if (orderLogContainer) {
                orderLogContainer.innerHTML = '<p class="no-orders-msg">No transactions recorded yet.</p>';
            }
            return;
        }

        let totalRevenueSum = orderHistory.reduce((sum, order) => sum + order.totalRevenue, 0);
        let totalOrdersCount = orderHistory.length;
        let averageOrderValue = Math.round(totalRevenueSum / totalOrdersCount);

        let productFrequencyMap = {};
        orderHistory.forEach(order => {
            if (order.itemsList && Array.isArray(order.itemsList)) {
                order.itemsList.forEach(item => {
                    productFrequencyMap[item.name] = (productFrequencyMap[item.name] || 0) + item.qty;
                });
            }
        });

        let topProductTitle = "None Yet";
        let topProductMaxCount = 0;
        for (const [prodName, totalQtySold] of Object.entries(productFrequencyMap)) {
            if (totalQtySold > topProductMaxCount) {
                topProductMaxCount = totalQtySold;
                topProductTitle = prodName;
            }
        }

        metricRevenue.textContent = `${totalRevenueSum} EGP`;
        metricOrders.textContent = totalOrdersCount;
        metricAOV.textContent = `${averageOrderValue} EGP`;
        metricTopProduct.textContent = topProductMaxCount > 0 ? `${topProductTitle} (${topProductMaxCount})` : "None Yet";

        if (orderLogContainer) {
            orderLogContainer.innerHTML = "";
            for (let i = orderHistory.length - 1; i >= 0; i--) {
                const order = orderHistory[i];
                let itemRowsHTML = "";

                order.itemsList.forEach((item, itemIndex) => {
                    let variantLabel = item.color ? `${item.size}/${item.color}` : `${item.size}`;
                    itemRowsHTML += `
                        <div class="admin-order-item-row">
                            <span>${item.name} x${item.qty} (${variantLabel})</span>
                            <button class="btn-refund-item" onclick="processSingleLineItemRefund(${i}, ${itemIndex})">Refund 1</button>
                        </div>
                    `;
                });

                let orderCardHTML = `
                    <div class="admin-order-card">
                        <div class="admin-order-header">
                            <span class="admin-order-id">${order.orderId || '#KO-UNKNWN'}</span>
                            <span class="admin-order-total">${order.totalRevenue} EGP</span>
                        </div>
                        <div class="admin-order-body-items">
                            ${itemRowsHTML}
                        </div>
                        <button class="btn-refund-order-all" onclick="processFullOrderMassRefund(${i})">Refund Whole Order</button>
                    </div>
                `;
                orderLogContainer.insertAdjacentHTML("beforeend", orderCardHTML);
            }
        }
    }

    // --- LOGIC: REFUND 1 SINGLE UNIT OF AN ITEM ---
    window.processSingleLineItemRefund = (orderIndex, itemIndex) => {
        let orderHistory = JSON.parse(localStorage.getItem("ko_orders")) || [];
        let order = orderHistory[orderIndex];
        let item = order.itemsList[itemIndex];

        if (!order || !item) return;

        let targetInventoryKey = `${item.id}_${item.size}`;
        if (item.color) targetInventoryKey += `_${item.color}`;
        
        if (ownerInventory[targetInventoryKey] !== undefined) {
            ownerInventory[targetInventoryKey] += 1;
        }

        order.totalRevenue -= item.price; 
        item.qty -= 1;
        order.itemsCount -= 1;

        if (item.qty <= 0) {
            order.itemsList.splice(itemIndex, 1);
        }

        if (order.itemsList.length === 0 || order.totalRevenue <= 50) {
            orderHistory.splice(orderIndex, 1);
        } else {
            orderHistory[orderIndex] = order;
        }

        localStorage.setItem("ko_orders", JSON.stringify(orderHistory));
        
        updateAdminMetricsUI();
        if (typeof readCurrentStockToInput === "function") readCurrentStockToInput();
        showAlert('warning', '↩️', 'Single item processed for refund. Inventory restocked.');
    };

    // --- LOGIC: WIPING AND REFUNDING AN ENTIRE COMPLETED ORDER ---
    window.processFullOrderMassRefund = (orderIndex) => {
        let orderHistory = JSON.parse(localStorage.getItem("ko_orders")) || [];
        let order = orderHistory[orderIndex];

        if (!order) return;

        if (!confirm(`Are you sure you want to cancel and refund order ${order.orderId}?`)) return;

        order.itemsList.forEach(item => {
            let targetInventoryKey = `${item.id}_${item.size}`;
            if (item.color) targetInventoryKey += `_${item.color}`;
            
            if (ownerInventory[targetInventoryKey] !== undefined) {
                ownerInventory[targetInventoryKey] += item.qty;
            }
        });

        orderHistory.splice(orderIndex, 1);
        localStorage.setItem("ko_orders", JSON.stringify(orderHistory));

        updateAdminMetricsUI();
        if (typeof readCurrentStockToInput === "function") readCurrentStockToInput();
        showAlert('success', '↩️', 'Entire order has been successfully voided.');
    };    

    // --- CATALOG MANAGER FORM REGISTRATION & PIPELINE LOOPS ---
    const adminAddProductForm = document.getElementById("adminAddProductForm");
    const catalogTargetSelect = document.getElementById("catalogTargetSelect");
    const updateCatalogBtn = document.getElementById("updateCatalogBtn");
    const adminProdSelectDropdown = document.getElementById("adminProductSelect");

    function syncCatalogUIElements() {
        if (!catalogTargetSelect || !adminProdSelectDropdown) return;

        const prevTargetVal = catalogTargetSelect.value;
        const prevStockVal = adminProdSelectDropdown.value;

        catalogTargetSelect.innerHTML = '<option value="">-- Choose Product --</option>';
        adminProdSelectDropdown.innerHTML = '';

        catalogProducts.forEach(prod => {
            const opt1 = document.createElement("option");
            opt1.value = prod.id;
            opt1.textContent = prod.name + (prod.discountPrice ? ' 🏷️' : '');
            catalogTargetSelect.appendChild(opt1);

            const opt2 = document.createElement("option");
            opt2.value = prod.id;
            opt2.setAttribute("data-type", prod.type);
            opt2.textContent = prod.name;
            adminProdSelectDropdown.appendChild(opt2);
        });

        catalogTargetSelect.value = prevTargetVal || catalogProducts[0]?.id || "";
        if (prevStockVal) adminProdSelectDropdown.value = prevStockVal;

        // Refresh discount UI to reflect the newly selected product
        refreshDiscountManagerUI();
    }

    // =========================================================
    // FEATURE 1: IMAGE UPLOADER / URL GENERATOR
    // =========================================================

    // --- Tab switcher for image source ---
    const imgSourceTabs = document.getElementById("imgSourceTabs");
    let activeImgSource = "filename"; // default
    let uploadedDataUrl = null; // holds base64 for uploaded files

    if (imgSourceTabs) {
        imgSourceTabs.querySelectorAll(".img-tab").forEach(tab => {
            tab.addEventListener("click", () => {
                imgSourceTabs.querySelectorAll(".img-tab").forEach(t => t.classList.remove("active"));
                tab.classList.add("active");
                activeImgSource = tab.dataset.tab;

                // Show correct panel
                ["filename", "url", "upload"].forEach(id => {
                    const panel = document.getElementById(`imgPanel-${id}`);
                    if (panel) panel.style.display = id === activeImgSource ? "block" : "none";
                });

                updateImgLivePreview();
            });
        });
    }

    // --- Filename input: live preview as you type ---
    const filenameInput = document.getElementById("newProdImgFilename");
    if (filenameInput) {
        filenameInput.addEventListener("input", updateImgLivePreview);
    }

    // --- URL input: preview on button click or paste ---
    const urlInput = document.getElementById("newProdImgUrl");
    const previewUrlBtn = document.getElementById("previewUrlBtn");
    if (urlInput) urlInput.addEventListener("input", updateImgLivePreview);
    if (previewUrlBtn) previewUrlBtn.addEventListener("click", updateImgLivePreview);

    // --- Upload dropzone ---
    const dropzone = document.getElementById("imgUploadDropzone");
    const fileInput = document.getElementById("newProdImgFile");
    const dropzoneBrowse = document.getElementById("dropzoneBrowse");
    const dropzoneInner = document.getElementById("dropzoneInner");
    const dropzonePreview = document.getElementById("dropzonePreview");
    const dropzonePreviewImg = document.getElementById("dropzonePreviewImg");
    const dropzoneClear = document.getElementById("dropzoneClear");

    if (dropzoneBrowse) dropzoneBrowse.addEventListener("click", () => fileInput && fileInput.click());

    if (dropzone) {
        dropzone.addEventListener("dragover", e => { e.preventDefault(); dropzone.classList.add("drag-over"); });
        dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
        dropzone.addEventListener("drop", e => {
            e.preventDefault();
            dropzone.classList.remove("drag-over");
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith("image/")) handleUploadedFile(file);
        });
    }

    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files[0]) handleUploadedFile(fileInput.files[0]);
        });
    }

    if (dropzoneClear) {
        dropzoneClear.addEventListener("click", () => {
            uploadedDataUrl = null;
            if (fileInput) fileInput.value = "";
            if (dropzoneInner) dropzoneInner.style.display = "flex";
            if (dropzonePreview) dropzonePreview.style.display = "none";
            updateImgLivePreview();
        });
    }

    function handleUploadedFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadedDataUrl = e.target.result;
            if (dropzonePreviewImg) dropzonePreviewImg.src = uploadedDataUrl;
            if (dropzoneInner) dropzoneInner.style.display = "none";
            if (dropzonePreview) dropzonePreview.style.display = "flex";
            updateImgLivePreview();
        };
        reader.readAsDataURL(file);
    }

    function getResolvedImgSrc() {
        if (activeImgSource === "filename") {
            return (filenameInput && filenameInput.value.trim()) || "";
        } else if (activeImgSource === "url") {
            return (urlInput && urlInput.value.trim()) || "";
        } else if (activeImgSource === "upload") {
            return uploadedDataUrl || "";
        }
        return "";
    }

    function updateImgLivePreview() {
        const src = getResolvedImgSrc();
        const strip = document.getElementById("imgLivePreviewStrip");
        const thumb = document.getElementById("imgLivePreviewThumb");
        const label = document.getElementById("imgLivePreviewLabel");

        if (!src || !strip) return;

        thumb.src = src;
        thumb.onerror = () => {
            strip.style.display = "none";
        };
        thumb.onload = () => {
            strip.style.display = "flex";
            if (activeImgSource === "upload") {
                label.textContent = "Uploaded image (embedded)";
            } else if (activeImgSource === "url") {
                label.textContent = src.length > 50 ? src.slice(0, 50) + "…" : src;
            } else {
                label.textContent = src;
            }
        };
    }

    // --- Add Product form submission ---
    if (adminAddProductForm) {
        adminAddProductForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const imgSrc = getResolvedImgSrc();
            if (!imgSrc) {
                showAlert('error', '✕', 'Please provide an image (filename, URL, or upload).');
                return;
            }

            const nextId = String(Date.now()); // unique timestamp ID avoids collisions
            const titleInput = document.getElementById("newProdTitle").value.trim();
            const priceInput = parseFloat(document.getElementById("newProdPrice").value);
            const typeInput = document.getElementById("newProdType").value;
            const hasColors = document.getElementById("newProdHasColors").checked;

            const newProductObj = {
                id: nextId,
                name: titleInput,
                price: priceInput,
                type: typeInput,
                img: imgSrc,
                ...(hasColors && { hasColors: true })
            };

            catalogProducts.push(newProductObj);
            localStorage.setItem("ko_catalog", JSON.stringify(catalogProducts));

            // Provision inventory slots
            const targetSizes = sizesConfig[typeInput] || [];
            targetSizes.forEach(sz => {
                const colorSuffixes = hasColors ? ["_Black", "_White"] : [""];
                colorSuffixes.forEach(c => {
                    ownerInventory[`${nextId}_${sz}${c}`] = 10;
                });
            });

            renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
            syncCatalogUIElements();
            syncAdminSizeOptions();

            // Reset form state
            adminAddProductForm.reset();
            uploadedDataUrl = null;
            if (dropzoneInner) dropzoneInner.style.display = "flex";
            if (dropzonePreview) dropzonePreview.style.display = "none";
            const strip = document.getElementById("imgLivePreviewStrip");
            if (strip) strip.style.display = "none";

            showAlert('success', '✨', `"${titleInput}" drop deployed successfully!`);
        });
    }

    // =========================================================
    // FEATURE 2: COMPREHENSIVE DYNAMIC DISCOUNT MANAGER
    // =========================================================

    const discountOnSaleToggle = document.getElementById("discountOnSaleToggle");
    const discountControlsGroup = document.getElementById("discountControlsGroup");
    const catalogDiscountInput = document.getElementById("catalogDiscount");
    const catalogFixedPriceInput = document.getElementById("catalogFixedPrice");
    const discountPreviewRow = document.getElementById("discountPreviewRow");

    // When the product selector changes, load its current discount state
    if (catalogTargetSelect) {
        catalogTargetSelect.addEventListener("change", refreshDiscountManagerUI);
    }

    function refreshDiscountManagerUI() {
        if (!catalogTargetSelect) return;
        const selectedId = catalogTargetSelect.value;
        const product = catalogProducts.find(p => p.id === selectedId);

        const currentPriceRow = document.getElementById("discountCurrentPriceRow");
        const currentPriceVal = document.getElementById("discountCurrentPriceVal");

        if (!product) {
            if (currentPriceRow) currentPriceRow.style.display = "none";
            if (discountOnSaleToggle) discountOnSaleToggle.checked = false;
            if (discountControlsGroup) discountControlsGroup.style.display = "none";
            if (discountPreviewRow) discountPreviewRow.style.display = "none";
            return;
        }

        // Show base price
        if (currentPriceRow) currentPriceRow.style.display = "block";
        if (currentPriceVal) currentPriceVal.textContent = `${product.price} EGP`;

        // Reflect existing discount state
        const hasDiscount = !!product.discountPrice;
        if (discountOnSaleToggle) discountOnSaleToggle.checked = hasDiscount;
        if (discountControlsGroup) discountControlsGroup.style.display = hasDiscount ? "block" : "none";

        if (hasDiscount) {
            if (catalogDiscountInput) catalogDiscountInput.value = product.discountPercent || "";
            if (catalogFixedPriceInput) catalogFixedPriceInput.value = product.discountPrice || "";
            updateDiscountPreview(product.price);
        } else {
            if (catalogDiscountInput) catalogDiscountInput.value = "";
            if (catalogFixedPriceInput) catalogFixedPriceInput.value = "";
            if (discountPreviewRow) discountPreviewRow.style.display = "none";
        }
    }

    // Toggle: show/hide discount controls
    if (discountOnSaleToggle) {
        discountOnSaleToggle.addEventListener("change", () => {
            if (discountControlsGroup) {
                discountControlsGroup.style.display = discountOnSaleToggle.checked ? "block" : "none";
            }
            if (!discountOnSaleToggle.checked && discountPreviewRow) {
                discountPreviewRow.style.display = "none";
            }
        });
    }

    // Live preview: recalculate whenever % or fixed price changes
    function updateDiscountPreview(basePrice) {
        if (!discountPreviewRow) return;
        const percentVal = parseInt(catalogDiscountInput && catalogDiscountInput.value) || 0;
        const fixedVal = parseFloat(catalogFixedPriceInput && catalogFixedPriceInput.value) || 0;

        let salePrice = null;
        let badgeText = "";

        if (fixedVal > 0 && fixedVal < basePrice) {
            salePrice = fixedVal;
            const pct = Math.round(((basePrice - fixedVal) / basePrice) * 100);
            badgeText = `-${pct}%`;
        } else if (percentVal > 0 && percentVal < 100) {
            salePrice = Math.round(basePrice * (1 - percentVal / 100));
            badgeText = `-${percentVal}%`;
        }

        if (salePrice !== null) {
            discountPreviewRow.style.display = "block";
            const oldEl = document.getElementById("discountPreviewOld");
            const newEl = document.getElementById("discountPreviewNew");
            const badgeEl = document.getElementById("discountPreviewBadge");
            if (oldEl) oldEl.textContent = `${basePrice} EGP`;
            if (newEl) newEl.textContent = `${salePrice} EGP`;
            if (badgeEl) badgeEl.textContent = badgeText;
        } else {
            discountPreviewRow.style.display = "none";
        }
    }

    if (catalogDiscountInput) {
        catalogDiscountInput.addEventListener("input", () => {
            // Clear fixed price when % is typed
            if (catalogFixedPriceInput && catalogDiscountInput.value) catalogFixedPriceInput.value = "";
            const selected = catalogProducts.find(p => p.id === catalogTargetSelect.value);
            if (selected) updateDiscountPreview(selected.price);
        });
    }

    if (catalogFixedPriceInput) {
        catalogFixedPriceInput.addEventListener("input", () => {
            // Clear percent when fixed price is typed
            if (catalogDiscountInput && catalogFixedPriceInput.value) catalogDiscountInput.value = "";
            const selected = catalogProducts.find(p => p.id === catalogTargetSelect.value);
            if (selected) updateDiscountPreview(selected.price);
        });
    }

    // Apply Changes button
    if (updateCatalogBtn) {
        updateCatalogBtn.addEventListener("click", () => {
            const selectedId = catalogTargetSelect.value;
            if (!selectedId) {
                showAlert('error', '✕', 'Select a product first!');
                return;
            }

            const targetProduct = catalogProducts.find(p => p.id === selectedId);
            if (!targetProduct) return;

            const onSale = discountOnSaleToggle && discountOnSaleToggle.checked;

            if (!onSale) {
                // Remove discount entirely
                delete targetProduct.discountPrice;
                delete targetProduct.discountPercent;
                localStorage.setItem("ko_catalog", JSON.stringify(catalogProducts));
                renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
                syncCatalogUIElements();
                showAlert('success', '⚡', `Sale removed from "${targetProduct.name}".`);
                return;
            }

            // Resolve final sale price (fixed takes precedence, else % calc)
            const fixedVal = parseFloat(catalogFixedPriceInput && catalogFixedPriceInput.value) || 0;
            const percentVal = parseInt(catalogDiscountInput && catalogDiscountInput.value) || 0;
            let finalSalePrice = null;
            let savedPercent = 0;

            if (fixedVal > 0 && fixedVal < targetProduct.price) {
                finalSalePrice = fixedVal;
                savedPercent = Math.round(((targetProduct.price - fixedVal) / targetProduct.price) * 100);
            } else if (percentVal > 0 && percentVal < 100) {
                finalSalePrice = Math.round(targetProduct.price * (1 - percentVal / 100));
                savedPercent = percentVal;
            } else {
                showAlert('error', '✕', 'Enter a valid discount % or fixed sale price.');
                return;
            }

            targetProduct.discountPrice = finalSalePrice;
            targetProduct.discountPercent = savedPercent;
            localStorage.setItem("ko_catalog", JSON.stringify(catalogProducts));
            renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
            syncCatalogUIElements();

            showAlert('success', '🏷️', `"${targetProduct.name}" is now on sale for ${finalSalePrice} EGP (${savedPercent}% off)!`);
        });
    }

// --- CATALOG PRODUCT DELETION ENGINE ---
    const deleteCatalogBtn = document.getElementById("deleteCatalogBtn");

    if (deleteCatalogBtn) {
        deleteCatalogBtn.addEventListener("click", () => {
const selectedId = adminProdSelect.value;            if (!selectedId) {
                showAlert('error', '✕', 'Select an item to delete!');
                return;
            }

            const targetProduct = catalogProducts.find(p => p.id === selectedId);
            if (!targetProduct) return;

            if (confirm(`Are you sure you want to completely remove "${targetProduct.name}" from the store database?`)) {
                
                // 1. Filter out the item from your mutable catalog array (declared on Line 114)
                catalogProducts = catalogProducts.filter(p => p.id !== selectedId);

                // 2. Clear out any existing DOM elements inside your grid to allow a clean redraw
                const gridContainer = document.querySelector(".product-grid");
                if (gridContainer) gridContainer.innerHTML = "";

                // 3. Save the pruned array back into localStorage permanently
                localStorage.setItem("ko_catalog", JSON.stringify(catalogProducts));

                // 4. Force synchronization loops to remove it from stock and selection forms
                renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
                syncCatalogUIElements();
                syncAdminSizeOptions();

                showAlert('success', '🗑️', `"${targetProduct.name}" has been removed from the catalog.`);
            }
        });
    }

    // --- LIGHT / DARK THEME ENGINE ---
    const themeToggleBtn = document.getElementById("themeToggleBtn");
    const savedTheme = localStorage.getItem("ko_theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-mode");
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener("click", () => {
            document.body.classList.toggle("light-mode");
            if (document.body.classList.contains("light-mode")) {
                localStorage.setItem("ko_theme", "light");
            } else {
                localStorage.setItem("ko_theme", "dark");
            }
        });
    }

    // --- INITIALIZATION RUN ON BOOT ---
    renderShopGridFromCatalog(catalogProducts, sizesConfig, bindProductToModal);
    syncCatalogUIElements();
    syncAdminSizeOptions();
    revealCards();
});