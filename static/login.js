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
    // 6. REAL OFFICIAL GOOGLE IDENTITY SERVICES OAUTH FLOW
    // ============================================================
    const GOOGLE_CLIENT_ID = '890272269079-70q1uf9bfv5ll12lolp0tq0lkkkn58gg.apps.googleusercontent.com';
    let googleTokenClient = null;

    function setupRealGoogleAuth() {
        if (typeof google === 'undefined' || !google.accounts) {
            setTimeout(setupRealGoogleAuth, 150);
            return;
        }

        try {
            // 1. Initialize Token Client for Google Sign-In Popup window
            googleTokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'email profile openid',
                callback: async (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        showAlert('Verifying Google credentials...', 'success');
                        try {
                            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                                headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                            });
                            const profile = await userRes.json();

                            const res = await fetch('/api/auth/google', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: profile.name || profile.email.split('@')[0],
                                    email: profile.email,
                                    avatar_url: profile.picture,
                                    google_id: profile.sub,
                                    device_uid: 'SOLEPOWER-01'
                                })
                            });

                            const data = await res.json();
                            if (!res.ok) throw new Error(data.detail || 'Google authentication failed');
                            saveSessionAndRedirect(data);
                        } catch (err) {
                            showAlert('Google Sign-In failed: ' + err.message, 'error');
                        }
                    } else if (tokenResponse && tokenResponse.error) {
                        showAlert('Google Sign-In cancelled: ' + tokenResponse.error, 'error');
                    }
                }
            });

            // 2. Initialize Google One-Tap
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: async (response) => {
                    if (response && response.credential) {
                        showAlert('Google session verified! Entering Telemetry Hub...', 'success');
                        try {
                            const base64Url = response.credential.split('.')[1];
                            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
                            const payload = JSON.parse(jsonPayload);

                            const res = await fetch('/api/auth/google', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    name: payload.name || payload.email.split('@')[0],
                                    email: payload.email,
                                    avatar_url: payload.picture,
                                    google_id: payload.sub,
                                    device_uid: 'SOLEPOWER-01'
                                })
                            });

                            const data = await res.json();
                            if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');
                            saveSessionAndRedirect(data);
                        } catch (err) {
                            showAlert('Google One-Tap failed: ' + err.message, 'error');
                        }
                    }
                }
            });

            // Attempt One-Tap prompt
            google.accounts.id.prompt();
        } catch (e) {
            console.error('Google Auth Init error:', e);
        }
    }

    setupRealGoogleAuth();

    if (btnGoogleLogin) {
        btnGoogleLogin.addEventListener('click', () => {
            if (googleTokenClient) {
                // Opens the real official Google accounts chooser popup window
                googleTokenClient.requestAccessToken({ prompt: 'select_account' });
            } else {
                showAlert('Connecting to Google services, please retry in 2 seconds...', 'error');
                setupRealGoogleAuth();
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
