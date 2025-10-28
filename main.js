import "./style.css";
import {
  fetchProducts,
  addToCart,
  getCartItems,
  updateCartItemQuantity,
  removeCartItem,
  getCartCount,
} from "./db.js";

let allProducts = [];
let currentFilters = {
  brands: ["Apple"],
  colors: [],
  minPrice: 211043,
  maxPrice: 5101998,
  discountOnly: false,
  discountPercentage: null,
  rating: null,
  screenSizes: [],
  search: "",
};

async function loadProducts() {
  const productsGrid = document.getElementById("productsGrid");
  productsGrid.innerHTML = '<div class="loading">Loading products...</div>';

  allProducts = await fetchProducts(currentFilters);
  renderProducts(allProducts);
  updateProductCount(allProducts.length);
}

function renderProducts(products) {
  const productsGrid = document.getElementById("productsGrid");

  if (products.length === 0) {
    productsGrid.innerHTML = '<div class="loading">No products found</div>';
    return;
  }

  productsGrid.innerHTML = products
    .map((product) => {
      const hasDiscount = product.discount_percentage > 0;
      const stars = product.rating
        ? "★".repeat(Math.floor(product.rating))
        : "";

      return `
      <div class="product-card" data-product-id="${product.id}">
        ${
          product.is_official_store
            ? '<div class="official-badge">Official Store</div>'
            : ""
        }
        <div class="product-image" style="background-image: url('https://placehold.co/280x200/f0f0f0/999999?text=${encodeURIComponent(
          product.brand?.name || "Phone"
        )}')"></div>
        <div class="product-name">${product.name}</div>
        <div class="product-price">₦ ${Number(
          product.price
        ).toLocaleString()}</div>
        ${
          hasDiscount
            ? `
          <div class="product-original-price">
            <span class="original-price">₦ ${Number(
              product.original_price
            ).toLocaleString()}</span>
            <span class="discount-badge">${product.discount_percentage}%</span>
          </div>
        `
            : ""
        }
        ${
          product.rating
            ? `
          <div class="product-rating">
            <span class="stars">${stars}</span>
            <span>(${product.review_count})</span>
          </div>
        `
            : ""
        }
        <button class="add-to-cart-btn" data-product-id="${
          product.id
        }">Add to Cart</button>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const productId = btn.dataset.productId;
      const success = await addToCart(productId);
      if (success) {
        btn.textContent = "Added!";
        btn.style.backgroundColor = "#067d62";
        setTimeout(() => {
          btn.textContent = "Add to Cart";
          btn.style.backgroundColor = "";
        }, 1500);
        updateCartBadge();
      }
    });
  });
}

function updateProductCount(count) {
  document.getElementById("productCount").textContent = count;
}

async function updateCartBadge() {
  const count = await getCartCount();
  const badge = document.getElementById("cartCount");
  badge.textContent = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

function setupFilters() {
  document
    .querySelectorAll('#brandFilter input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const checkedBrands = Array.from(
          document.querySelectorAll(
            '#brandFilter input[type="checkbox"]:checked'
          )
        ).map((cb) => cb.value);
        currentFilters.brands = checkedBrands;
        loadProducts();
      });
    });

  document
    .querySelectorAll('.filter-options input[type="checkbox"][value]')
    .forEach((checkbox) => {
      if (!checkbox.closest("#brandFilter")) {
        checkbox.addEventListener("change", () => {
          const filterType = checkbox
            .closest(".filter-section")
            .querySelector("h3").textContent;

          if (filterType === "Color") {
            currentFilters.colors = Array.from(
              document.querySelectorAll(
                '.filter-options input[type="checkbox"][value]:checked'
              )
            )
              .filter(
                (cb) =>
                  cb.closest(".filter-section").querySelector("h3")
                    .textContent === "Color"
              )
              .map((cb) => cb.value);
          }

          loadProducts();
        });
      }
    });

  document
    .querySelector(".discount-filter")
    ?.addEventListener("change", (e) => {
      currentFilters.discountOnly = e.target.checked;
      loadProducts();
    });

  document.querySelectorAll(".screen-filter").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      currentFilters.screenSizes = Array.from(
        document.querySelectorAll(".screen-filter:checked")
      ).map((cb) => parseFloat(cb.value));
      loadProducts();
    });
  });

  document.getElementById("applyPrice")?.addEventListener("click", () => {
    const minPrice = parseInt(document.getElementById("minPrice").value) || 0;
    const maxPrice =
      parseInt(document.getElementById("maxPrice").value) || 10000000;
    currentFilters.minPrice = minPrice;
    currentFilters.maxPrice = maxPrice;
    loadProducts();
  });

  document.querySelectorAll('input[name="discount"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentFilters.discountPercentage = e.target.checked
        ? parseInt(e.target.value)
        : null;
      loadProducts();
    });
  });

  document.querySelectorAll('input[name="rating"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      currentFilters.rating = e.target.checked
        ? parseInt(e.target.value)
        : null;
      loadProducts();
    });
  });

  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    currentFilters.search = e.target.value;
    debounce(() => loadProducts(), 500)();
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function setupCart() {
  const cartBtn = document.getElementById("cartBtn");
  const cartModal = document.getElementById("cartModal");
  const closeCart = document.getElementById("closeCart");

  cartBtn.addEventListener("click", async () => {
    await renderCart();
    cartModal.classList.add("active");
  });

  closeCart.addEventListener("click", () => {
    cartModal.classList.remove("active");
  });

  cartModal.addEventListener("click", (e) => {
    if (e.target === cartModal) {
      cartModal.classList.remove("active");
    }
  });
}

async function renderCart() {
  const cartItems = await getCartItems();
  const cartItemsContainer = document.getElementById("cartItems");
  const cartTotal = document.getElementById("cartTotal");

  if (cartItems.length === 0) {
    cartItemsContainer.innerHTML =
      '<p class="empty-cart">Your cart is empty</p>';
    cartTotal.textContent = "0";
    return;
  }

  let total = 0;

  cartItemsContainer.innerHTML = cartItems
    .map((item) => {
      const product = item.product;
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      return `
      <div class="cart-item" data-cart-id="${item.id}">
        <div class="cart-item-image" style="background-image: url('https://placehold.co/80x80/f0f0f0/999999?text=${encodeURIComponent(
          product.name.substring(0, 10)
        )}')"></div>
        <div class="cart-item-details">
          <div class="cart-item-name">${product.name}</div>
          <div class="cart-item-price">₦ ${Number(
            product.price
          ).toLocaleString()}</div>
          <div class="cart-item-actions">
            <div class="quantity-controls">
              <button class="quantity-btn decrease" data-cart-id="${
                item.id
              }">-</button>
              <span class="quantity">${item.quantity}</span>
              <button class="quantity-btn increase" data-cart-id="${
                item.id
              }">+</button>
            </div>
            <button class="remove-btn" data-cart-id="${item.id}">Remove</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  cartTotal.textContent = total.toLocaleString();

  document.querySelectorAll(".quantity-btn.increase").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cartId = btn.dataset.cartId;
      const item = cartItems.find((i) => i.id === cartId);
      await updateCartItemQuantity(cartId, item.quantity + 1);
      await renderCart();
      await updateCartBadge();
    });
  });

  document.querySelectorAll(".quantity-btn.decrease").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cartId = btn.dataset.cartId;
      const item = cartItems.find((i) => i.id === cartId);
      await updateCartItemQuantity(cartId, item.quantity - 1);
      await renderCart();
      await updateCartBadge();
    });
  });

  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cartId = btn.dataset.cartId;
      await removeCartItem(cartId);
      await renderCart();
      await updateCartBadge();
    });
  });
}

async function init() {
  await loadProducts();
  setupFilters();
  setupCart();
  await updateCartBadge();
}

init();
