// ===== "БД" в localStorage =====

const STORAGE_KEYS = {
    users: "rr-users",
    currentUserId: "rr-current-user-id",
    bookings: "rr-bookings",
};

const PRODUCTS_STORAGE_KEY = "rr-products";
const STAFF_STORAGE_KEY = "rr-staff";

//localStorage.removeItem(PRODUCTS_STORAGE_KEY);
function readJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        console.error("Ошибка чтения", key, e);
        return fallback;
    }
}

function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

// ===== AUTH =====

const Auth = {
    _getUsers() {
        return readJSON(STORAGE_KEYS.users, []);
    },
    _saveUsers(users) {
        writeJSON(STORAGE_KEYS.users, users);
    },
    getCurrentUser() {
        const id = localStorage.getItem(STORAGE_KEYS.currentUserId);
        if (!id) return null;
        const users = this._getUsers();
        return users.find((u) => String(u.id) === String(id)) || null;
    },
    register(email, password, subscribeNews) {
        const users = this._getUsers();
        const normalizedEmail = (email || "").trim().toLowerCase();
        if (!normalizedEmail || !password) {
            return { success: false, message: "Заполните email и пароль" };
        }
        if (users.some((u) => u.email === normalizedEmail)) {
            return { success: false, message: "Пользователь с таким email уже существует" };
        }
        const newUser = {
            id: Date.now().toString(),
            email: normalizedEmail,
            password: password, // для демо без хеша
            subscribeNews: !!subscribeNews,
            isAdmin: false
        };
        users.push(newUser);
        this._saveUsers(users);
        localStorage.setItem(STORAGE_KEYS.currentUserId, newUser.id);
        return { success: true, user: newUser };
    },
    login(email, password) {
        const users = this._getUsers();
        const normalizedEmail = (email || "").trim().toLowerCase();
        const user = users.find(
            (u) => u.email === normalizedEmail && u.password === password
        );
        if (!user) {
            return { success: false, message: "Неверный email или пароль" };
        }
        localStorage.setItem(STORAGE_KEYS.currentUserId, user.id);
        return { success: true, user };
    },
    logout() {
        localStorage.removeItem(STORAGE_KEYS.currentUserId);
    },
    ensureDefaultAdmin() {
        const users = this._getUsers();
        // если админ уже есть — выходим
        if (users.some((u) => u.isAdmin)) return;

        const adminUser = {
            id: "admin-1",
            email: "admin@gmail.com",
            password: "admin123",
            subscribeNews: false,
            isAdmin: true
        };
        users.push(adminUser);
        this._saveUsers(users);
    },
    isAdmin(user) {
        return !!(user && user.isAdmin);
    }

};

// ===== BOOKINGS =====

const Booking = {
    _getAll() {
        return readJSON(STORAGE_KEYS.bookings, []);
    },
    _saveAll(list) {
        writeJSON(STORAGE_KEYS.bookings, list);
    },
    create(userId, { guests, datetime, comment }) {
        const all = this._getAll();
        const booking = {
            id: Date.now().toString(),
            userId,
            guests,
            datetime, // строка datetime-local
            comment: comment || "",
            createdAt: new Date().toISOString(),
            status: "Забронировано",
        };
        all.push(booking);
        this._saveAll(all);
        return booking;
    },
    getForUser(userId) {
        const all = this._getAll();
        return all.filter((b) => String(b.userId) === String(userId));
    },
    cancel(id) {
        const all = this._getAll();
        const idx = all.findIndex((b) => String(b.id) === String(id));
        if (idx !== -1) {
            all.splice(idx, 1);
            this._saveAll(all);
        }
    },
};

// ===== STAFF =====

const Staff = {
    _getAll() {
        return readJSON(STAFF_STORAGE_KEY, []);
    },
    _saveAll(list) {
        writeJSON(STAFF_STORAGE_KEY, list);
    },
    create({ name, role }) {
        const list = this._getAll();
        const item = {
            id: Date.now().toString(),
            name: name.trim(),
            role: role.trim(),
            createdAt: new Date().toISOString()
        };
        list.push(item);
        this._saveAll(list);
        return item;
    },
    update(id, changes) {
        const list = this._getAll();
        const idx = list.findIndex((s) => String(s.id) === String(id));
        if (idx === -1) return null;
        list[idx] = { ...list[idx], ...changes };
        this._saveAll(list);
        return list[idx];
    },
    remove(id) {
        const list = this._getAll();
        const filtered = list.filter((s) => String(s.id) !== String(id));
        this._saveAll(filtered);
    }
};


