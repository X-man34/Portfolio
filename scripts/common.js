// common.js

document.addEventListener("DOMContentLoaded", function () {
  // Set your name, email, and phone
  const myName = "Caleb Hottes";
  const email = "caleb.hottes@gmail.com";
  const phone = "253-402-8291";

  // Replace content in all elements with these classes
  document.querySelectorAll('.my-name').forEach(el => el.textContent = myName);
  document.querySelectorAll('.my-email').forEach(el => el.textContent = email);
  document.querySelectorAll('.my-phone').forEach(el => el.textContent = phone);
  document.querySelectorAll('.email-link').forEach(el => el.href = `mailto:${email}`);
  document.querySelectorAll('.year').forEach(el => el.textContent = new Date().getFullYear());

  // Optionally update the page title
  document.title = "My Portfolio - " + myName;

  // Load shared navbar
  const navbar = document.getElementById("navbar-placeholder");
  if (navbar) {
    fetch('nav.html')  // adjust path if file is in a subfolder (e.g., '../nav.html')
      .then(res => res.text())
      .then(html => navbar.innerHTML = html);
  }
});
