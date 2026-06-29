/* =========================================================
   Admin login and complete service-centre management console.
   Static demo credentials: admin@autotrack.com / Admin@123
   ========================================================= */

let adminState = { search: "", filter: "All", selectedId: null };

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleAdminLogin);
    return;
  }
  if (!document.getElementById("adminBookingRows") || !VSS.requireAdmin()) return;

  bindAdminControls();
  renderAdminDashboard();
});

function handleAdminLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const email = form.email.value.trim().toLowerCase();
  const password = form.password.value;

  if (email !== "admin@autotrack.com" || password !== "Admin@123") {
    VSS.toast("Invalid administrator credentials.", "error");
    return;
  }
  const button = form.querySelector("[type=submit]");
  button.disabled = true;
  button.innerHTML = '<span class="loader"></span> Verifying...';
  VSS.write(VSS.KEYS.adminSession, {
    role: "administrator",
    loginAt: new Date().toISOString(),
  });
  setTimeout(() => (location.href = "admin-dashboard.html"), 650);
}

function bindAdminControls() {
  document.getElementById("adminSearch").addEventListener("input", (event) => {
    adminState.search = event.target.value.trim().toLowerCase();
    renderAdminTable();
  });
  document.getElementById("adminFilter").addEventListener("change", (event) => {
    adminState.filter = event.target.value;
    renderAdminTable();
  });
  document.getElementById("adminLogout").addEventListener("click", async () => {
    if (await VSS.confirmAction("End the current administrator session?", "Log out?")) {
      localStorage.removeItem(VSS.KEYS.adminSession);
      location.href = "admin-login.html";
    }
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll("[data-admin-view]")
        .forEach((item) => item.classList.toggle("active", item === button));
      const filter = button.dataset.adminView;
      adminState.filter = filter;
      const select = document.getElementById("adminFilter");
      if ([...select.options].some((option) => option.value === filter)) select.value = filter;
      renderAdminTable();
    });
  });
  document.getElementById("refreshAdmin").addEventListener("click", () => {
    renderAdminDashboard();
    VSS.toast("Dashboard refreshed.");
  });
  document.addEventListener("click", handleAdminAction);
  window.addEventListener("storage", renderAdminDashboard);
}

function renderAdminDashboard() {
  const bookings = VSS.getBookings();
  const count = (status) =>
    bookings.filter((booking) => VSS.statusFor(booking) === status).length;
  setAdminText("adminTotal", bookings.length);
  setAdminText("adminProgress", count("In Progress"));
  setAdminText("adminCompleted", count("Completed"));
  setAdminText("adminPending", count("Pending"));
  renderAdminTable();
}