// ===== AUTH MODAL UI =====

const authModalState = {
    modal: null,
    overlay: null,
    regForm: null,
    loginForm: null,
};

function showAuthForm(which) {
    if (!authModalState.regForm || !authModalState.loginForm) return;
    if (which === "login") {
        authModalState.loginForm.classList.add("auth-form--active");
        authModalState.regForm.classList.remove("auth-form--active");
    } else {
        authModalState.regForm.classList.add("auth-form--active");
        authModalState.loginForm.classList.remove("auth-form--active");
    }
}

function openAuthModal(mode) {
    if (!authModalState.modal) return;
    showAuthForm(mode === "login" ? "login" : "register");
    authModalState.modal.classList.add("auth-modal--open");
    authModalState.modal.setAttribute("aria-hidden", "false");
}

function closeAuthModal() {
    if (!authModalState.modal) return;
    authModalState.modal.classList.remove("auth-modal--open");
    authModalState.modal.setAttribute("aria-hidden", "true");
}

function setupAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;

    authModalState.modal = modal;
    authModalState.overlay = modal.querySelector(".auth-modal__overlay");
    authModalState.regForm = modal.querySelector('[data-auth-form="register"]');
    authModalState.loginForm = modal.querySelector('[data-auth-form="login"]');

    const toLogin = modal.querySelector('[data-auth-to="login"]');
    const toRegister = modal.querySelector('[data-auth-to="register"]');
    const closeButtons = modal.querySelectorAll("[data-auth-close]");

    // открытие по data-open-auth (Регистрация, Профиль в незалогиненном состоянии)
    const openLinks = document.querySelectorAll("[data-open-auth]");
    openLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
            const mode = link.getAttribute("data-open-auth");

            // если атрибута уже нет – это обычная ссылка (например, Админ после логина)
            if (!mode) {
                return; // НЕ вызываем preventDefault, просто переходим по href
            }

            e.preventDefault();
            openAuthModal(mode);
        });
    });



    if (toLogin) toLogin.addEventListener("click", () => showAuthForm("login"));
    if (toRegister) toRegister.addEventListener("click", () => showAuthForm("register"));

    closeButtons.forEach((btn) =>
        btn.addEventListener("click", () => closeAuthModal())
    );

    if (authModalState.overlay) {
        authModalState.overlay.addEventListener("click", () => closeAuthModal());
    }

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAuthModal();
    });

    // обработка сабмита форм
    if (authModalState.regForm) {
        authModalState.regForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = authModalState.regForm.querySelector('input[type="email"]').value;
            const password =
                authModalState.regForm.querySelector('input[type="password"]').value;
            const checkbox =
                authModalState.regForm.querySelector('input[type="checkbox"]');
            const res = Auth.register(email, password, checkbox && checkbox.checked);
            if (!res.success) {
                alert(res.message);
                return;
            }
            updateHeaderForAuth();
            closeAuthModal();
        });
    }

    if (authModalState.loginForm) {
        authModalState.loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const email = authModalState.loginForm.querySelector('input[type="email"]').value;
            const password =
                authModalState.loginForm.querySelector('input[type="password"]').value;
            const res = Auth.login(email, password);
            if (!res.success) {
                alert(res.message);
                return;
            }
            updateHeaderForAuth();
            closeAuthModal();
        });
    }
}

// ===== HEADER =====

