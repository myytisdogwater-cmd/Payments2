const CART_KEY = 'unico_cart';

const Cart = {
  get() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  },

  save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    Cart.updateBadge();
  },

  add(product) {
    const items = Cart.get();
    const i = items.findIndex(p => p.id === product.id && p.size === product.size && p.color === product.color);
    if (i > -1) {
      items[i].qty += product.qty || 1;
    } else {
      items.push({ ...product, qty: product.qty || 1 });
    }
    Cart.save(items);
    return items;
  },

  remove(id, size, color) {
    const items = Cart.get().filter(p => !(p.id === id && p.size === size && p.color === color));
    Cart.save(items);
    return items;
  },

  updateQty(id, size, color, qty) {
    const items = Cart.get();
    const p = items.find(p => p.id === id && p.size === size && p.color === color);
    if (p) {
      p.qty = Math.max(1, qty);
    }
    Cart.save(items);
    return items;
  },

  clear() {
    localStorage.removeItem(CART_KEY);
    Cart.updateBadge();
  },

  count() {
    return Cart.get().reduce((s, p) => s + p.qty, 0);
  },

  total() {
    return Cart.get().reduce((s, p) => s + p.price * p.qty, 0);
  },

  updateBadge() {
    const n = Cart.count();
    document.querySelectorAll('.nav-cart-count').forEach(el => {
      el.textContent = n;
    });
    document.querySelectorAll('.mobile-cart-count').forEach(el => {
      el.textContent = `(${n})`;
    });
  }
};

document.addEventListener('DOMContentLoaded', Cart.updateBadge);

/* ── Dropdown hover bridge ── */
document.addEventListener('DOMContentLoaded', function() {
  var dd = document.querySelector('.dropdown');
  var menu = document.querySelector('.dropdown-menu');
  if (!dd || !menu) return;
  var t;
  dd.addEventListener('mouseenter', function() { clearTimeout(t); menu.classList.add('open'); });
  dd.addEventListener('mouseleave', function() {
    t = setTimeout(function() { menu.classList.remove('open'); }, 200);
  });
  menu.addEventListener('mouseenter', function() { clearTimeout(t); menu.classList.add('open'); });
  menu.addEventListener('mouseleave', function() {
    t = setTimeout(function() { menu.classList.remove('open'); }, 200);
  });
});