function renderAdminTable() {
  const rows = document.getElementById("adminBookingRows");
  let bookings = VSS.getBookings()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .filter((booking) => {
      const searchable = [
        booking.serviceId,
        booking.customerName,
        booking.vehicle.number,
        booking.vehicle.make,
        booking.vehicle.model,
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(adminState.search);
    });

  if (adminState.filter !== "All") {
    bookings = bookings.filter(
      (booking) => VSS.statusFor(booking) === adminState.filter
    );
  }

  if (!bookings.length) {
    rows.innerHTML =
      '<tr><td colspan="6"><div class="empty-state" style="padding:35px"><div class="empty-icon">⌕</div><h3>No matching bookings</h3><p>Try a different Service ID, customer, or status.</p></div></td></tr>';
    return;
  }

  rows.innerHTML = bookings
    .map((booking) => {
      const status = VSS.statusFor(booking);
      const percent = VSS.progress(booking);
      return `<tr>
        <td><strong>${VSS.escapeHTML(booking.serviceId)}</strong><br><span class="muted" style="font-size:.72rem">${VSS.niceDate(
        booking.createdAt
      )}</span></td>
        <td><strong>${VSS.escapeHTML(booking.customerName)}</strong><br><span class="muted" style="font-size:.72rem">${VSS.escapeHTML(
        booking.phone
      )}</span></td>
        <td class="vehicle-cell"><strong>${VSS.escapeHTML(
          booking.vehicle.make
        )} ${VSS.escapeHTML(booking.vehicle.model)}</strong><span>${VSS.escapeHTML(
        booking.vehicle.number
      )}</span></td>
        <td><div style="min-width:100px"><div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div><span class="muted" style="font-size:.7rem">${percent}%</span></div></td>
        <td>${adminStatusBadge(status)}</td>
        <td><div class="actions">
          <button class="btn btn-outline btn-sm" data-action="edit" data-id="${
            booking.id
          }" title="Update service">Update</button>
          <button class="btn btn-ghost btn-sm" data-action="more" data-id="${
            booking.id
          }" title="More actions">•••</button>
        </div></td>
      </tr>`;
    })
    .join("");
}

async function handleAdminAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const booking = VSS.getBooking(button.dataset.id);
  if (!booking) return;

  const action = button.dataset.action;
  if (action === "edit") openServiceModal(booking);
  if (action === "more") openActionsModal(booking);
  if (action === "invoice") openInvoiceModal(booking);
  if (action === "pickup") openPickupModal(booking);
  if (action === "ready") markReady(booking);
  if (action === "delete") deleteBooking(booking);
}

function openServiceModal(booking) {
  adminState.selectedId = booking.id;
  const modal = createModal(
    `Update service · ${booking.serviceId}`,
    `
      <form id="serviceUpdateForm">
        <div class="form-grid" style="margin-bottom:22px">
          <div class="form-group"><label>Expected delivery date</label><input class="input" type="date" name="expectedDate" value="${
            booking.expectedDate || ""
          }" required></div>
          <div class="form-group"><label>General service note</label><input class="input" name="generalNote" placeholder="Message shown to customer"></div>
        </div>
        <h4 style="margin-bottom:12px">Service task checklist</h4>
        <div class="task-editor">
          ${booking.timeline
            .map(
              (task, index) => `
              <div class="task-row ${task.completed ? "completed" : ""}">
                <input class="task-check" type="checkbox" name="task-${index}" ${
                task.completed ? "checked" : ""
              }>
                <div><h4>${VSS.escapeHTML(task.title)}</h4>
                <input class="input" style="min-height:36px;padding:7px 9px;margin-top:6px" name="note-${index}" value="${VSS.escapeHTML(
                task.note || ""
              )}" placeholder="Add task note"></div>
                <span class="badge ${
                  task.completed ? "badge-completed" : "badge-pending"
                }">${task.completed ? "Done" : "Pending"}</span>
              </div>`
            )
            .join("")}
        </div>
        <div class="upload-zone" style="margin-top:20px">
          <strong>Upload completed-work images</strong>
          <p class="muted" style="margin:4px 0 12px;font-size:.8rem">Images are saved in this browser. Max 3 files, 1 MB each.</p>
          <div class="form-grid">
            <select name="imageTask">${booking.timeline
              .map(
                (task, index) =>
                  `<option value="${index}">${VSS.escapeHTML(task.title)}</option>`
              )
              .join("")}</select>
            <input class="input" type="file" name="images" accept="image/*" multiple>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
          <button type="button" class="btn btn-ghost" data-close-generated>Cancel</button>
          <button type="submit" class="btn btn-primary">Save service update</button>
        </div>
      </form>`,
    false
  );

  modal.querySelectorAll(".task-check").forEach((check) => {
    check.addEventListener("change", () => {
      const row = check.closest(".task-row");
      row.classList.toggle("completed", check.checked);
      const badge = row.querySelector(".badge");
      badge.className = `badge ${check.checked ? "badge-completed" : "badge-pending"}`;
      badge.textContent = check.checked ? "Done" : "Pending";
    });
  });

  modal.querySelector("#serviceUpdateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const current = VSS.getBooking(booking.id);
    const timeline = current.timeline.map((task, index) => {
      const completed = form[`task-${index}`].checked;
      const newlyCompleted = completed && !task.completed;
      return {
        ...task,
        completed,
        completedAt: newlyCompleted
          ? new Date().toISOString()
          : completed
          ? task.completedAt || new Date().toISOString()
          : null,
        note: form[`note-${index}`].value.trim(),
      };
    });

    const files = [...form.images.files].slice(0, 3);
    if (files.some((file) => file.size > 1024 * 1024)) {
      VSS.toast("Each image must be smaller than 1 MB.", "error");
      return;
    }
    if (files.length) {
      const targetIndex = Number(form.imageTask.value);
      const urls = await Promise.all(files.map(VSS.fileToDataURL));
      timeline[targetIndex].images = [...(timeline[targetIndex].images || []), ...urls];
    }

    const newUpdates = [];
    timeline.forEach((task, index) => {
      if (task.completed && !current.timeline[index].completed) {
        newUpdates.push({
          id: VSS.uid("UPD"),
          message: `${task.title}.`,
          type: "success",
          createdAt: new Date().toISOString(),
          read: false,
        });
      }
    });
    if (form.generalNote.value.trim()) {
      newUpdates.push({
        id: VSS.uid("UPD"),
        message: form.generalNote.value.trim(),
        type: "info",
        createdAt: new Date().toISOString(),
        read: false,
      });
    }

    VSS.updateBooking(booking.id, {
      ...current,
      expectedDate: form.expectedDate.value,
      timeline,
      status: timeline.every((task) => task.completed)
        ? "Completed"
        : timeline.some((task) => task.completed)
        ? "In Progress"
        : "Pending",
      updates: [...newUpdates, ...(current.updates || [])],
    });
    closeGeneratedModal();
    renderAdminDashboard();
    VSS.toast("Service progress updated.");
  });
}

