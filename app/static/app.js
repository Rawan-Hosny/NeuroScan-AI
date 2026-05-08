document.addEventListener('DOMContentLoaded', () => {
    let currentTab = 'signin';

    // Toast Notification System
    window.showToast = function(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-box ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    };

    // Tab Switching
    window.switchTab = function(tab) {
        currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        if (tab === 'signin') {
            document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
            document.getElementById('signin-form').classList.add('active');
            document.getElementById('auth-subtitle').textContent = 'Welcome back, Doctor';
        } else {
            document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
            document.getElementById('signup-form').classList.add('active');
            document.getElementById('auth-subtitle').textContent = 'Join the clinical network';
        }
    };

    // Password Visibility
    window.togglePassword = function(inputId) {
        const input = document.getElementById(inputId);
        const icon = input.nextElementSibling.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
    };

    // Password Match Validation
    const signupPass = document.getElementById('signup-password');
    const signupConfirm = document.getElementById('signup-confirm');
    const signupBtn = document.getElementById('signup-btn');
    const confirmError = document.getElementById('confirm-error');

    function validatePasswords() {
        if (!signupConfirm.value) {
            confirmError.style.display = 'none';
            signupBtn.disabled = false;
        } else if (signupPass.value !== signupConfirm.value) {
            confirmError.style.display = 'block';
            signupBtn.disabled = true;
        } else {
            confirmError.style.display = 'none';
            signupBtn.disabled = false;
        }
    }

    if (signupPass) signupPass.addEventListener('input', validatePasswords);
    if (signupConfirm) signupConfirm.addEventListener('input', validatePasswords);

    const signupEmailInput = document.getElementById('signup-email');
    if (signupEmailInput) {
        signupEmailInput.addEventListener('input', () => {
            const emailErr = document.getElementById('signup-email-error');
            if (emailErr) emailErr.style.display = 'none';
        });
    }

    // Reset Password Match Validation
    const resetPass = document.getElementById('new-password');
    const resetConfirm = document.getElementById('confirm-new-password');
    const resetBtn = document.getElementById('reset-final-btn');
    const resetConfirmError = document.getElementById('reset-confirm-error');

    function validateResetPasswords() {
        if (!resetConfirm.value) {
            resetConfirmError.style.display = 'none';
            resetBtn.disabled = false;
        } else if (resetPass.value !== resetConfirm.value) {
            resetConfirmError.style.display = 'block';
            resetBtn.disabled = true;
        } else {
            resetConfirmError.style.display = 'none';
            resetBtn.disabled = false;
        }
    }

    if (resetPass) resetPass.addEventListener('input', validateResetPasswords);
    if (resetConfirm) resetConfirm.addEventListener('input', validateResetPasswords);

    // Form Submission
    async function handleFormSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const btn = form.querySelector('.submit-btn');
        const btnText = btn.querySelector('.btn-text');
        const loader = btn.querySelector('.loader');

        btnText.style.display = 'none';
        loader.style.display = 'block';
        btn.disabled = true;

        try {
            const isSignin = form.id === 'signin-form';
            const url = isSignin ? 'auth/login' : 'auth/signup';
            const payload = isSignin ? {
                email: document.getElementById('signin-email').value,
                password: document.getElementById('signin-password').value
            } : {
                full_name: document.getElementById('signup-name').value,
                email: document.getElementById('signup-email').value,
                password: document.getElementById('signup-password').value
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('medaccess_token', data.access_token);
                window.location.href = 'exam.html'; 
            } else {
                let errorMessage = 'Error: Please check your data';
                if (data.detail) {
                    if (typeof data.detail === 'string') {
                        errorMessage = data.detail;
                    } else if (Array.isArray(data.detail)) {
                        errorMessage = data.detail.map(err => err.msg || JSON.stringify(err)).join('\n');
                    } else {
                        errorMessage = JSON.stringify(data.detail);
                    }
                }

                const emailError = document.getElementById('signup-email-error');
                if (emailError) emailError.style.display = 'none';

                if (!isSignin && errorMessage.toLowerCase().includes('already exists')) {
                    if (emailError) {
                        emailError.textContent = 'This email is already registered';
                        emailError.style.display = 'block';
                    } else {
                        showToast('This email is already registered', 'error');
                    }
                } else {
                    showToast(errorMessage, 'error');
                }
            }
        } catch (err) {
            showToast('Connection failed. Is the server running?', 'error');
        } finally {
            btnText.style.display = 'block';
            loader.style.display = 'none';
            btn.disabled = false;
        }
    }

    document.getElementById('signin-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('signup-form').addEventListener('submit', handleFormSubmit);

    // Forgot Password Flow
    window.showForgotPassword = function() {
        document.getElementById('auth-main-content').style.display = 'none';
        document.getElementById('forgot-password-section').style.display = 'block';
        document.getElementById('auth-subtitle').textContent = 'Reset your credentials';
    };

    window.hideForgotPassword = function() {
        document.getElementById('auth-main-content').style.display = 'block';
        document.getElementById('forgot-password-section').style.display = 'none';
        switchTab(currentTab);
    };

    window.verifyResetEmail = async function() {
        const emailInput = document.getElementById('reset-email');
        if (!emailInput.reportValidity()) return;
        const email = emailInput.value;

        try {
            const response = await fetch('auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                document.getElementById('reset-step-1').style.display = 'none';
                document.getElementById('reset-step-2').style.display = 'block';
            } else {
                showToast('Email not found', 'error');
            }
        } catch (err) { showToast('Server error', 'error'); }
    };

    window.updatePassword = async function() {
        const passwordInput = document.getElementById('new-password');
        const confirmInput = document.getElementById('confirm-new-password');
        
        if (!passwordInput.reportValidity() || !confirmInput.reportValidity()) {
            return;
        }

        const email = document.getElementById('reset-email').value;
        const password = passwordInput.value;
        const confirm = confirmInput.value;

        if (password !== confirm) return alert('Passwords do not match');

        try {
            const response = await fetch('auth/reset-password-final', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (response.ok) {
                showToast('Password updated!', 'success');
                hideForgotPassword();
            } else { showToast('Failed to update', 'error'); }
        } catch (err) { showToast('Server error', 'error'); }
    };

    // Theme Toggle Logic
    const btnTheme = document.getElementById('toggle-theme');
    const initTheme = () => {
        const savedTheme = localStorage.getItem('medaccess_theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            updateThemeIcon(true);
        }

        if (btnTheme) {
            btnTheme.onclick = () => {
                const isDark = document.body.classList.toggle('dark-mode');
                localStorage.setItem('medaccess_theme', isDark ? 'dark' : 'light');
                updateThemeIcon(isDark);
            };
        }
    };

    const updateThemeIcon = (isDark) => {
        if (!btnTheme) return;
        const icon = btnTheme.querySelector('i');
        if (isDark) {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    };

    initTheme();
});
