/**
 * iGo ReGo — Main JavaScript
 */

(function () {
  'use strict';

  const SITE_CONFIG = window.REGO_SITE_CONFIG || {};
  const CONFIG = {
    phone: '+15551234567',
    shopmonkeyUrl: 'https://www.shopmonkey.io/book/your-shop-id',
    shopmonkeyApiUrl: '/api/appointment',
    googleMapsEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.966471254!2d-74.00425878459418!3d40.74076697932881!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDQ0JzI2LjgiTiA3NMKwMDAnMTUuMyJX!5e0!3m2!1sen!2sus!4v1234567890',
    ...SITE_CONFIG,
  };


  /* Sticky Header */
  const header = document.querySelector('.header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('header--scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* Mobile Navigation */
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');

  if (menuToggle && mobileNav) {
    const closeMobileNav = () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
      document.body.style.overflow = '';
    };

    menuToggle.addEventListener('click', () => {
      const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', !isOpen);
      mobileNav.classList.toggle('is-open', !isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMobileNav);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) {
        closeMobileNav();
      }
    });
  }

  /* Analytics Event Tracking */
  function trackEvent(name, params = {}) {
    if (typeof gtag === 'function') {
      gtag('event', name, params);
    }
    if (typeof dataLayer !== 'undefined') {
      dataLayer.push({ event: name, ...params });
    }
  }

  document.querySelectorAll('[data-track="book"]').forEach((el) => {
    el.addEventListener('click', () => trackEvent('book_appointment_click'));
  });

  document.querySelectorAll('[data-track="phone"]').forEach((el) => {
    el.addEventListener('click', () => trackEvent('phone_click'));
  });
  /* Form Handling */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }



  function validatePhone(phone) {
    return phone.replace(/\D/g, '').length >= 10;
  }

  function showFieldError(input, message) {
    input.classList.add('error');
    let errorEl = input.parentElement.querySelector('.form-error');
    if (!errorEl) {
      errorEl = document.createElement('span');
      errorEl.className = 'form-error';
      errorEl.setAttribute('role', 'alert');
      input.parentElement.appendChild(errorEl);
    }
    errorEl.textContent = message;
  }

  function clearFieldError(input) {
    input.classList.remove('error');
    const errorEl = input.parentElement.querySelector('.form-error');
    if (errorEl) errorEl.remove();
  }

  const SUPABASE_CLIENT = window.supabase && SITE_CONFIG.supabaseUrl && SITE_CONFIG.supabaseAnonKey
    ? window.supabase.createClient(SITE_CONFIG.supabaseUrl, SITE_CONFIG.supabaseAnonKey)
    : null;

  const AUTH_SESSION_KEY = 'regoAuth';

  let currentAuthUser = null;
  let authStateLoaded = false;
  let authStatePromise = null;

  function mapSupabaseUser(user) {
    if (!user) {
      return null;
    }

    const metadata = user.user_metadata || {};
    const firstName = metadata.first_name || '';
    const lastName = metadata.last_name || '';
    const name = metadata.name || [firstName, lastName].filter(Boolean).join(' ').trim();

    return {
      id: user.id,
      email: user.email || '',
      name,
      firstName,
      lastName,
      phone: metadata.phone || user.phone || null,
      companyName: metadata.company_name || '',
      customerId: metadata.customer_id || metadata.shopmonkey_customer_id || null,
    };
  }

  function getStoredAuth() {
    if (currentAuthUser) {
      return currentAuthUser;
    }

    try {
      const storedAuth = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
      if (storedAuth) {
        currentAuthUser = storedAuth;
        authStateLoaded = true;
        return currentAuthUser;
      }
    } catch {
      // Ignore malformed stored auth and fall through to Supabase session lookup.
    }

    return currentAuthUser;
  }

  function setStoredAuth(user) {
    currentAuthUser = user ? { ...user } : null;
    authStateLoaded = true;
    authStatePromise = Promise.resolve(currentAuthUser);

    if (currentAuthUser) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(currentAuthUser));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }

    return currentAuthUser;
  }

  async function clearAuth() {
    currentAuthUser = null;
    authStateLoaded = false;
    authStatePromise = null;
    localStorage.removeItem(AUTH_SESSION_KEY);

    if (SUPABASE_CLIENT) {
      await SUPABASE_CLIENT.auth.signOut();
    }
  }

  async function loadAuthState() {
    if (authStateLoaded) {
      return currentAuthUser;
    }

    const storedAuth = getStoredAuth();
    if (storedAuth) {
      authStateLoaded = true;
      return storedAuth;
    }

    if (!SUPABASE_CLIENT) {
      authStateLoaded = true;
      currentAuthUser = null;
      return currentAuthUser;
    }

    if (!authStatePromise) {
      authStatePromise = (async () => {
        const { data, error } = await SUPABASE_CLIENT.auth.getSession();
        if (error) {
          console.error('Supabase session error:', error);
          currentAuthUser = null;
        } else {
          currentAuthUser = mapSupabaseUser(data.session?.user || null);
        }
        authStateLoaded = true;
        return currentAuthUser;
      })();
    }

    return authStatePromise;
  }

  function isAuthPage() {
    const pathname = window.location.pathname;
    return pathname.endsWith('/login.html') || pathname.endsWith('/signup.html');
  }

  function isProtectedPage() {
    const pathname = window.location.pathname;
    return pathname === '/' || pathname.endsWith('/index.html') || pathname.endsWith('/appointment.html');
  }

  function ensureProtectedPage() {
    if (isProtectedPage() && !getStoredAuth()) {
      window.location.replace('login.html');
    }
  }

  function redirectIfAuthenticated() {
    if (isAuthPage() && getStoredAuth()) {
      window.location.replace('index.html');
    }
  }

  function prefillAppointmentForm() {
    const appointmentForm = document.getElementById('appointment-form');
    const auth = getStoredAuth();
    if (!appointmentForm || !auth) {
      return;
    }

    const [firstNameInput, lastNameInput, emailInput, phoneInput] = [
      appointmentForm.querySelector('[name="firstName"]'),
      appointmentForm.querySelector('[name="lastName"]'),
      appointmentForm.querySelector('[name="email"]'),
      appointmentForm.querySelector('[name="phone"]'),
    ];

    if (auth.name) {
      const parts = auth.name.split(' ');
      if (firstNameInput && parts[0]) {
        firstNameInput.value = parts[0];
      }
      if (lastNameInput && parts.length > 1) {
        lastNameInput.value = parts.slice(1).join(' ');
      }
    }

    if (emailInput && auth.email) {
      emailInput.value = auth.email;
    }
    if (phoneInput && auth.phone) {
      phoneInput.value = auth.phone;
    }
  }

  async function initializeAuthPages() {
    redirectIfAuthenticated();

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const emailInput = loginForm.querySelector('[name="email"]');
        const passwordInput = loginForm.querySelector('[name="password"]');
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const formError = loginForm.querySelector('.form__error');

        if (!email || !password) {
          showFieldError(!email ? emailInput : passwordInput, 'Please enter both email and password.');
          return;
        }

        if (!SUPABASE_CLIENT) {
          if (formError) {
            formError.textContent = 'Supabase auth is not configured yet. Add your project URL and anon key in site.config.js.';
            formError.classList.add('is-visible');
          }
          return;
        }

        try {
          const { data, error } = await SUPABASE_CLIENT.auth.signInWithPassword({ email, password });
          if (error) {
            throw error;
          }

          setStoredAuth(mapSupabaseUser(data.user));
          window.location.replace('index.html');
        } catch (error) {
          const details = [error?.message, error?.status ? `status ${error.status}` : '', error?.code ? `code ${error.code}` : '']
            .filter(Boolean)
            .join(' ');
          showFieldError(passwordInput, details || 'Email or password is incorrect.');
        }
      });
    }

    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
      signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const firstNameInput = signupForm.querySelector('[name="firstName"]');
        const lastNameInput = signupForm.querySelector('[name="lastName"]');
        const emailInput = signupForm.querySelector('[name="email"]');
        const phoneInput = signupForm.querySelector('[name="phone"]');
        const passwordInput = signupForm.querySelector('[name="password"]');
        const companyInput = signupForm.querySelector('[name="companyName"]');

        const firstName = firstNameInput.value.trim();
        const lastName = lastNameInput.value.trim();
        const email = emailInput.value.trim();
        const phone = phoneInput.value.trim();
        const password = passwordInput.value.trim();
        const companyName = companyInput ? companyInput.value.trim() : '';

        let isValid = true;
        [firstNameInput, lastNameInput, emailInput, phoneInput, passwordInput].forEach((field) => clearFieldError(field));

        if (!firstName) {
          showFieldError(firstNameInput, 'Please enter your first name.');
          isValid = false;
        }
        if (!lastName) {
          showFieldError(lastNameInput, 'Please enter your last name.');
          isValid = false;
        }
        if (!email || !validateEmail(email)) {
          showFieldError(emailInput, 'Please enter a valid email address.');
          isValid = false;
        }
        if (!phone || !validatePhone(phone)) {
          showFieldError(phoneInput, 'Please enter a valid phone number.');
          isValid = false;
        }
        if (!password || password.length < 6) {
          showFieldError(passwordInput, 'Pick a password with at least 6 characters.');
          isValid = false;
        }

        if (!isValid) {
          return;
        }

        const formError = signupForm.querySelector('.form__error');
        if (formError) {
          formError.textContent = '';
          formError.classList.remove('is-visible');
        }

        const submitButton = signupForm.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Creating account...';
        }

        try {
          if (!SUPABASE_CLIENT) {
            throw new Error('Supabase auth is not configured yet. Add your project URL and anon key in site.config.js.');
          }

          const { data, error } = await SUPABASE_CLIENT.auth.signUp({
            email,
            password,
            options: {
              data: {
                first_name: firstName,
                last_name: lastName,
                phone,
                company_name: companyName,
              },
            },
          });

          if (error) {
            throw error;
          }

          const signedUpUser = mapSupabaseUser(data.user);

          if (!data.session) {
            if (formError) {
              formError.textContent = 'Account created. Check your email to confirm your signup before logging in.';
              formError.classList.add('is-visible');
            }
            return;
          }

          let customerId = signedUpUser.customerId;

          try {
            const response = await fetch('/api/customer', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                firstName,
                lastName,
                email,
                phone,
                companyName,
              }),
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                customerId = result.data?.id || result.data?.customerId || customerId;
              }
            }

            const { data: updatedUser, error: updateError } = await SUPABASE_CLIENT.auth.updateUser({
              data: {
                first_name: firstName,
                last_name: lastName,
                phone,
                company_name: companyName,
                customer_id: customerId,
                shopmonkey_customer_id: customerId,
              },
            });

            if (!updateError && updatedUser?.user) {
              setStoredAuth(mapSupabaseUser(updatedUser.user));
            } else {
              setStoredAuth({
                ...signedUpUser,
                customerId,
              });
            }
          } catch (customerError) {
            console.warn('Customer provisioning skipped:', customerError);
            setStoredAuth({
              ...signedUpUser,
              customerId,
            });
          }

          window.location.replace('index.html');
        } catch (error) {
          if (formError) {
            formError.textContent = error.message;
            formError.classList.add('is-visible');
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Create Account';
          }
        }
      });
    }
  }

  async function submitAppointmentForm(form) {
    const formData = new FormData(form);
    const auth = getStoredAuth();
    const firstName = (formData.get('firstName') || '').toString().trim();
    const lastName = (formData.get('lastName') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim();
    const phone = (formData.get('phone') || '').toString().trim();
    const companyName = (formData.get('companyName') || '').toString().trim();
    const serviceType = (formData.get('serviceType') || '').toString().trim();
    const preferredDate = (formData.get('preferredDate') || '').toString().trim();
    const preferredTime = (formData.get('preferredTime') || '').toString().trim();
    const vehicleDetails = (formData.get('vehicleDetails') || '').toString().trim();
    const notes = (formData.get('notes') || '').toString().trim();
    const customerType = (formData.get('customerType') || 'Customer').toString().trim();

    const customer = {
      firstName,
      lastName,
      companyName,
      customerType,
      emails: email ? [{ email }] : [],
      phoneNumbers: phone ? [{ number: phone }] : [],
    };

    if (auth?.customerId) {
      customer.id = auth.customerId;
    }

    let startDate = new Date();
    if (preferredDate) {
      const isoDate = preferredDate + (preferredTime ? `T${preferredTime}` : 'T09:00');
      const parsedDate = new Date(isoDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        startDate = parsedDate;
      }
    }

    const computedName = vehicleDetails && serviceType
      ? `${vehicleDetails} - ${serviceType}`
      : vehicleDetails
        ? vehicleDetails
        : serviceType
          ? `${firstName} ${lastName}`.trim() + ` - ${serviceType}`
          : `${firstName} ${lastName}`.trim() || 'Appointment Request';

    const data = {
      name: computedName,
      startDate: startDate.toISOString(),
      endDate: new Date(startDate.getTime() + 60 * 60 * 1000).toISOString(),
      color: 'blue',
      useEmail: true,
      useSMS: true,
      sendConfirmation: true,
      sendReminder: true,
      origin: 'AppointmentScheduler',
      customerType,
      customerId: auth?.customerId,
      customer,
      serviceType,
      notes: notes,
    };

    const errorEl = form.querySelector('.form__error');
    if (errorEl) {
      errorEl.classList.remove('is-visible');
      errorEl.textContent = '';
    }

    try {
      if (!CONFIG.shopmonkeyApiUrl) {
        throw new Error('Booking API configuration is missing. Please set the API URL.');
      }

      const response = await fetch(CONFIG.shopmonkeyApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        const message = result.message || 'Unable to send your request right now. Please try again later.';
        throw new Error(message);
      }

      return result;
    } catch (error) {
      if (errorEl) {
        errorEl.textContent = error.message;
        errorEl.classList.add('is-visible');
        errorEl.setAttribute('tabindex', '-1');
        errorEl.focus();
      }
      throw error;
    }
  }

  function handleFormSubmit(form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const requiredFields = form.querySelectorAll('[required]');
      let isValid = true;

      requiredFields.forEach((field) => {
        clearFieldError(field);
        const value = field.value.trim();

        if (!value) {
          showFieldError(field, 'This field is required.');
          isValid = false;
        } else if (field.type === 'email' && !validateEmail(value)) {
          showFieldError(field, 'Please enter a valid email address.');
          isValid = false;
        } else if (field.type === 'tel' && !validatePhone(value)) {
          showFieldError(field, 'Please enter a valid phone number.');
          isValid = false;
        }
      });

      if (!isValid) {
        const firstError = form.querySelector('.error');
        if (firstError) firstError.focus();
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      try {
        await submitAppointmentForm(form);
        const successEl = form.querySelector('.form__success');
        if (successEl) {
          form.querySelectorAll('input').forEach((input) => input.value = '');
          successEl.classList.add('is-visible');
          successEl.setAttribute('tabindex', '-1');
          successEl.focus();
        }
      } catch (error) {
        console.error('Appointment submission failed:', error);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Request Appointment';
        }
      }
    });

    form.querySelectorAll('input, textarea').forEach((field) => {
      field.addEventListener('input', () => clearFieldError(field));
    });
  }

  async function bootstrapAuth() {
    await loadAuthState();

    const appointmentForm = document.getElementById('appointment-form');
    if (appointmentForm) {
      prefillAppointmentForm();
      handleFormSubmit(appointmentForm);
    }

    await initializeAuthPages();
    ensureProtectedPage();
  }

  bootstrapAuth();

  /* Cookie Consent */
  const cookieBanner = document.querySelector('.cookie-banner');
  const cookieAccept = document.querySelector('.cookie-accept');
  const cookieDecline = document.querySelector('.cookie-decline');

  if (cookieBanner && !localStorage.getItem('igo-rego-cookie-consent')) {
    setTimeout(() => cookieBanner.classList.add('is-visible'), 1000);
  }

  if (cookieAccept) {
    cookieAccept.addEventListener('click', () => {
      localStorage.setItem('igo-rego-cookie-consent', 'accepted');
      cookieBanner.classList.remove('is-visible');
      trackEvent('cookie_consent', { consent: 'accepted' });
    });
  }

  if (cookieDecline) {
    cookieDecline.addEventListener('click', () => {
      localStorage.setItem('igo-rego-cookie-consent', 'declined');
      cookieBanner.classList.remove('is-visible');
    });
  }

  /* Highlight Today's Hours */
  const hoursTable = document.querySelector('.hours-table');
  if (hoursTable) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    hoursTable.querySelectorAll('tr').forEach((row) => {
      if (row.dataset.day === today) {
        row.classList.add('today');
      }
    });
  }

  /* Lazy Load Maps */
  const mapContainers = document.querySelectorAll('[data-lazy-map]');
  if (mapContainers.length && 'IntersectionObserver' in window) {
    const mapObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const container = entry.target;
            const src = container.dataset.lazyMap;
            if (src && !container.querySelector('iframe')) {
              const iframe = document.createElement('iframe');
              iframe.src = src;
              iframe.title = 'iGo ReGo location on Google Maps';
              iframe.loading = 'lazy';
              iframe.referrerPolicy = 'no-referrer-when-downgrade';
              iframe.allowFullscreen = true;
              container.appendChild(iframe);
            }
            mapObserver.unobserve(container);
          }
        });
      },
      { rootMargin: '200px' }
    );
    mapContainers.forEach((el) => mapObserver.observe(el));
  }

})();