function openActionsModal(booking) {
  createModal(
    `${booking.serviceId} · Actions`,
    `<div class="booking-item" style="margin-bottom:18px">
      <div><h4>${VSS.escapeHTML(booking.customerName)}</h4><p>${VSS.escapeHTML(
      booking.vehicle.make
    )} ${VSS.escapeHTML(booking.vehicle.model)} · ${VSS.escapeHTML(
      booking.vehicle.number
    )}</p></div>${adminStatusBadge(VSS.statusFor(booking))}
    </div>
    <div class="feature-grid" style="grid-template-columns:repeat(2,1fr)">
      <button class="feature-card" style="text-align:left" data-action="invoice" data-id="${
        booking.id
      }"><div class="feature-icon">₹</div><h3>Create / edit invoice</h3><p>Add parts, labour, discounts and GST.</p></button>
      <button class="feature-card" style="text-align:left" data-action="pickup" data-id="${
        booking.id
      }"><div class="feature-icon">▣</div><h3>Schedule pickup</h3><p>Set collection or home delivery details.</p></button>
      <button class="feature-card" style="text-align:left" data-action="ready" data-id="${
        booking.id
      }"><div class="feature-icon">✓</div><h3>Mark vehicle ready</h3><p>Complete all tasks and notify the customer.</p></button>
      <button class="feature-card" style="text-align:left" data-action="delete" data-id="${
        booking.id
      }"><div class="feature-icon" style="color:var(--red)">×</div><h3>Delete record</h3><p>Available only for completed services.</p></button>
    </div>`,
    true
  );
}

