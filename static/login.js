/**
 * SOLEPOWER - Telemetry Authentication Portal Client Logic
 * Handles 2 primary modes:
 * 1. Login (Email/Gmail & Password, Google Sign-In, 1-Click Demo Presets)
 * 2. Create a New Account (Name, Gmail, Password, Sex: Male / Female)
 */

document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'signin'; // 'signin' or 'register'
    let selectedGender = 'Male'; // 'Male' or 'Female'

    // Check if user is already logged in; redirect unless relogin requested
    const urlParams = new URLSearchParams(window.location.search);
    const forceRelogin = urlParams.get('relogin');
    const requestedMode = urlParams.get('mode');
    const existingUser = localStorage.getItem('solepower_user');

    if (existingUser && !forceRelogin) {
        window.location.href = '/dashboard';
        return;
    }

    // DOM Selectors
    const tabBtnSignin       = document.getElementById('tab-btn-signin');
    const tabBtnRegister     = document.getElementById('tab-btn-register');
    const portalSubtitle     = document.getElementById('portal-subtitle');
    const sectionGoogleAuth  = document.getElementById('section-google-auth');
    const groupName          = document.getElementById('group-name');
    const labelEmail         = document.getElementById('label-email');
    const inputName          = document.getElementById('input-name');
    const inputEmail         = document.getElementById('input-email');
    const inputPassword      = document.getElementById('input-password');
    const btnTogglePass      = document.getElementById('btn-toggle-pass');
    const groupGender        = document.getElementById('group-gender');
    const optGenderMale      = document.getElementById('opt-gender-male');
    const optGenderFemale    = document.getElementById('opt-gender-female');
    const rowLoginOptions    = document.getElementById('row-login-options');
    const sectionDemoPresets = document.getElementById('section-demo-presets');
    const authForm           = document.getElementById('auth-form');
    const btnSubmitAuth      = document.getElementById('btn-submit-auth');
    const btnSubmitText      = document.getElementById('btn-submit-text');
    const authAlert          = document.getElementById('auth-alert');

    // Google Modal Selectors
    const btnGoogleLogin     = document.getElementById('btn-google-login');
    const googleModal        = document.getElementById('google-modal');
    const btnCloseGoogle     = document.getElementById('btn-close-google-modal');
    const btnCustomGoogle    = document.getElementById('btn-custom-google');
    const demoPillBtns       = document.querySelectorAll('.demo-pill-btn');

    // ============================================================
    // 1. TAB SWITCHING: LOGIN vs CREATE A NEW ACCOUNT
    // ============================================================
    function setMode(mode) {
        currentMode = mode;
        hideAlert();

        if (mode === 'register') {
            // "Create a New Account" Mode
            tabBtnRegister.classList.add('active');
            tabBtnSignin.classList.remove('active');

            if (portalSubtitle) {
                portalSubtitle.textContent = 'Create Your Telemetry Researcher Account';
            }

            // Show required registration fields: Name & Sex (Gender)
            if (groupName) groupName.style.display = 'block';
            if (groupGender) groupGender.style.display = 'block';
            if (inputName) inputName.setAttribute('required', 'true');

            // Set Email placeholder & label to emphasize Gmail / Email
            if (labelEmail) labelEmail.textContent = 'Gmail / Email Address';
            if (inputEmail) inputEmail.placeholder = 'e.g. yourname@gmail.com';

            // Hide login-only sections (Google auth & demo presets) for clean registration experience
            if (sectionGoogleAuth) sectionGoogleAuth.style.display = 'none';
            if (rowLoginOptions) rowLoginOptions.style.display = 'none';
            if (sectionDemoPresets) sectionDemoPresets.style.display = 'none';

            btnSubmitText.textContent = 'Create Account & Enter Dashboard';
        } else {
            // "Login" Mode
            tabBtnSignin.classList.add('active');
            tabBtnRegister.classList.remove('active');

            if (portalSubtitle) {
                portalSubtitle.textContent = 'IoT Footwear Energy Harvesting Telemetry Hub';
            }

            // Hide registration-only fields
            if (groupName) groupName.style.display = 'none';
            if (groupGender) groupGender.style.display = 'none';
            if (inputName) inputName.removeAttribute('required');

            // Reset Email label
            if (labelEmail) labelEmail.textContent = 'Gmail / Email ID';
            if (inputEmail) inputEmail.placeholder = 'e.g. kartik@solepower.iot';

            // Show login accessories
            if (sectionGoogleAuth) sectionGoogleAuth.style.display = 'block';
            if (rowLoginOptions) rowLoginOptions.style.display = 'flex';
            if (sectionDemoPresets) sectionDemoPresets.style.display = 'block';

            btnSubmitText.textContent = 'Login to Telemetry Hub';
        }
    }

    if (tabBtnSignin) {
        tabBtnSignin.addEventListener('click', () => setMode('signin'));
    }
    if (tabBtnRegister) {
        tabBtnRegister.addEventListener('click', () => setMode('register'));
    }

    // Check if URL specified ?mode=register
    if (requestedMode === 'register') {
        setMode('register');
    }

    // ============================================================
    // 2. SEX / GENDER SELECTOR (Male / Female)
    // ============================================================
    function selectGender(gender) {
        selectedGender = gender;
        if (gender === 'Male') {
            optGenderMale.classList.add('active-male');
            optGenderFemale.classList.remove('active-female');
        } else {
            optGenderFemale.classList.add('active-female');
            optGenderMale.classList.remove('active-male');
        }
    }

    if (optGenderMale) {
        optGenderMale.addEventListener('click', () => selectGender('Male'));
    }
    if (optGenderFemale) {
        optGenderFemale.addEventListener('click', () => selectGender('Female'));
    }

    // ============================================================
    // 3. PASSWORD VISIBILITY TOGGLE (Show/Hide Eye)
    // ============================================================
    if (btnTogglePass && inputPassword) {
        btnTogglePass.addEventListener('click', () => {
            const isPassword = inputPassword.type === 'password';
            inputPassword.type = isPassword ? 'text' : 'password';
            btnTogglePass.classList.toggle('fa-eye', !isPassword);
            btnTogglePass.classList.toggle('fa-eye-slash', isPassword);
        });
    }

    // ============================================================
    // 4. 1-CLICK DEMO LOGIN PRESETS (Evaluator, Kartik, Gargi)
    // ============================================================
    demoPillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const email = btn.getAttribute('data-email');
            const pass = btn.getAttribute('data-pass');
            if (currentMode !== 'signin') {
                setMode('signin');
            }
            inputEmail.value = email;
            inputPassword.value = pass;
            showAlert(`Autofilled credentials for ${email}. Authenticating...`, 'success');
            setTimeout(() => {
                authForm.dispatchEvent(new Event('submit'));
            }, 300);
        });
    });

    // ============================================================
    // 5. FORM SUBMISSION (LOGIN vs REGISTER)
    // ============================================================
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideAlert();

        const email = inputEmail.value.trim();
        const password = inputPassword.value;

        if (!email || !password) {
            showAlert('Please provide both Gmail/Email and Password.', 'error');
            return;
        }

        if (currentMode === 'register') {
            // Registration mode validation
            const name = inputName.value.trim();
            if (!name) {
                showAlert('Please enter your full name.', 'error');
                inputName.focus();
                return;
            }

            btnSubmitText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...`;
            btnSubmitAuth.disabled = true;

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        password: password,
                        gender: selectedGender,
                        device_uid: 'SOLEPOWER-01',
                        role: 'Student Researcher'
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.detail || 'Registration failed. Please try again.');
                }

                showAlert(`Account created successfully as ${selectedGender}! Launching dashboard...`, 'success');
                saveSessionAndRedirect(data);
            } catch (err) {
                showAlert(err.message, 'error');
                btnSubmitText.textContent = 'Create Account & Enter Dashboard';
                btnSubmitAuth.disabled = false;
            }

        } else {
            // Login mode
            btnSubmitText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Credentials...`;
            btnSubmitAuth.disabled = true;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email,
                        password: password,
                        remember_me: true
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.detail || 'Invalid email/gmail or password');
                }

                showAlert('Credentials verified! Entering Telemetry Hub...', 'success');
                saveSessionAndRedirect(data);
            } catch (err) {
                showAlert(err.message, 'error');
                btnSubmitText.textContent = 'Login to Telemetry Hub';
                btnSubmitAuth.disabled = false;
            }
        }
    });

    // ============================================================
    // 6. GOOGLE SIGN-IN FLOW
    // ============================================================
    if (btnGoogleLogin && googleModal) {
        btnGoogleLogin.addEventListener('click', () => {
            googleModal.style.display = 'flex';
        });
    }

    if (btnCloseGoogle && googleModal) {
        btnCloseGoogle.addEventListener('click', () => {
            googleModal.style.display = 'none';
        });
    }

    if (googleModal) {
        googleModal.addEventListener('click', (e) => {
            if (e.target === googleModal) {
                googleModal.style.display = 'none';
            }
        });
    }

    // Google Preset Account Cards
    document.querySelectorAll('.google-acc-item[data-email]').forEach(item => {
        item.addEventListener('click', async () => {
            const name = item.getAttribute('data-name');
            const email = item.getAttribute('data-email');
            const avatar_url = item.getAttribute('data-avatar');
            const gender = item.getAttribute('data-gender') || (name.toLowerCase().includes('gargi') ? 'Female' : 'Male');

            googleModal.style.display = 'none';
            showAlert(`Connecting to Google account: ${email}...`, 'success');

            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        gender: gender,
                        avatar_url: avatar_url,
                        device_uid: 'SOLEPOWER-01'
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');

                saveSessionAndRedirect(data);
            } catch (err) {
                showAlert(err.message, 'error');
            }
        });
    });

    // Custom Google Account Input
    if (btnCustomGoogle) {
        btnCustomGoogle.addEventListener('click', async () => {
            const email = prompt('Enter your Gmail address:', 'kartik.researcher@gmail.com');
            if (!email || !email.includes('@')) return;

            const nameParts = email.split('@')[0].split('.');
            const name = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            const isFemale = name.toLowerCase().includes('gargi') || name.toLowerCase().includes('ananya');
            const avatar_url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}&backgroundColor=${isFemale ? 'f43f5e' : '0ea5e9'}`;

            googleModal.style.display = 'none';
            showAlert(`Signing in with ${email}...`, 'success');

            try {
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name,
                        email: email,
                        gender: isFemale ? 'Female' : 'Male',
                        avatar_url: avatar_url,
                        device_uid: 'SOLEPOWER-01'
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Google authentication failed');

                saveSessionAndRedirect(data);
            } catch (err) {
                showAlert(err.message, 'error');
            }
        });
    }

    // ============================================================
    // 7. HELPER UTILITIES
    // ============================================================
    function saveSessionAndRedirect(userObj) {
        // Robust gender assurance: Ensure user object strictly retains correct gender
        const lowerName = (userObj.name || '').toLowerCase();
        const lowerEmail = (userObj.email || '').toLowerCase();
        if (lowerName.includes('gargi') || lowerEmail.includes('gargi') || lowerName.includes('ananya')) {
            userObj.gender = 'Female';
        } else if (userObj.gender && userObj.gender.toLowerCase() === 'female') {
            userObj.gender = 'Female';
        } else if (!userObj.gender) {
            userObj.gender = 'Male';
        }

        localStorage.setItem('solepower_user', JSON.stringify(userObj));
        localStorage.setItem('solepower_token', userObj.token);

        showAlert(`Welcome ${userObj.name} (${userObj.gender || 'User'})! Redirecting to Dashboard...`, 'success');
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 500);
    }

    function showAlert(msg, type = 'error') {
        if (!authAlert) return;
        authAlert.textContent = msg;
        authAlert.className = `auth-alert ${type === 'error' ? 'auth-alert-error' : 'auth-alert-success'}`;
        authAlert.style.display = 'flex';
    }

    function hideAlert() {
        if (!authAlert) return;
        authAlert.style.display = 'none';
    }
});
