document.addEventListener("DOMContentLoaded", () => {
    
    // --- OWNER'S MASTER VARIANT INVENTORY ---
    const ownerInventory = {
        "1_XS": 5, "1_S": 10, "1_M": 15, "1_L": 12, "1_XL": 8,
        "2_XS_Black": 5, "2_S_Black": 8, "2_M_Black": 0, "2_L_Black": 10, "2_XL_Black": 4,
        "2_XS_White": 3, "2_S_White": 0, "2_M_White": 12, "2_L_White": 7, "2_XL_White": 6,
        "3_30": 5, "3_32": 8, "3_34": 10, "3_36": 6, "3_38": 4,
        "4_30": 3, "4_32": 5, "4_34": 0, "4_36": 4, "4_38": 2
    };

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
    const sizeSelect = document.getElementById("sizeSelect");
    const orderBtn = document.getElementById("orderBtn");
    const colorSection = document.getElementById("modalColorSection");
    const colorDots = document.querySelectorAll(".color-dot");
    const productCards = document.querySelectorAll(".product-card");

    const cartIcon = document.getElementById("cartIcon");
    const cartSidebar = document.getElementById("cartSidebar");
    const closeCartBtn = document.getElementById("closeCartBtn");
    const cartItemsContainer = document.getElementById("cartItemsContainer");
    const cartCountBadge = document.getElementById("cartCount");
    const cartTotalElement = document.getElementById("cartTotal");
    const checkoutBtn = document.getElementById("checkoutBtn");

    // Admin Interface Selectors
    const adminProdSelect = document.getElementById("adminProductSelect");
    const adminColorGroup = document.getElementById("adminColorGroup");
    const adminColorSelect = document.getElementById("adminColorSelect");
    const adminSizeSelect = document.getElementById("adminSizeSelect");
    const adminStockInput = document.getElementById("adminStockInput");
    const updateStockBtn = document.getElementById("updateStockBtn");
    const adminFeedback = document.getElementById("adminFeedback");

    // --- Scroll Reveal ---
    const revealCards = () => {
        productCards.forEach(card => {
            const cardTop = card.getBoundingClientRect().top;
            if (cardTop < window.innerHeight - 50) card.classList.add("reveal");
        });
    };
    window.addEventListener("scroll", revealCards);
    revealCards();

    cartIcon.addEventListener("click", () => cartSidebar.classList.add("open"));
    closeCartBtn.addEventListener("click", () => cartSidebar.classList.remove("open"));

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

    sizeSelect.addEventListener("change", checkCurrentVariantStock);

    colorDots.forEach(dot => {
        dot.addEventListener("click", () => {
            colorDots.forEach(d => d.classList.remove("active"));
            dot.classList.add("active");
            selectedColor = dot.getAttribute("data-color");
            if(modalName.textContent === "Oversized T-Shirt") {
                modalImg.setAttribute("src", `https://via.placeholder.com/400x500/1a1a1a/ffffff?text=Oversized+TS_(${selectedColor})`);
            }
            checkCurrentVariantStock();
        });
    });

    // --- Product Modal Opener ---
    productCards.forEach(card => {
        const viewBtn = card.querySelector(".view-btn");
        viewBtn.addEventListener("click", () => {
            currentActiveProductId = card.getAttribute("data-id");
            currentProductType = card.getAttribute("data-type");
            const name = card.getAttribute("data-name");
            const price = card.getAttribute("data-price");
            const img = card.getAttribute("data-img");
            const hasColors = card.getAttribute("data-has-colors") === "true";

            modalName.textContent = name;
            modalPrice.textContent = price;
            modalImg.setAttribute("src", img);

            if (hasColors) {
                colorSection.style.display = "block";
                colorDots.forEach(d => d.classList.remove("active"));
                document.querySelector(".dot-black").classList.add("active");
                selectedColor = "Black";
            } else {
                colorSection.style.display = "none";
                selectedColor = ""; 
            }

            sizeSelect.innerHTML = "";
            const sizes = sizesConfig[currentProductType] || [];
            sizes.forEach(size => {
                const option = document.createElement("option");
                option.value = size;
                option.textContent = size;
                sizeSelect.appendChild(option);
            });

            checkCurrentVariantStock();
            modal.style.display = "flex";
        });
    });

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

    checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) return alert("Cart empty!");
        alert("Proceeding to checkout!");
        cart = [];
        updateCartUI();
        cartSidebar.classList.remove("open");
    });

    // --- LIVE OWNER STOCK MANAGEMENT LOGIC ---
    
    // Updates dashboard selector inputs depending on product category definitions
    const syncAdminSizeOptions = () => {
        const selectedOption = adminProdSelect.options[adminProdSelect.selectedIndex];
        const type = selectedOption.getAttribute("data-type");
        const prodId = adminProdSelect.value;

        // Hide color filters completely for non-variant item categories
        if (prodId === "2") {
            adminColorGroup.style.display = "flex";
        } else {
            adminColorGroup.style.display = "none";
        }

        // Fill target dynamic dropdown lists cleanly
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

    // Reads current store state array count values directly back into control input fields automatically
    const readCurrentStockToInput = () => {
        const prodId = adminProdSelect.value;
        const size = adminSizeSelect.value;
        
        let targetKey = `${prodId}_${size}`;
        if (prodId === "2") {
            targetKey += `_${adminColorSelect.value}`;
        }

        const currentStockVal = ownerInventory[targetKey] !== undefined ? ownerInventory[targetKey] : 0;
        adminStockInput.value = currentStockVal;
    };

    // Track input choices changes
    adminProdSelect.addEventListener("change", syncAdminSizeOptions);
    adminSizeSelect.addEventListener("change", readCurrentStockToInput);
    adminColorSelect.addEventListener("change", readCurrentStockToInput);

    // Save click execution function updates values in master data array seamlessly 
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

        // Write directly into the core runtime object array storage mapping
        ownerInventory[targetKey] = newStockQty;

        // Display dashboard response validation confirmations
        adminFeedback.textContent = `Updated! ${selectedItemName} (${variantDescription}) stock set to ${newStockQty}.`;
        adminFeedback.className = "admin-feedback feedback-success";

        // Clear feedback notice after short time frame delay
        setTimeout(() => { adminFeedback.textContent = ""; }, 4000);

        // If the buyer has the item modal currently open, refresh its state right away
        if (modal.style.display === "flex" && currentActiveProductId === prodId) {
            checkCurrentVariantStock();
        }
    });

    // Initialize the Admin Form Options on view load
    syncAdminSizeOptions();
});