function openInvoiceModal(booking) {
  closeGeneratedModal();
  const invoice = booking.invoice || {
    number: `INV-${Date.now().toString().slice(-6)}`,
    parts: [{ name: "", qty: 1, cost: 0 }],
    labour: 0,
    discount: 0,
    taxRate: 18,
  };
  const modal = createModal(
    `Invoice · ${booking.serviceId}`,
    `<form id="invoiceForm">
      <div class="form-grid">
        <div class="form-group"><label>Invoice number</label><input class="input" name="number" value="${VSS.escapeHTML(
          invoice.number
        )}" required></div>
        <div class="form-group"><label>GST rate (%)</label><input class="input" type="number" name="taxRate" min="0" max="40" step=".1" value="${
          invoice.taxRate
        }" required></div>
      </div>
      <h4 style="margin:22px 0 10px">Replaced spare parts</h4>
      <div id="partsEditor">${(invoice.parts || [])
        .map(partRow)
        .join("")}</div>
      <button class="btn btn-outline btn-sm" type="button" id="addPart">+ Add spare part</button>
      <div class="form-grid" style="margin-top:22px">
        <div class="form-group"><label>Labour charges (₹)</label><input class="input" type="number" name="labour" min="0" value="${
          invoice.labour
        }"></div>
        <div class="form-group"><label>Discount (₹)</label><input class="input" type="number" name="discount" min="0" value="${
          invoice.discount
        }"></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
        <button type="button" class="btn btn-ghost" data-close-generated>Cancel</button>
        <button type="submit" class="btn btn-primary">Save invoice</button>
      </div>
    </form>`,
    false
  );
  modal.querySelector("#addPart").addEventListener("click", () => {
    document
      .getElementById("partsEditor")
      .insertAdjacentHTML("beforeend", partRow({ name: "", qty: 1, cost: 0 }));
  });
  modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-remove-part]")) {
      const rows = modal.querySelectorAll(".part-row");
      if (rows.length > 1) event.target.closest(".part-row").remove();
    }
  });
  modal.querySelector("#invoiceForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const parts = [...form.querySelectorAll(".part-row")]
      .map((row) => ({
        name: row.querySelector("[name=partName]").value.trim(),
        qty: Number(row.querySelector("[name=partQty]").value),
        cost: Number(row.querySelector("[name=partCost]").value),
      }))
      .filter((part) => part.name && part.qty > 0);
    const current = VSS.getBooking(booking.id);
    current.invoice = {
      number: form.number.value.trim(),
      parts,
      labour: Number(form.labour.value),
      discount: Number(form.discount.value),
      taxRate: Number(form.taxRate.value),
      createdAt: current.invoice?.createdAt || new Date().toISOString(),
    };
    current.updates = [
      {
        id: VSS.uid("UPD"),
        message: "Your service invoice is ready to view.",
        type: "info",
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...(current.updates || []),
    ];
    VSS.updateBooking(booking.id, current);
    closeGeneratedModal();
    renderAdminDashboard();
    VSS.toast("Invoice saved successfully.");
  });
}

function partRow(part) {
  return `<div class="part-row">
    <input class="input" name="partName" value="${VSS.escapeHTML(
      part.name || ""
    )}" placeholder="Part name">
    <input class="input" name="partQty" type="number" min="1" value="${Number(
      part.qty || 1
    )}" placeholder="Qty">
    <input class="input" name="partCost" type="number" min="0" value="${Number(
      part.cost || 0
    )}" placeholder="Unit cost">
    <button class="btn btn-ghost btn-sm" type="button" data-remove-part>×</button>
  </div>`;
}

