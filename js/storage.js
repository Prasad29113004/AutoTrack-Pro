/* =========================================================
   AutoTrack Pro - shared localStorage and UI utilities
   All pages use this file as their small, browser-only "database".
   ========================================================= */

const VSS = (() => {
  const KEYS = {
    users: "vss_users",
    bookings: "vss_bookings",
    session: "vss_session",
    adminSession: "vss_admin_session",
    theme: "vss_theme",
  };

  const SERVICE_TASKS = [
    "Vehicle Received",
    "Initial Inspection Completed",
    "Engine Oil Changed",
    "Oil Filter Replaced",
    "Brake Inspection Completed",
    "Spare Parts Replaced",
    "Vehicle Washing Completed",
    "Quality Check Completed",
    "Ready for Delivery",
  ];

  const SERVICES = {
    "Periodic Service": 3499,
    "Full Vehicle Service": 6499,
    "Engine Diagnostics": 1999,
    "Brake Service": 2499,
    "AC Service": 1999,
    "Detailing & Wash": 1499,
  };

  const read = (key, fallback = []) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const uid = (prefix = "ID") =>
    `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

  const serviceId = () => {
    const date = new Date();
    const stamp = `${String(date.getFullYear()).slice(-2)}${String(
      date.getMonth() + 1
    ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    return `VSS-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const dateOffset = (days) => {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return value.toISOString().slice(0, 10);
  };

  function seed() {
    if (!localStorage.getItem(KEYS.users)) {
      write(KEYS.users, [
        {
          id: "USR-DEMO",
          name: "Aarav Sharma",
          email: "aarav@example.com",
          phone: "9876543210",
          password: "demo123",
          address: "Pune, Maharashtra",
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    if (!localStorage.getItem(KEYS.bookings)) {
      write(KEYS.bookings, [
        {
          id: "BKG-DEMO",
          serviceId: "VSS-DEMO-1001",
          userId: "USR-DEMO",
          customerName: "Aarav Sharma",
          email: "aarav@example.com",
          phone: "9876543210",
          vehicle: {
            make: "Hyundai",
            model: "Creta",
            number: "MH 12 AB 4582",
            fuel: "Petrol",
            year: "2023",
          },
          serviceType: "Full Vehicle Service",
          preferredDate: dateOffset(0),
          notes: "Please check the brake noise and tyre pressure.",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          expectedDate: dateOffset(2),
          status: "In Progress",
          timeline: SERVICE_TASKS.map((title, index) => ({
            id: uid("TSK"),
            title,
            completed: index < 4,
            completedAt:
              index < 4
                ? new Date(Date.now() - (22 - index * 3) * 3600000).toISOString()
                : null,
            note:
              index === 0
                ? "Vehicle checked in at Bay 04."
                : index === 1
                ? "Inspection report shared with service advisor."
                : index === 2
                ? "Premium 5W-30 synthetic oil used."
                : index === 3
                ? "OEM oil filter installed."
                : "",
            images: [],
          })),
          updates: [
            {
              id: uid("UPD"),
              message: "Oil filter replacement completed successfully.",
              type: "success",
              createdAt: new Date(Date.now() - 13 * 3600000).toISOString(),
              read: false,
            },
            {
              id: uid("UPD"),
              message: "Your vehicle service has started.",
              type: "info",
              createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
              read: true,
            },
          ],
          invoice: {
            number: "INV-DEMO-1001",
            parts: [
              { name: "Synthetic Engine Oil 5W-30", qty: 4, cost: 850 },
              { name: "OEM Oil Filter", qty: 1, cost: 620 },
            ],
            labour: 1800,
            discount: 300,
            taxRate: 18,
            createdAt: new Date().toISOString(),
          },
          pickup: {
            date: dateOffset(2),
            time: "16:30",
            type: "Self Pickup",
            address: "",
            note: "Please carry a valid ID.",
          },
        },
      ]);
    }
  }

  function getUsers() {
    return read(KEYS.users);
  }

  function saveUsers(users) {
    write(KEYS.users, users);
  }

  function getBookings() {
    return read(KEYS.bookings);
  }

  function saveBookings(bookings) {
    write(KEYS.bookings, bookings);
    window.dispatchEvent(new CustomEvent("vss:datachange"));
  }

  function getUser() {
    const session = read(KEYS.session, null);
    if (!session) return null;
    return getUsers().find((user) => user.id === session.userId) || null;
  }

  function getUserBookings() {
    const user = getUser();
    return user ? getBookings().filter((booking) => booking.userId === user.id) : [];
  }

  function getBooking(id) {
    return getBookings().find(
      (booking) =>
        booking.id === id || booking.serviceId.toLowerCase() === String(id).toLowerCase()
    );
  }

  function updateBooking(id, updater) {
    const bookings = getBookings();
    const index = bookings.findIndex(
      (booking) => booking.id === id || booking.serviceId === id
    );
    if (index === -1) return null;
    bookings[index] =
      typeof updater === "function"
        ? updater(structuredClone(bookings[index]))
        : { ...bookings[index], ...updater };
    saveBookings(bookings);
    return bookings[index];
  }

  function progress(booking) {
    if (!booking?.timeline?.length) return 0;
    const completed = booking.timeline.filter((task) => task.completed).length;
    return Math.round((completed / booking.timeline.length) * 100);
  }

  function statusFor(booking) {
    const value = progress(booking);
    if (value === 100) return "Completed";
    if (value > 0) return "In Progress";
    return "Pending";
  }

  function money(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value) || 0);
  }

  function niceDate(value, withTime = false) {
    if (!value) return "Not scheduled";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(new Date(value));
  }

  function invoiceTotals(invoice = {}) {
    const parts = (invoice.parts || []).reduce(
      (sum, item) => sum + Number(item.qty || 0) * Number(item.cost || 0),
      0
    );
    const labour = Number(invoice.labour || 0);
    const discount = Number(invoice.discount || 0);
    const subtotal = Math.max(0, parts + labour - discount);
    const tax = subtotal * (Number(invoice.taxRate || 0) / 100);
    return { parts, labour, discount, subtotal, tax, total: subtotal + tax };
  }

  function toast(message, type = "success") {
    let stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      document.body.appendChild(stack);
    }
    const item = document.createElement("div");
    item.className = `toast toast-${type}`;
    item.innerHTML = `<span class="toast-icon">${type === "error" ? "!" : "✓"}</span>
      <span>${escapeHTML(message)}</span>`;
    stack.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 250);
    }, 3200);
  }

  function confirmAction(message, title = "Please confirm") {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-backdrop open";
      overlay.innerHTML = `
        <div class="confirm-card" role="dialog" aria-modal="true">
          <div class="confirm-symbol">?</div>
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" data-answer="false">Cancel</button>
            <button class="btn btn-danger" data-answer="true">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelectorAll("[data-answer]").forEach((button) => {
        button.addEventListener("click", () => {
          const answer = button.dataset.answer === "true";
          overlay.remove();
          resolve(answer);
        });
      });
    });
  }

  function escapeHTML(value = "") {
    return String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[
          char
        ])
    );
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function applyTheme() {
    const theme = localStorage.getItem(KEYS.theme) || "light";
    document.documentElement.dataset.theme = theme;
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.innerHTML = theme === "dark" ? "☀" : "☾";
      button.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  function initShell() {
    applyTheme();
    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.addEventListener("click", () => {
        const next =
          document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        localStorage.setItem(KEYS.theme, next);
        applyTheme();
      });
    });

    const toggle = document.querySelector("[data-menu-toggle]");
    const nav = document.querySelector("[data-nav]");
    toggle?.addEventListener("click", () => {
      nav?.classList.toggle("open");
      toggle.classList.toggle("open");
    });

    const current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("[data-nav] a").forEach((link) => {
      if (link.getAttribute("href") === current) link.classList.add("active");
    });

    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = new Date().getFullYear();
    });

    document.querySelectorAll("[data-logout]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (await confirmAction("You will need to sign in again.", "Log out?")) {
          localStorage.removeItem(KEYS.session);
          location.href = "login.html";
        }
      });
    });
  }

  function requireUser() {
    if (!getUser()) {
      location.replace("login.html?redirect=" + encodeURIComponent(location.href));
      return false;
    }
    return true;
  }

  function requireAdmin() {
    if (!read(KEYS.adminSession, null)) {
      location.replace("admin-login.html");
      return false;
    }
    return true;
  }

  seed();
  document.addEventListener("DOMContentLoaded", initShell);

  return {
    KEYS,
    SERVICE_TASKS,
    SERVICES,
    read,
    write,
    uid,
    serviceId,
    dateOffset,
    getUsers,
    saveUsers,
    getBookings,
    saveBookings,
    getUser,
    getUserBookings,
    getBooking,
    updateBooking,
    progress,
    statusFor,
    money,
    niceDate,
    invoiceTotals,
    toast,
    confirmAction,
    escapeHTML,
    fileToDataURL,
    requireUser,
    requireAdmin,
  };
})();
