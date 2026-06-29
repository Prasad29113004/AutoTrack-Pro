/* Customer dashboard, profile and pickup page controllers. */

document.addEventListener("DOMContentLoaded", () => {
  const protectedPage = document.body.dataset.userPage;
  if (protectedPage && !VSS.requireUser()) return;

  const user = VSS.getUser();
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user?.name?.split(" ")[0] || "Customer";
  });

  if (document.getElementById("dashboardBookings")) renderDashboard();
  if (document.getElementById("profileForm")) initProfile(user);
  if (document.getElementById("pickupContent")) renderPickupPage();
});

function statusBadge(status) {
  const klass =
    status === "Completed"
      ? "badge-completed"
      : status === "In Progress"
      ? "badge-progress"
      : "badge-pending";
  return `<span class="badge ${klass}">${status}</span>`;
}

function renderDashboard() {
  const bookings = VSS.getUserBookings().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const latest = bookings[0];
  const completed = bookings.filter((item) => VSS.statusFor(item) === "Completed").length;
  const inProgress = bookings.filter((item) => VSS.statusFor(item) === "In Progress").length;

  setText("statTotal", bookings.length);
  setText("statProgress", inProgress);
  setText("statComplete", completed);
  setText("statNotifications", bookings.flatMap((item) => item.updates || []).filter((u) => !u.read).length);

  const list = document.getElementById("dashboardBookings");
  if (!bookings.length) {
    list.innerHTML = emptyState("No services booked yet", "Book your first vehicle service to start tracking.", "booking.html");
  } else {
    list.innerHTML = bookings
      .slice(0, 4)
      .map((booking) => {
        const status = VSS.statusFor(booking);
        const percent = VSS.progress(booking);
        return `
          <article class="booking-item">
            <div>
              <h4>${VSS.escapeHTML(booking.vehicle.make)} ${VSS.escapeHTML(booking.vehicle.model)}</h4>
              <p>${VSS.escapeHTML(booking.serviceId)} · ${VSS.escapeHTML(booking.serviceType)}</p>
              <div class="booking-meta">
                <span>◈ ${VSS.escapeHTML(booking.vehicle.number)}</span>
                <span>▣ ${VSS.niceDate(booking.expectedDate)}</span>
                <span>${percent}% complete</span>
              </div>
              <div class="progress-track" style="margin-top:12px"><div class="progress-fill" style="--progress:${percent}%"></div></div>
            </div>
            <div>
              ${statusBadge(status)}
              <a class="btn btn-outline btn-sm" style="margin-top:10px" href="tracking.html?id=${encodeURIComponent(
                booking.serviceId
              )}">Track</a>
            </div>
          </article>`;
      })
      .join("");
  }

  const hero = document.getElementById("activeService");
  if (!latest) {
    hero.innerHTML = emptyState("No active vehicle", "Your latest service summary will appear here.", "booking.html");
  } else {
    const percent = VSS.progress(latest);
    hero.innerHTML = `
      <div class="vehicle-line">
        <div class="vehicle-icon">◆</div>
        <div><h3>${VSS.escapeHTML(latest.vehicle.make)} ${VSS.escapeHTML(
      latest.vehicle.model
    )}</h3><p>${VSS.escapeHTML(latest.vehicle.number)} · ${VSS.escapeHTML(
      latest.serviceId
    )}</p></div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div>
      <div class="progress-meta"><span>${VSS.statusFor(latest)}</span><span>${percent}%</span></div>
      <div class="info-box" style="margin-top:18px"><strong>Estimated completion</strong>${VSS.niceDate(
        latest.expectedDate
      )}</div>
      <a class="btn btn-primary btn-block" style="margin-top:16px" href="tracking.html?id=${encodeURIComponent(
        latest.serviceId
      )}">View live progress →</a>`;
  }

  const notifications = bookings
    .flatMap((booking) =>
      (booking.updates || []).map((update) => ({ ...update, bookingId: booking.id }))
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);
  const notificationList = document.getElementById("notificationList");
  notificationList.innerHTML = notifications.length
    ? notifications
        .map(
          (item) => `<div class="notification ${item.read ? "read" : ""}">
            <p>${VSS.escapeHTML(item.message)}</p>
            <time>${VSS.niceDate(item.createdAt, true)}</time>
          </div>`
        )
        .join("")
    : '<div class="empty-state" style="padding:25px">No notifications yet.</div>';

  document.getElementById("markRead")?.addEventListener("click", () => {
    const all = VSS.getBookings().map((booking) => {
      if (booking.userId !== VSS.getUser().id) return booking;
      booking.updates = (booking.updates || []).map((update) => ({ ...update, read: true }));
      return booking;
    });
    VSS.saveBookings(all);
    VSS.toast("Notifications marked as read.");
    renderDashboard();
  });
}