function updateHeaderForAuth() {
    const currentUser = Auth.getCurrentUser();
    const regItem = document.getElementById("nav-register-item");
    const logoutItem = document.getElementById("nav-logout-item");
    const profileLink = document.getElementById("profile-link");
    const adminLink = document.getElementById("admin-link");

    if (currentUser) {
        // пользователь залогинен
        if (regItem) regItem.style.display = "none";
        if (logoutItem) logoutItem.style.display = "";
        if (profileLink) {
            profileLink.setAttribute("href", "profile.html");
            profileLink.removeAttribute("data-open-auth");
        }

        // для простоты: ЛЮБОЙ залогиненный пользователь может открыть admin.html
        // если хочешь — сюда можно потом добавить проверку isAdmin
        if (adminLink) {
            adminLink.style.display = "";
            adminLink.setAttribute("href", "admin.html");
            adminLink.removeAttribute("data-open-auth"); // <- ключевой момент
        }
    } else {
        // не залогинен
        if (regItem) regItem.style.display = "";
        if (logoutItem) logoutItem.style.display = "none";
        if (profileLink) {
            profileLink.setAttribute("href", "#");
            profileLink.setAttribute("data-open-auth", "login");
        }

        if (adminLink) {
            adminLink.style.display = "";
            adminLink.setAttribute("href", "#");
            adminLink.setAttribute("data-open-auth", "login"); // «Админ» открывает модалку
        }
    }
}


function setupHeader() {
    updateHeaderForAuth();

    const logoutLink = document.getElementById("logout-link");
    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            Auth.logout();
            updateHeaderForAuth();
            // необязательно, но можно:
            // window.location.href = "index.html";
        });
    }
}

// ===== CHECKOUT PAGE =====

function setupCheckoutPage() {
    const form = document.querySelector(".checkout-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const user = Auth.getCurrentUser();
        if (!user) {
            alert("Сначала войдите или зарегистрируйтесь.");
            openAuthModal("register");
            return;
        }

        const guestsInput = form.querySelector("#guests");
        const commentsInput = form.querySelector("#comments");
        const datetimeInput = form.querySelector("#datetime");

        const guests = parseInt(guestsInput && guestsInput.value, 10) || 1;
        const comment = commentsInput ? commentsInput.value : "";
        const datetime = datetimeInput ? datetimeInput.value : "";

        Booking.create(user.id, { guests, datetime, comment });

        alert("Бронь создана. Сейчас откроется профиль.");
        window.location.href = "profile.html";
    });
}

// ===== PROFILE PAGE =====

function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ru-RU");
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function renderBookingHTML(b) {
    const created = formatDate(b.createdAt);
    const date = formatDate(b.datetime);
    const time = formatTime(b.datetime);

    return `
    <article class="profile-booking" data-booking-id="${b.id}">
      <div class="profile-booking__date">
        <div class="profile-booking__date-main">${created}</div>
        <div class="profile-booking__status-label">Обработано</div>
      </div>
      <div class="profile-booking__details">
        <div class="profile-booking__row">
          <span class="profile-booking__label">Бронь</span>
        </div>
        <div class="profile-booking__row">
          <span class="profile-booking__label">Количество человек</span>
          <span class="profile-booking__value">${b.guests}</span>
        </div>
        <div class="profile-booking__row">
          <span class="profile-booking__label">Дата, Время</span>
          <span class="profile-booking__value">${date}${time ? ", " + time : ""}</span>
        </div>
      </div>
      <div class="profile-booking__actions">
        <div class="profile-booking__state">
          <span>Забронировано</span>
          <span>✔</span>
        </div>
        <button type="button" class="btn btn-primary profile-booking__cancel"
                data-cancel-booking="${b.id}">
          Отмена
        </button>
      </div>
    </article>
  `;
}

function setupProfilePage() {
    const profileRoot = document.querySelector("[data-profile-page]");
    if (!profileRoot) return;

    const listEl = document.getElementById("profile-bookings");
    if (!listEl) return;

    const user = Auth.getCurrentUser();
    if (!user) {
        listEl.innerHTML =
            '<p>Чтобы просмотреть брони, войдите в аккаунт через «Регистрация» или «Профиль».</p>';
        return;
    }

    function redraw() {
        const bookings = Booking.getForUser(user.id);
        if (!bookings.length) {
            listEl.innerHTML = "<p>У вас пока нет броней.</p>";
            return;
        }
        listEl.innerHTML = bookings
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((b) => renderBookingHTML(b))
            .join("");
    }

    redraw();

    listEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cancel-booking]");
        if (!btn) return;
        const id = btn.getAttribute("data-cancel-booking");
        if (confirm("Отменить бронь?")) {
            Booking.cancel(id);
            redraw();
        }
    });
}
// ===== PRODUCTS (товары для меню) =====

