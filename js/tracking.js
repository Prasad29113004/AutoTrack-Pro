/* Live service progress search, visual timeline and uploaded image gallery. */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("trackingResult") || !VSS.requireUser()) return;
  const input = document.getElementById("serviceIdInput");
  const form = document.getElementById("trackingForm");
  const requested = new URLSearchParams(location.search).get("id");
  const latest = VSS.getUserBookings().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )[0];

  input.value = requested || latest?.serviceId || "";
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    renderTracking(input.value);
  });
  if (input.value) renderTracking(input.value);
  else showTrackingEmpty("Enter your Service ID above to see live progress.");

  window.addEventListener("storage", () => input.value && renderTracking(input.value));
  window.addEventListener("vss:datachange", () => input.value && renderTracking(input.value));
});

function renderTracking(serviceId) {
  const root = document.getElementById("trackingResult");
  const booking = VSS.getBooking(serviceId.trim());
  const user = VSS.getUser();
  if (!booking || booking.userId !== user.id) {
    root.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">!</div><h3>Service not found</h3><p>Check the Service ID and try again.</p></div></div>`;
    return;
  }

  const percent = VSS.progress(booking);
  const nextIndex = booking.timeline.findIndex((task) => !task.completed);
  const images = booking.timeline.flatMap((task) =>
    (task.images || []).map((src) => ({ src, title: task.title }))
  );

  root.innerHTML = `
    <div class="tracking-summary">
      <div class="summary-cell"><span>Service ID</span><strong>${VSS.escapeHTML(
        booking.serviceId
      )}</strong></div>
      <div class="summary-cell"><span>Vehicle</span><strong>${VSS.escapeHTML(
        booking.vehicle.make
      )} ${VSS.escapeHTML(booking.vehicle.model)}</strong></div>
      <div class="summary-cell"><span>Registration</span><strong>${VSS.escapeHTML(
        booking.vehicle.number
      )}</strong></div>
      <div class="summary-cell"><span>Expected delivery</span><strong>${VSS.niceDate(
        booking.expectedDate
      )}</strong></div>
    </div>
    <div class="dashboard-grid" style="margin-top:0">
      <section class="card">
        <div class="card-header"><h2>Service timeline</h2>${customerStatusBadge(
          VSS.statusFor(booking)
        )}</div>
        <div class="card-body">
          <div class="progress-track"><div class="progress-fill" style="--progress:${percent}%"></div></div>
          <div class="progress-meta" style="margin-bottom:28px"><span>${percent}% completed</span><span>${
    booking.timeline.filter((task) => task.completed).length
  } of ${booking.timeline.length} tasks</span></div>
          <div class="timeline-wrap">
            ${booking.timeline
              .map(
                (task, index) => `
                <div class="timeline-item ${task.completed ? "done" : index === nextIndex ? "active" : ""}">
                  <span class="timeline-dot">${task.completed ? "✓" : index + 1}</span>
                  <div class="timeline-content">
                    <h4>${VSS.escapeHTML(task.title)}</h4>
                    <p>${VSS.escapeHTML(
                      task.note ||
                        (task.completed
                          ? "Task completed successfully."
                          : index === nextIndex
                          ? "Currently scheduled or in progress."
                          : "Pending previous service tasks.")
                    )}</p>
                    ${
                      task.completedAt
                        ? `<time>Completed ${VSS.niceDate(task.completedAt, true)}</time>`
                        : ""
                    }
                  </div>
                  ${task.completed ? '<span class="badge badge-completed">Completed</span>' : ""}
                </div>`
              )
              .join("")}
          </div>
        </div>
      </section>
      <aside>
        <div class="card">
          <div class="card-header"><h3>Service overview</h3></div>
          <div class="card-body">
            <div class="vehicle-line"><div class="vehicle-icon">◆</div><div><h3>${VSS.escapeHTML(
              booking.serviceType
            )}</h3><p>Booked ${VSS.niceDate(booking.createdAt)}</p></div></div>
            <div class="info-box"><strong>Current status</strong>${
              nextIndex === -1 ? "Ready for delivery" : VSS.escapeHTML(booking.timeline[nextIndex].title)
            }</div>
            <a class="btn btn-outline btn-block" style="margin-top:12px" href="billing.html?id=${encodeURIComponent(
              booking.serviceId
            )}">View invoice</a>
          </div>
        </div>
      </aside>
    </div>
    <section class="card" style="margin-top:22px">
      <div class="card-header"><h2>Service image gallery</h2><span class="muted" style="font-size:.78rem">${
        images.length
      } image${images.length === 1 ? "" : "s"}</span></div>
      <div class="card-body">
        ${
          images.length
            ? `<div class="gallery">${images
                .map(
                  (image) => `<figure class="gallery-item"><img src="${image.src}" alt="${VSS.escapeHTML(
                    image.title
                  )}"><span>${VSS.escapeHTML(image.title)}</span></figure>`
                )
                .join("")}</div>`
            : '<div class="empty-state" style="padding:28px"><div class="empty-icon">▧</div><h3>No service photos yet</h3><p>Photos uploaded by the service center will appear here.</p></div>'
        }
      </div>
    </section>`;
}

function showTrackingEmpty(message) {
  document.getElementById("trackingResult").innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">⌕</div><h3>Track your service</h3><p>${message}</p></div></div>`;
}

function customerStatusBadge(status) {
  const css =
    status === "Completed"
      ? "badge-completed"
      : status === "In Progress"
      ? "badge-progress"
      : "badge-pending";
  return `<span class="badge ${css}">${status}</span>`;
}
