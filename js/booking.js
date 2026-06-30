/* Vehicle service booking form and Service ID generation. */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("bookingForm") || !VSS.requireUser()) return;
  const form = document.getElementById("bookingForm");
  const user = VSS.getUser();

  form.customerName.value = user.name;
  form.email.value = user.email;
  form.phone.value = user.phone;
  form.preferredDate.min = new Date().toISOString().slice(0, 10);
  form.preferredDate.value = VSS.dateOffset(1);

  const serviceSelect = form.serviceType;
  Object.entries(VSS.SERVICES).forEach(([name, price]) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} — from ${VSS.money(price)}`;
    serviceSelect.appendChild(option);
  });

  serviceSelect.addEventListener("change", updateEstimate);
  form.fuel.addEventListener("change", updateEstimate);
  updateEstimate();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = Object.fromEntries(new FormData(form));
    const id = VSS.serviceId();
    const booking = {
      id: VSS.uid("BKG"),
      serviceId: id,
      userId: user.id,
      customerName: data.customerName.trim(),
      email: data.email.trim(),
      phone: data.phone.trim(),
      vehicle: {
        make: data.make.trim(),
        model: data.model.trim(),
        number: data.vehicleNumber.trim().toUpperCase(),
        fuel: data.fuel,
        year: data.year,
      },
      serviceType: data.serviceType,
      preferredDate: data.preferredDate,
      notes: data.notes.trim(),
      createdAt: new Date().toISOString(),
      expectedDate: VSS.dateOffset(3),
      status: "Pending",
      timeline: VSS.SERVICE_TASKS.map((title) => ({
        id: VSS.uid("TSK"),
        title,
        completed: false,
        completedAt: null,
        note: "",
        mechanic: "",
        images: [],
      })),
      updates: [
        {
          id: VSS.uid("UPD"),
          message: `Booking confirmed. Your Service ID is ${id}.`,
          type: "success",
          createdAt: new Date().toISOString(),
          read: false,
        },
      ],
      invoice: null,
      pickup: null,
    };

    const confirmed = await VSS.confirmAction(
      `Book ${data.serviceType} for ${booking.vehicle.number} on ${VSS.niceDate(
        data.preferredDate
      )}?`,
      "Confirm booking"
    );
    if (!confirmed) return;

    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    button.innerHTML = '<span class="loader"></span> Creating booking...';
    const bookings = VSS.getBookings();
    bookings.push(booking);
    VSS.saveBookings(bookings);
    setTimeout(() => showSuccess(booking), 600);
  });

  function updateEstimate() {
    const price = VSS.SERVICES[serviceSelect.value] || 0;
    document.getElementById("serviceEstimate").textContent = price
      ? `${VSS.money(price)} onwards`
      : "Select a service";
    document.getElementById("completionEstimate").textContent = serviceSelect.value
      ? "2–3 business days"
      : "To be calculated";
  }
});

function showSuccess(booking) {
  const formCard = document.getElementById("bookingCard");
  formCard.innerHTML = `
    <div class="empty-state" style="padding:54px 24px">
      <div class="empty-icon" style="background:#dcfce7;color:#16a34a">✓</div>
      <h2>Service booked successfully</h2>
      <p>Save your unique Service ID to track every update.</p>
      <div class="info-box" style="max-width:420px;margin:20px auto;font-size:1.05rem;text-align:left">
        <strong>Service ID</strong>${VSS.escapeHTML(booking.serviceId)}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-primary" href="tracking.html?id=${encodeURIComponent(
          booking.serviceId
        )}">Track service</a>
        <a class="btn btn-outline" href="dashboard.html">Go to dashboard</a>
      </div>
    </div>`;
  VSS.toast("Booking created successfully.");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