function openPickupModal(booking) {
  closeGeneratedModal();
  const pickup = booking.pickup || {
    date: booking.expectedDate || VSS.dateOffset(2),
    time: "16:00",
    type: "Self Pickup",
    address: "",
    note: "",
  };
  const modal = createModal(
    `Schedule pickup · ${booking.serviceId}`,
    `<form id="pickupForm">
      <div class="form-grid">
        <div class="form-group"><label>Pickup / delivery date</label><input class="input" type="date" name="date" value="${
          pickup.date
        }" required></div>
        <div class="form-group"><label>Time</label><input class="input" type="time" name="time" value="${
          pickup.time
        }" required></div>
        <div class="form-group"><label>Handover method</label><select name="type"><option ${
          pickup.type === "Self Pickup" ? "selected" : ""
        }>Self Pickup</option><option ${
      pickup.type === "Home Delivery" ? "selected" : ""
    }>Home Delivery</option></select></div>
        <div class="form-group"><label>Address (for delivery)</label><input class="input" name="address" value="${VSS.escapeHTML(
          pickup.address || ""
        )}" placeholder="Customer delivery address"></div>
        <div class="form-group full"><label>Handover note</label><textarea name="note" placeholder="Documents or instructions">${VSS.escapeHTML(
          pickup.note || ""
        )}</textarea></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px">
        <button type="button" class="btn btn-ghost" data-close-generated>Cancel</button>
        <button type="submit" class="btn btn-primary">Save schedule</button>
      </div>
    </form>`,
    true
  );
  modal.querySelector("#pickupForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const current = VSS.getBooking(booking.id);
    current.pickup = data;
    current.updates = [
      {
        id: VSS.uid("UPD"),
        message: `${data.type} scheduled for ${VSS.niceDate(data.date)} at ${data.time}.`,
        type: "info",
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...(current.updates || []),
    ];
    VSS.updateBooking(booking.id, current);
    closeGeneratedModal();
    VSS.toast("Pickup schedule saved.");
  });
}

async function markReady(booking) {
  closeGeneratedModal();
  if (
    !(await VSS.confirmAction(
      "This will complete every timeline task and notify the customer.",
      "Mark vehicle ready?"
    ))
  )
    return;
  const current = VSS.getBooking(booking.id);
  current.timeline = current.timeline.map((task) => ({
    ...task,
    completed: true,
    completedAt: task.completedAt || new Date().toISOString(),
  }));
  current.status = "Completed";
  current.updates = [
    {
      id: VSS.uid("UPD"),
      message: "Your vehicle is ready for delivery.",
      type: "success",
      createdAt: new Date().toISOString(),
      read: false,
    },
    ...(current.updates || []),
  ];
  VSS.updateBooking(booking.id, current);
  renderAdminDashboard();
  VSS.toast("Vehicle marked ready for delivery.");
}

async function deleteBooking(booking) {
  closeGeneratedModal();
  if (VSS.statusFor(booking) !== "Completed") {
    VSS.toast("Only completed service records can be deleted.", "error");
    return;
  }
  if (
    !(await VSS.confirmAction(
      `Delete ${booking.serviceId}? This cannot be undone.`,
      "Delete completed record?"
    ))
  )
    return;
  VSS.saveBookings(VSS.getBookings().filter((item) => item.id !== booking.id));
  renderAdminDashboard();
  VSS.toast("Completed record deleted.");
}

function createModal(title, body, small = false) {
  closeGeneratedModal();
  const backdrop = document.createElement("div");
  backdrop.id = "generatedModal";
  backdrop.className = "modal-backdrop open";
  backdrop.innerHTML = `<div class="modal ${small ? "modal-sm" : ""}" role="dialog" aria-modal="true">
    <div class="modal-head"><h3>${VSS.escapeHTML(
      title
    )}</h3><button class="modal-close" data-close-generated aria-label="Close">×</button></div>
    <div class="modal-body">${body}</div>
  </div>`;
  document.body.appendChild(backdrop);
  backdrop.querySelectorAll("[data-close-generated]").forEach((button) => {
    button.addEventListener("click", closeGeneratedModal);
  });
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeGeneratedModal();
  });
  return backdrop;
}

function closeGeneratedModal() {
  document.getElementById("generatedModal")?.remove();
}

function adminStatusBadge(status) {
  const css =
    status === "Completed"
      ? "badge-completed"
      : status === "In Progress"
      ? "badge-progress"
      : "badge-pending";
  return `<span class="badge ${css}">${status}</span>`;
}

function setAdminText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