function initProfile(user) {
  const form = document.getElementById("profileForm");
  ["name", "email", "phone", "address"].forEach((field) => {
    form[field].value = user[field] || "";
  });
  document.getElementById("profileInitials").textContent = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  document.getElementById("profileName").textContent = user.name;
  document.getElementById("profileSince").textContent = `Member since ${VSS.niceDate(
    user.createdAt
  )}`;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const users = VSS.getUsers();
    const index = users.findIndex((item) => item.id === user.id);
    if (index === -1) return;
    const data = Object.fromEntries(new FormData(form));
    users[index] = {
      ...users[index],
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address.trim(),
    };
    VSS.saveUsers(users);
    VSS.toast("Profile updated successfully.");
    setTimeout(() => location.reload(), 500);
  });

  document.getElementById("passwordForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const passwordForm = event.currentTarget;
    if (passwordForm.currentPassword.value !== user.password) {
      VSS.toast("Current password is incorrect.", "error");
      return;
    }
    if (passwordForm.newPassword.value.length < 6) {
      VSS.toast("New password must be at least 6 characters.", "error");
      return;
    }
    const users = VSS.getUsers();
    const index = users.findIndex((item) => item.id === user.id);
    users[index].password = passwordForm.newPassword.value;
    VSS.saveUsers(users);
    passwordForm.reset();
    VSS.toast("Password changed successfully.");
  });
}

function renderPickupPage() {
  const root = document.getElementById("pickupContent");
  const bookings = VSS.getUserBookings().filter((booking) => booking.pickup);
  if (!bookings.length) {
    root.innerHTML = emptyState(
      "Pickup not scheduled",
      "Your service advisor will schedule pickup or delivery here.",
      "dashboard.html"
    );
    return;
  }

  root.innerHTML = bookings
    .map(
      (booking) => `<article class="card" style="margin-bottom:18px">
        <div class="card-header"><div><h3>${VSS.escapeHTML(booking.vehicle.make)} ${VSS.escapeHTML(
        booking.vehicle.model
      )}</h3><span class="muted" style="font-size:.78rem">${VSS.escapeHTML(
        booking.serviceId
      )}</span></div>${statusBadge(VSS.statusFor(booking))}</div>
        <div class="card-body">
          <div class="tracking-summary" style="margin:0">
            <div class="summary-cell"><span>Date</span><strong>${VSS.niceDate(
              booking.pickup.date
            )}</strong></div>
            <div class="summary-cell"><span>Time</span><strong>${VSS.escapeHTML(
              booking.pickup.time
            )}</strong></div>
            <div class="summary-cell"><span>Method</span><strong>${VSS.escapeHTML(
              booking.pickup.type
            )}</strong></div>
            <div class="summary-cell"><span>Contact</span><strong>${VSS.escapeHTML(
              booking.phone
            )}</strong></div>
          </div>
          ${
            booking.pickup.address
              ? `<div class="info-box" style="margin-top:16px"><strong>Delivery address</strong>${VSS.escapeHTML(
                  booking.pickup.address
                )}</div>`
              : ""
          }
          ${
            booking.pickup.note
              ? `<p class="muted" style="margin:14px 0 0">Note: ${VSS.escapeHTML(
                  booking.pickup.note
                )}</p>`
              : ""
          }
        </div>
      </article>`
    )
    .join("");
}

function emptyState(title, text, href) {
  return `<div class="empty-state"><div class="empty-icon">◇</div><h3>${title}</h3><p>${text}</p>${
    href ? `<a class="btn btn-primary btn-sm" href="${href}">Continue</a>` : ""
  }</div>`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