const DEFAULT_PRODUCTS = [
    {
        id: "1",
        title: "Gourmet Truffle Oil Set",
        category: "Gourmet",
        price: 80,
        image: "img/Picutre.png",
        description: "Набор ароматного трюфельного масла для изысканных блюд."
    },
    {
        id: "2",
        title: "Artisanal Chocolate Collection",
        category: "Dessert",
        price: 62.5,
        image: "img/Picutre.png",
        description: "Ремесленные шоколадные конфеты в подарочной упаковке."
    },
    {
        id: "3",
        title: "Fine Dining Cookware Set",
        category: "Tableware",
        price: 279,
        image: "img/Picutre.png",
        description: "Премиальный набор посуды для сервировки в ресторанном стиле."
    },
    {
        id: "4",
        title: "Vintage Crystal Wine Glasses (Set of 4)",
        category: "Tableware",
        price: 120,
        image: "img/Picutre.png",
        description: "Набор винных бокалов из хрусталя в винтажном стиле."
    },
    {
        id: "5",
        title: "Signature Espresso Blend",
        category: "Beverages",
        price: 24,
        image: "img/Picutre.png",
        description: "Фирменная смесь кофейных зёрен для насыщенного эспрессо."
    },
    {
        id: "6",
        title: "Handcrafted Herbal Tea Selection",
        category: "Beverages",
        price: 32,
        image: "img/Picutre.png",
        description: "Ассорти авторских травяных чаёв в шёлковых пакетиках."
    },
    {
        id: "7",
        title: "Gourmet Sea Salt Trio",
        category: "Gourmet",
        price: 28.5,
        image: "img/Picutre.png",
        description: "Три вида морской соли: копчёная, с пряностями и с цитрусами."
    },
    {
        id: "8",
        title: "Aged Balsamic Vinegar Reserve",
        category: "Gourmet",
        price: 54,
        image: "img/Picutre.png",
        description: "Выдержанный бальзамический уксус для салатов и десертов."
    },
    {
        id: "9",
        title: "Macaron Gift Assortment",
        category: "Dessert",
        price: 45,
        image: "img/Picutre.png",
        description: "Набор французских макарons с разными вкусами."
    },
    {
        id: "10",
        title: "Caramelized Nut Praline Box",
        category: "Dessert",
        price: 38,
        image: "img/Picutre.png",
        description: "Ассорти орехов в карамели и пралине, идеальный к кофе."
    },
    {
        id: "11",
        title: "Luxury Cheese Board Set",
        category: "Tableware",
        price: 150,
        image: "img/Picutre.png",
        description: "Деревянная доска с ножами для подачи сыра и закусок."
    },
    {
        id: "12",
        title: "Spice Library Collection",
        category: "Gourmet",
        price: 89,
        image: "img/Picutre.png",
        description: "Коллекция редких специй в стеклянных баночках."
    },
    {
        id: "13",
        title: "Gold-Rimmed Dessert Plates (Set of 6)",
        category: "Tableware",
        price: 96,
        image: "img/Picutre.png",
        description: "Набор десертных тарелок с золотым кантом."
    },
    {
        id: "14",
        title: "House Signature Sauce Trio",
        category: "Gourmet",
        price: 52,
        image: "img/Picutre.png",
        description: "Три фирменных соуса ресторана: острый, пряный и сливочный."
    },
    {
        id: "15",
        title: "Dark Chocolate & Orange Marmalade Gift Set",
        category: "Dessert",
        price: 58,
        image: "img/Picutre.png",
        description: "Набор тёмного шоколада и цитрусового конфитюра в подарочной коробке."
    }
];

function loadProducts() {
    const stored = readJSON(PRODUCTS_STORAGE_KEY, null);
    if (Array.isArray(stored) && stored.length) {
        return stored;
    }
    writeJSON(PRODUCTS_STORAGE_KEY, DEFAULT_PRODUCTS);
    return [...DEFAULT_PRODUCTS];
}

function saveProducts(products) {
    writeJSON(PRODUCTS_STORAGE_KEY, products);
}

// глобальный массив, с которым работает и меню, и админка
let PRODUCTS = loadProducts();


function formatPrice(value) {
    const num = Number(value) || 0;
    const fixed = num.toFixed(2);
    // делаем красиво: $62.50 -> $62.50, $80.00 -> $80
    return "$" + (fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed);
}

// ===== CART (корзина в localStorage) =====

const CART_STORAGE_KEY = "rr-cart";

