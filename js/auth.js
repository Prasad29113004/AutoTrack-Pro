/* Customer registration, login, password reset simulation and logout. */

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "◉" : "⊘";
    });
  });

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors(loginForm);
    const email = loginForm.email.value.trim().toLowerCase();
    const password = loginForm.password.value;
    const user = VSS.getUsers().find(
      (item) => item.email.toLowerCase() === email && item.password === password
    );

    if (!user) {
      showError(loginForm.email, "Email or password is incorrect.");
      VSS.toast("Could not sign in. Please check your details.", "error");
      return;
    }

    const button = loginForm.querySelector("[type=submit]");
    setLoading(button, true, "Signing in...");
    VSS.write(VSS.KEYS.session, { userId: user.id, loginAt: new Date().toISOString() });
    setTimeout(() => {
      const redirect = new URLSearchParams(location.search).get("redirect");
      location.href = redirect || "dashboard.html";
    }, 650);
  });

  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearErrors(registerForm);
    const data = Object.fromEntries(new FormData(registerForm));
    let valid = true;

    if (data.name.trim().length < 3) {
      showError(registerForm.name, "Enter your full name.");
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      showError(registerForm.email, "Enter a valid email address.");
      valid = false;
    }
    if (!/^[6-9]\d{9}$/.test(data.phone)) {
      showError(registerForm.phone, "Enter a valid 10-digit mobile number.");
      valid = false;
    }
    if (data.password.length < 6) {
      showError(registerForm.password, "Use at least 6 characters.");
      valid = false;
    }
    if (data.password !== data.confirmPassword) {
      showError(registerForm.confirmPassword, "Passwords do not match.");
      valid = false;
    }
    if (!registerForm.terms.checked) {
      VSS.toast("Please accept the terms to continue.", "error");
      valid = false;
    }

    const users = VSS.getUsers();
    if (users.some((user) => user.email.toLowerCase() === data.email.toLowerCase())) {
      showError(registerForm.email, "An account with this email already exists.");
      valid = false;
    }
    if (!valid) return;

    const user = {
      id: VSS.uid("USR"),
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      address: "",
      password: data.password,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    VSS.saveUsers(users);
    VSS.write(VSS.KEYS.session, { userId: user.id, loginAt: new Date().toISOString() });

    const button = registerForm.querySelector("[type=submit]");
    setLoading(button, true, "Creating account...");
    setTimeout(() => {
      VSS.toast("Account created successfully.");
      location.href = "dashboard.html";
    }, 650);
  });

  document.getElementById("forgotLink")?.addEventListener("click", (event) => {
    event.preventDefault();
    document.getElementById("forgotModal")?.classList.add("open");
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.closeModal)?.classList.remove("open");
    });
  });

  const forgotForm = document.getElementById("forgotForm");
  forgotForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = forgotForm.email.value.trim().toLowerCase();
    const exists = VSS.getUsers().some((user) => user.email.toLowerCase() === email);
    if (!exists) {
      VSS.toast("No account was found for that email.", "error");
      return;
    }
    forgotForm.reset();
    document.getElementById("forgotModal").classList.remove("open");
    VSS.toast("Reset link simulated successfully. Check your inbox.");
  });
});

function showError(input, message) {
  input.classList.add("error");
  const error = document.createElement("small");
  error.className = "field-error";
  error.textContent = message;
  input.closest(".form-group")?.appendChild(error);
}

function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((element) => element.remove());
  form.querySelectorAll(".error").forEach((element) => element.classList.remove("error"));
}

function setLoading(button, loading, label) {
  if (!button) return;
  if (!button.dataset.label) button.dataset.label = button.innerHTML;
  button.disabled = loading;
  button.innerHTML = loading ? `<span class="loader"></span>${label}` : button.dataset.label;
}
