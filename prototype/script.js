const DEMO_EMAIL = 'demo@agencyflow.com';
const DEMO_PASSWORD = 'demo123';

const form = document.getElementById('signin-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const btnSpinner = submitBtn.querySelector('.btn-spinner');
const forgotBtn = document.getElementById('forgot-btn');
const toast = document.getElementById('toast');

if (localStorage.getItem('agencyflow_session')) {
  window.location.href = 'dashboard.html';
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3000);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnText.hidden = loading;
  btnSpinner.hidden = !loading;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function clearErrors() {
  emailError.textContent = '';
  passwordError.textContent = '';
  emailInput.classList.remove('invalid');
  passwordInput.classList.remove('invalid');
}

forgotBtn.addEventListener('click', () => {
  showToast('Password reset link sent to your email (demo).');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let valid = true;

  if (!email) {
    emailError.textContent = 'Email is required.';
    emailInput.classList.add('invalid');
    valid = false;
  } else if (!validateEmail(email)) {
    emailError.textContent = 'Enter a valid email address.';
    emailInput.classList.add('invalid');
    valid = false;
  }

  if (!password) {
    passwordError.textContent = 'Password is required.';
    passwordInput.classList.add('invalid');
    valid = false;
  } else if (password.length < 6) {
    passwordError.textContent = 'Password must be at least 6 characters.';
    passwordInput.classList.add('invalid');
    valid = false;
  }

  if (!valid) return;

  setLoading(true);
  await new Promise((resolve) => setTimeout(resolve, 800));

  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    localStorage.setItem('agencyflow_session', JSON.stringify({
      email,
      name: 'Demo User',
      signedInAt: new Date().toISOString(),
    }));
    window.location.href = 'dashboard.html';
    return;
  }

  setLoading(false);
  showToast('Invalid email or password.', true);
});