const Cart = {
    _getIds() {
        // используем твой readJSON
        return readJSON(CART_STORAGE_KEY, []);
    },
    _saveIds(ids) {
        writeJSON(CART_STORAGE_KEY, ids);
    },
    getIds() {
        return this._getIds();
    },
    isInCart(id) {
        const ids = this._getIds();
        return ids.includes(String(id));
    },
    toggle(id) {
        const ids = this._getIds();
        const sid = String(id);
        const index = ids.indexOf(sid);
        if (index === -1) {
            ids.push(sid);
        } else {
            ids.splice(index, 1);
        }
        this._saveIds(ids);
    }
};


function renderProductCardHTML(p, inCart) {
    const btnText = inCart ? "In Cart" : "Add to Cart";

    return `
    <article class="product-card" data-product-id="${p.id}">
      <div class="product-card__image-wrapper">
        <img src="${p.image}" alt="${p.title}">
      </div>
      <h3 class="product-card__title">${p.title}</h3>
      <div class="product-card__price">${formatPrice(p.price)}</div>
      <button
        class="btn btn-primary product-card__btn"
        type="button"
        data-add-to-cart="${p.id}"
      >
        ${btnText}
      </button>
    </article>
  `;
}

function setupAdminPage() {
    const adminRoot = document.querySelector("[data-admin-page]");
    if (!adminRoot) return; // не admin.html

    const user = Auth.getCurrentUser();
    if (!user) {
        const productsList = document.getElementById("admin-products-list");
        const staffList = document.getElementById("admin-staff-list");
        if (productsList) {
            productsList.innerHTML = "<p>Войдите в аккаунт, чтобы работать с админ-панелью.</p>";
        }
        if (staffList) {
            staffList.innerHTML = "";
        }
        return;
    }

    // ===== элементы формы товаров =====
    const productForm = document.getElementById("admin-product-form");
    const productIdInput = document.getElementById("admin-product-id");
    const productTitleInput = document.getElementById("admin-product-title");
    const productCategoryInput = document.getElementById("admin-product-category");
    const productPriceInput = document.getElementById("admin-product-price");
    const productDescriptionInput = document.getElementById("admin-product-description");
    const productImageInput = document.getElementById("admin-product-image");
    const productsListEl = document.getElementById("admin-products-list");

    // ===== элементы формы персонала =====
    const staffForm = document.getElementById("admin-staff-form");
    const staffIdInput = document.getElementById("admin-staff-id");
    const staffNameInput = document.getElementById("admin-staff-name");
    const staffRoleInput = document.getElementById("admin-staff-role");
    const staffListEl = document.getElementById("admin-staff-list");

    // --- продукты ---

    function resetProductForm() {
        productIdInput.value = "";
        productTitleInput.value = "";
        productCategoryInput.value = "";
        productPriceInput.value = "";
        productDescriptionInput.value = "";
        productImageInput.value = "";
    }

    function renderProducts() {
        if (!productsListEl) return;
        if (!PRODUCTS.length) {
            productsListEl.innerHTML = "<p>Пока нет товаров.</p>";
            return;
        }
        productsListEl.innerHTML = PRODUCTS
            .map((p) => `
                <div class="admin-product-item" data-product-id="${p.id}">
                    <div class="admin-product-item__main">
                        <strong>${p.title}</strong> ${typeof p.price !== "undefined" ? " $" + p.price : ""}
                    </div>
                    <div class="admin-product-item__actions">
                        <button type="button" class="btn admin-btn" data-edit-product="${p.id}">Редактировать</button>
                        <button type="button" class="btn admin-btn admin-btn--danger" data-delete-product="${p.id}">Удалить</button>
                    </div>
                </div>
            `)
            .join("");
    }

    if (productForm) {
        productForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = productIdInput.value.trim();
            const title = (productTitleInput.value || "").trim();
            const category = (productCategoryInput.value || "").trim();
            const priceVal = parseFloat((productPriceInput.value || "").replace(",", "."));
            const price = Number.isFinite(priceVal) ? priceVal : 0;
            const description = productDescriptionInput.value || "";
            const image = productImageInput.value || "";

            if (!title) {
                alert("Введите название товара");
                return;
            }

            if (id) {
                const idx = PRODUCTS.findIndex((p) => String(p.id) === String(id));
                if (idx !== -1) {
                    PRODUCTS[idx] = { ...PRODUCTS[idx], title, category, price, description, image };
                }
            } else {
                const newProduct = {
                    id: Date.now().toString(),
                    title,
                    category,
                    price,
                    description,
                    image
                };
                PRODUCTS.push(newProduct);
            }

            saveProducts(PRODUCTS);
            resetProductForm();
            renderProducts();
        });
    }

    if (productsListEl) {
        productsListEl.addEventListener("click", (e) => {
            const editBtn = e.target.closest("[data-edit-product]");
            const delBtn = e.target.closest("[data-delete-product]");

            if (editBtn) {
                const id = editBtn.getAttribute("data-edit-product");
                const p = PRODUCTS.find((x) => String(x.id) === String(id));
                if (!p) return;
                productIdInput.value = p.id;
                productTitleInput.value = p.title || "";
                productCategoryInput.value = p.category || "";
                productPriceInput.value = p.price != null ? p.price : "";
                productDescriptionInput.value = p.description || "";
                productImageInput.value = p.image || "";
                window.scrollTo({ top: productForm.offsetTop - 80, behavior: "smooth" });
            } else if (delBtn) {
                const id = delBtn.getAttribute("data-delete-product");
                if (!confirm("Удалить товар?")) return;
                PRODUCTS = PRODUCTS.filter((p) => String(p.id) !== String(id));
                saveProducts(PRODUCTS);
                renderProducts();
            }
        });
    }

    // --- персонал ---

    function resetStaffForm() {
        staffIdInput.value = "";
        staffNameInput.value = "";
        staffRoleInput.value = "";
    }

    function renderStaff() {
        if (!staffListEl) return;
        const list = Staff._getAll();
        if (!list.length) {
            staffListEl.innerHTML = "<p>Персонал ещё не добавлен.</p>";
            return;
        }
        staffListEl.innerHTML = list
            .map((s) => {
                const createdDate = formatDate(s.createdAt);
                const createdTime = formatTime(s.createdAt);
                return `
                    <div class="admin-staff-item" data-staff-id="${s.id}">
                        <div class="admin-staff-item__main">
                            <strong>${s.name}</strong> — ${s.role}
                            <div class="admin-staff-item__created">
                                ${createdDate} ${createdTime}
                            </div>
                        </div>
                        <div class="admin-staff-item__actions">
                            <button type="button" class="btn admin-btn" data-edit-staff="${s.id}">Изменить</button>
                            <button type="button" class="btn admin-btn admin-btn--danger" data-delete-staff="${s.id}">Удалить</button>
                        </div>
                    </div>
                `;
            })
            .join("");
    }

    if (staffForm) {
        staffForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const id = staffIdInput.value.trim();
            const name = (staffNameInput.value || "").trim();
            const role = (staffRoleInput.value || "").trim();

            if (!name || !role) {
                alert("Введите имя и роль");
                return;
            }

            if (id) {
                Staff.update(id, { name, role });
            } else {
                Staff.create({ name, role });
            }

            resetStaffForm();
            renderStaff();
        });
    }

    if (staffListEl) {
        staffListEl.addEventListener("click", (e) => {
            const editBtn = e.target.closest("[data-edit-staff]");
            const delBtn = e.target.closest("[data-delete-staff]");

            if (editBtn) {
                const id = editBtn.getAttribute("data-edit-staff");
                const list = Staff._getAll();
                const s = list.find((x) => String(x.id) === String(id));
                if (!s) return;
                staffIdInput.value = s.id;
                staffNameInput.value = s.name || "";
                staffRoleInput.value = s.role || "";
                window.scrollTo({ top: staffForm.offsetTop - 80, behavior: "smooth" });
            } else if (delBtn) {
                const id = delBtn.getAttribute("data-delete-staff");
                if (!confirm("Удалить сотрудника?")) return;
                Staff.remove(id);
                renderStaff();
            }
        });
    }

    // стартовый рендер
    renderProducts();
    renderStaff();
}


