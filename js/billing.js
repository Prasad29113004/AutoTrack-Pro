/* Customer invoice selection, calculation and browser-print PDF export. */

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("invoiceRoot") || !VSS.requireUser()) return;
  const select = document.getElementById("invoiceSelect");
  const bookings = VSS.getUserBookings();
  bookings.forEach((booking) => {
    const option = document.createElement("option");
    option.value = booking.serviceId;
    option.textContent = `${booking.serviceId} — ${booking.vehicle.make} ${booking.vehicle.model}`;
    select.appendChild(option);
  });

  const requested = new URLSearchParams(location.search).get("id");
  select.value = requested || bookings[0]?.serviceId || "";
  select.addEventListener("change", () => renderInvoice(select.value));
  document.getElementById("printInvoice")?.addEventListener("click", () => window.print());
  renderInvoice(select.value);
});

function renderInvoice(serviceId) {
  const root = document.getElementById("invoiceRoot");
  const booking = VSS.getBooking(serviceId);
  const user = VSS.getUser();
  if (!booking || booking.userId !== user.id) {
    root.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">▤</div><h3>No invoice selected</h3><p>Choose a service above to view billing details.</p></div></div>`;
    return;
  }
  if (!booking.invoice) {
    root.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-icon">⌛</div><h3>Invoice is being prepared</h3><p>The service center has not created the final invoice for this booking yet.</p></div></div>`;
    return;
  }

  const invoice = booking.invoice;
  const totals = VSS.invoiceTotals(invoice);
  root.innerHTML = `
    <article class="invoice">
      <header class="invoice-head">
        <div><div class="brand" style="color:var(--text)"><span class="brand-mark">A</span>AutoTrack <span>Pro</span></div>
        <p class="muted" style="margin:10px 0 0">Premium Vehicle Service Centre</p></div>
        <div class="invoice-meta"><h2 class="invoice-title">INVOICE</h2><strong>${VSS.escapeHTML(
          invoice.number
        )}</strong><div class="muted">${VSS.niceDate(invoice.createdAt)}</div></div>
      </header>
      <div class="invoice-parties">
        <div><h4>Bill to</h4><p><strong>${VSS.escapeHTML(
          booking.customerName
        )}</strong><br>${VSS.escapeHTML(booking.email)}<br>${VSS.escapeHTML(
    booking.phone
  )}</p></div>
        <div><h4>Vehicle details</h4><p><strong>${VSS.escapeHTML(
          booking.vehicle.make
        )} ${VSS.escapeHTML(booking.vehicle.model)}</strong><br>${VSS.escapeHTML(
    booking.vehicle.number
  )}<br>Service ID: ${VSS.escapeHTML(booking.serviceId)}</p></div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Cost</th><th>Amount</th></tr></thead>
          <tbody>
            ${(invoice.parts || [])
              .map(
                (part) => `<tr><td>${VSS.escapeHTML(part.name)}</td><td>${Number(
                  part.qty
                )}</td><td>${VSS.money(part.cost)}</td><td>${VSS.money(
                  Number(part.qty) * Number(part.cost)
                )}</td></tr>`
              )
              .join("")}
            <tr><td>Service labour charges</td><td>1</td><td>${VSS.money(
              totals.labour
            )}</td><td>${VSS.money(totals.labour)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="invoice-totals">
        <div class="total-line"><span>Parts total</span><strong>${VSS.money(
          totals.parts
        )}</strong></div>
        <div class="total-line"><span>Labour</span><strong>${VSS.money(
          totals.labour
        )}</strong></div>
        <div class="total-line"><span>Discount</span><strong>− ${VSS.money(
          totals.discount
        )}</strong></div>
        <div class="total-line"><span>GST (${Number(
          invoice.taxRate
        )}%)</span><strong>${VSS.money(totals.tax)}</strong></div>
        <div class="total-line grand"><span>Total due</span><span>${VSS.money(
          totals.total
        )}</span></div>
      </div>
      <div class="info-box" style="margin-top:30px"><strong>Thank you for choosing AutoTrack Pro.</strong>This is a computer-generated invoice and does not require a signature.</div>
    </article>`;
}
