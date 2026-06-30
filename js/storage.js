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
    dataVersion: "vss_data_version",
  };

  const ADMIN_SESSION_VERSION = "2026-1";

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

  /* Creates empty storage and removes legacy sample records from older builds. */
  function initializeStorage() {
    const users = read(KEYS.users, []).filter(
      (user) => !String(user.id || "").toUpperCase().includes("-DEMO")
    );
    const validUserIds = new Set(users.map((user) => user.id));
    const bookings = read(KEYS.bookings, []).filter(
      (booking) =>
        !String(booking.id || "").toUpperCase().includes("-DEMO") &&
        !String(booking.serviceId || "").toUpperCase().includes("-DEMO") &&
        validUserIds.has(booking.userId)
    );

    write(KEYS.users, users);
    write(KEYS.bookings, bookings);
    localStorage.setItem(KEYS.dataVersion, "2");

    const session = read(KEYS.session, null);
    if (session && !validUserIds.has(session.userId)) {
      localStorage.removeItem(KEYS.session);
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

  /* Compresses an uploaded photo before localStorage persistence. */
  async function imageFileToRecord(file) {
    if (!file?.type?.startsWith("image/")) {
      throw new Error("Only image files can be uploaded.");
    }
    if (file.size > 6 * 1024 * 1024) {
      throw new Error("Each image must be smaller than 6 MB.");
    }

    const original = await fileToDataURL(file);
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The selected image could not be read."));
      element.src = original;
    });

    const render = (maxDimension, quality) => {
      const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    };

    let dataUrl = render(1280, 0.78);
    if (dataUrl.length > 750000) dataUrl = render(900, 0.64);

    return {
      id: uid("IMG"),
      name: file.name || "service-photo.jpg",
      dataUrl,
      uploadedAt: new Date().toISOString(),
    };
  }

  /* Supports both new image records and old string records during migration. */
  function imageSource(image) {
    const source = typeof image === "string" ? image : image?.dataUrl || image?.src || "";
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(source) ? source : "";
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
    const session = read(KEYS.adminSession, null);
    if (
      !session ||
      session.role !== "administrator" ||
      session.credentialVersion !== ADMIN_SESSION_VERSION
    ) {
      localStorage.removeItem(KEYS.adminSession);
      location.replace("admin-login.html");
      return false;
    }
    return true;
  }

  initializeStorage();
  document.addEventListener("DOMContentLoaded", initShell);

  return {
    KEYS,
    SERVICE_TASKS,
    SERVICES,
    ADMIN_SESSION_VERSION,
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
    imageFileToRecord,
    imageSource,
    requireUser,
    requireAdmin,
  };
})();
