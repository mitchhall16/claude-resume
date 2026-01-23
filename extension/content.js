// Content script for Resume AutoFill
// This runs on job application pages

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkPage') {
    // Check if this looks like a job application page
    const isApplicationPage = detectApplicationPage();
    sendResponse({ isApplicationPage });
  }
  return true;
});

function detectApplicationPage() {
  const url = window.location.href.toLowerCase();
  const applicationKeywords = [
    'apply', 'application', 'careers', 'jobs',
    'workday', 'greenhouse', 'lever', 'taleo',
    'icims', 'smartrecruiters', 'jobvite', 'breezy', 'ashby'
  ];

  // Check URL
  if (applicationKeywords.some(kw => url.includes(kw))) {
    return true;
  }

  // Check page content
  const pageText = document.body.innerText.toLowerCase();
  const formIndicators = ['apply now', 'submit application', 'upload resume', 'work experience'];

  return formIndicators.some(indicator => pageText.includes(indicator));
}

// Add a floating button on application pages
function addFloatingButton() {
  if (document.getElementById('resume-autofill-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'resume-autofill-btn';
  btn.innerHTML = '📄 AutoFill';
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 999999;
    padding: 12px 20px;
    background: linear-gradient(135deg, #00ff88, #00cc6a);
    color: #000;
    border: none;
    border-radius: 25px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 255, 136, 0.4);
    transition: all 0.2s;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 16px rgba(0, 255, 136, 0.5)';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 12px rgba(0, 255, 136, 0.4)';
  });

  btn.addEventListener('click', () => {
    chrome.storage.local.get(['profile'], (result) => {
      if (!result.profile || !result.profile.fullName) {
        showNotification('Please set up your profile in the extension first!', 'error');
        return;
      }

      const filled = fillFormOnPage(result.profile);
      if (filled > 0) {
        showNotification(`Filled ${filled} fields! Review before submitting.`, 'success');
      } else {
        showNotification('No matching fields found on this page.', 'warning');
      }
    });
  });

  document.body.appendChild(btn);
}

function showNotification(message, type) {
  const existing = document.getElementById('resume-autofill-notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.id = 'resume-autofill-notification';

  const colors = {
    success: { bg: 'rgba(0, 255, 136, 0.95)', text: '#000' },
    error: { bg: 'rgba(255, 100, 100, 0.95)', text: '#fff' },
    warning: { bg: 'rgba(255, 200, 50, 0.95)', text: '#000' }
  };

  const color = colors[type] || colors.success;

  notification.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 999999;
    padding: 12px 20px;
    background: ${color.bg};
    color: ${color.text};
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: slideIn 0.3s ease;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function fillFormOnPage(profile) {
  // Same fill logic as in popup.js
  function setInputValue(input, value) {
    if (!input || !value) return false;
    input.focus();
    input.value = '';
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  function findInput(patterns) {
    for (const pattern of patterns) {
      let input = document.querySelector(`input[name*="${pattern}" i], textarea[name*="${pattern}" i]`);
      if (input) return input;
      input = document.querySelector(`input[id*="${pattern}" i], textarea[id*="${pattern}" i]`);
      if (input) return input;
      input = document.querySelector(`input[placeholder*="${pattern}" i], textarea[placeholder*="${pattern}" i]`);
      if (input) return input;
      input = document.querySelector(`input[aria-label*="${pattern}" i], textarea[aria-label*="${pattern}" i]`);
      if (input) return input;

      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes(pattern.toLowerCase())) {
          const forId = label.getAttribute('for');
          if (forId) {
            input = document.getElementById(forId);
            if (input) return input;
          }
          input = label.querySelector('input, textarea');
          if (input) return input;
        }
      }

      input = document.querySelector(`input[data-automation-id*="${pattern}" i]`);
      if (input) return input;
    }
    return null;
  }

  function selectOption(patterns, value) {
    for (const pattern of patterns) {
      const select = document.querySelector(`select[name*="${pattern}" i], select[id*="${pattern}" i]`);
      if (select) {
        const options = select.querySelectorAll('option');
        for (const option of options) {
          if (option.value.toLowerCase() === value.toLowerCase() ||
              option.textContent.toLowerCase().includes(value.toLowerCase())) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
    }
    return false;
  }

  function selectRadio(patterns, value) {
    const yesPatterns = ['yes', 'true', '1'];
    const noPatterns = ['no', 'false', '0'];
    const targetPatterns = value === 'yes' ? yesPatterns : noPatterns;

    for (const pattern of patterns) {
      const radios = document.querySelectorAll(`input[type="radio"][name*="${pattern}" i]`);
      for (const radio of radios) {
        const label = radio.closest('label') || document.querySelector(`label[for="${radio.id}"]`);
        const labelText = label ? label.textContent.toLowerCase() : '';
        const radioValue = radio.value.toLowerCase();

        for (const target of targetPatterns) {
          if (radioValue.includes(target) || labelText.includes(target)) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('click', { bubbles: true }));
            return true;
          }
        }
      }
    }
    return false;
  }

  let filled = 0;

  // Name
  const fullNameInput = findInput(['full name', 'fullname', 'name', 'legal name', 'legalname']);
  if (fullNameInput && setInputValue(fullNameInput, profile.fullName)) filled++;

  if (!fullNameInput && profile.fullName) {
    const nameParts = profile.fullName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');

    const firstNameInput = findInput(['first name', 'firstname', 'first', 'given name', 'givenname']);
    const lastNameInput = findInput(['last name', 'lastname', 'last', 'surname', 'family name']);

    if (firstNameInput && setInputValue(firstNameInput, firstName)) filled++;
    if (lastNameInput && setInputValue(lastNameInput, lastName)) filled++;
  }

  // Email
  const emailInput = findInput(['email', 'e-mail', 'emailaddress']);
  if (emailInput && setInputValue(emailInput, profile.email)) filled++;

  // Phone
  const phoneInput = findInput(['phone', 'telephone', 'mobile', 'cell', 'phonenumber']);
  if (phoneInput && setInputValue(phoneInput, profile.phone)) filled++;

  // Location
  const locationInput = findInput(['location', 'city', 'address', 'current location']);
  if (locationInput && setInputValue(locationInput, profile.location)) filled++;

  // LinkedIn
  const linkedinInput = findInput(['linkedin', 'linked in']);
  if (linkedinInput && setInputValue(linkedinInput, profile.linkedin)) filled++;

  // Website
  const websiteInput = findInput(['website', 'portfolio', 'personal site', 'url', 'github']);
  if (websiteInput && setInputValue(websiteInput, profile.website)) filled++;

  // Work authorization
  if (profile.workAuth) {
    if (selectOption(['work auth', 'authorized', 'legally authorized', 'legal'], profile.workAuth) ||
        selectRadio(['work auth', 'authorized', 'legally authorized', 'legal'], profile.workAuth)) {
      filled++;
    }
  }

  // Sponsorship
  if (profile.sponsorship) {
    if (selectOption(['sponsor', 'visa', 'require sponsor'], profile.sponsorship) ||
        selectRadio(['sponsor', 'visa', 'require sponsor'], profile.sponsorship)) {
      filled++;
    }
  }

  return filled;
}

// Initialize floating button if on application page
if (detectApplicationPage()) {
  // Wait a bit for dynamic content to load
  setTimeout(addFloatingButton, 1500);
}
