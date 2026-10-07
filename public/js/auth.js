// Client-side authentication status updates
document.addEventListener("DOMContentLoaded", async () => {
  const navActions = document.querySelector(".nav-actions");
  if (!navActions) return;

  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    // Check cart count
    updateGlobalCartCount();

    if (data.loggedIn) {
      // Sync guest wishlist if user is logged in
      const guestWishlist = JSON.parse(localStorage.getItem("urbanThreadsWishlist") || "[]");
      if (guestWishlist.length > 0) {
        for (const productId of guestWishlist) {
          try {
            await fetch("/api/wishlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId })
            });
          } catch (e) {
            console.error("Wishlist sync error:", e);
          }
        }
        localStorage.removeItem("urbanThreadsWishlist");
      }

      // User is logged in
      let adminLink = "";
      if (data.user.role === "admin") {
        adminLink = `<a href="admin.html" style="color: #c5a059; font-weight: 700; margin-right: 20px;">Admin Portal</a>`;
      }

      navActions.innerHTML = `
        ${adminLink}
        <a href="profile.html" style="margin-right: 20px;">My Account</a>
        <button id="logout-btn" style="text-transform: uppercase; font-size: 0.9rem; font-weight: 600; border: none; background: none; color: #a83c32; cursor: pointer; margin-right: 20px; font-family: inherit;">Logout</button>
        <a class="cart-link" href="cart.html">Cart <span class="cart-count" data-cart-count>0</span></a>
      `;

      document.getElementById("logout-btn")?.addEventListener("click", async () => {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        const result = await res.json();
        if (result.success) {
          // Clear any local storage cart if needed, or simply redirect
          localStorage.removeItem("urbanThreadsGuestCart");
          window.location.href = "index.html";
        }
      });
    } else {
      // Guest user
      navActions.innerHTML = `
        <a href="login.html" style="margin-right: 20px;">Login</a>
        <a class="cart-link" href="cart.html">Cart <span class="cart-count" data-cart-count>0</span></a>
      `;
    }

    // Refresh cart count badge in header
    updateGlobalCartCount();
  } catch (err) {
    console.error("Error loading auth state:", err);
  }
});

// Helper to update the cart badge count globally
async function updateGlobalCartCount() {
  const response = await fetch("/api/auth/me");
  const auth = await response.json();
  let count = 0;

  if (auth.loggedIn) {
    // Get from database
    try {
      const res = await fetch("/api/cart");
      const cartItems = await res.json();
      count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    } catch (e) {
      console.error("Error fetching cart count:", e);
    }
  } else {
    // Get from local storage guest cart
    let guestCart = JSON.parse(localStorage.getItem("urbanThreadsGuestCart") || "[]");
    if (!Array.isArray(guestCart)) {
      guestCart = [];
      localStorage.setItem("urbanThreadsGuestCart", "[]");
    }
    count = guestCart.reduce((sum, item) => sum + item.quantity, 0);
  }

  document.querySelectorAll("[data-cart-count]").forEach(el => {
    el.textContent = count;
  });
}