function setupMenuPage() {
    const grid = document.getElementById("products-grid");
    if (!grid) return; // мы не на странице меню

    const sortSelect = document.getElementById("products-sort");
    const cartToggle = document.getElementById("cart-toggle");

    // текущее состояние: показываем все товары или только из корзины
    let viewMode = "all"; // "all" | "cart"

    function getSortedProducts() {
        let sorted = [...PRODUCTS];

        if (!sortSelect) return sorted;

        switch (sortSelect.value) {
            case "price-asc":
                sorted.sort((a, b) => a.price - b.price);
                break;
            case "price-desc":
                sorted.sort((a, b) => b.price - a.price);
                break;
            case "name-asc":
                sorted.sort((a, b) => a.title.localeCompare(b.title));
                break;
            default:
                // default — исходный порядок
                sorted = [...PRODUCTS];
        }
        return sorted;
    }

    function getProductsForCurrentView() {
        const base = getSortedProducts();
        if (viewMode === "cart") {
            const ids = new Set(Cart.getIds());
            return base.filter((p) => ids.has(String(p.id)));
        }
        return base;
    }

    function draw() {
        const list = getProductsForCurrentView();
        if (!list.length) {
            grid.innerHTML =
                viewMode === "cart"
                    ? '<p class="menu-empty">В корзине пока нет товаров.</p>'
                    : '<p class="menu-empty">Товары недоступны.</p>';
            return;
        }

        grid.innerHTML = list
            .map((p) => renderProductCardHTML(p, Cart.isInCart(p.id)))
            .join("");
    }

    // стартовый рендер
    draw();

    // сортировка
    if (sortSelect) {
        sortSelect.addEventListener("change", () => {
            draw();
        });
    }

    // переключение режима "все/корзина"
    if (cartToggle) {
        cartToggle.addEventListener("click", () => {
            viewMode = viewMode === "all" ? "cart" : "all";
            cartToggle.classList.toggle(
                "menu-toolbar__icon--active",
                viewMode === "cart"
            );
            draw();
        });
    }

    // обработка "Add to Cart"
    grid.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-add-to-cart]");
        if (!btn) return;

        const id = btn.getAttribute("data-add-to-cart");
        Cart.toggle(id);      // добавили/убрали
        draw();               // перерисовали сетку с актуальными кнопками
    });
}

// ===== HERO SLIDER =====

const HERO_SLIDES = [
    {
        image: "img/Main.png",
    },
    {
        image: "img/Admin.png",
    },
    {
        image: "img/Shop.png",
    }
    // можешь добавить ещё слайдов при желании
];

function setupHeroSlider() {
    const hero = document.querySelector(".hero");
    if (!hero) return; // не на главной

    const leftBtn = hero.querySelector(".hero-arrow--left");
    const rightBtn = hero.querySelector(".hero-arrow--right");
    const dots = Array.from(hero.querySelectorAll(".hero-dot"));

    let currentIndex = 0;
    let autoTimer = null;

    function applySlide(index) {
        const total = HERO_SLIDES.length;
        if (!total) return;

        currentIndex = (index + total) % total;

        const slide = HERO_SLIDES[currentIndex];
        hero.style.backgroundImage = `url("${slide.image}")`;

        // обновим точки
        dots.forEach((dot, i) => {
            dot.classList.toggle("hero-dot--active", i === currentIndex);
        });
    }

    function nextSlide() {
        applySlide(currentIndex + 1);
    }

    function prevSlide() {
        applySlide(currentIndex - 1);
    }

    function resetAutoTimer() {
        if (autoTimer) clearInterval(autoTimer);
        autoTimer = setInterval(nextSlide, 7000); // авто-скролл каждые 7 секунд
    }

    // обработчики стрелок
    if (leftBtn) {
        leftBtn.addEventListener("click", () => {
            prevSlide();
            resetAutoTimer();
        });
    }

    if (rightBtn) {
        rightBtn.addEventListener("click", () => {
            nextSlide();
            resetAutoTimer();
        });
    }

    // клики по точкам
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            applySlide(index);
            resetAutoTimer();
        });
    });

    // старт
    applySlide(0);
    resetAutoTimer();
}


// ===== INIT =====

document.addEventListener("DOMContentLoaded", function () {
    Auth.ensureDefaultAdmin();
    setupAuthModal();
    setupHeader();
    setupCheckoutPage();
    setupProfilePage();
    setupMenuPage && setupMenuPage();
    setupAdminPage && setupAdminPage();
    setupHeroSlider && setupHeroSlider();
});
