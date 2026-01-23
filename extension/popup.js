// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
  });
});

// Load saved profile on popup open
chrome.storage.local.get(['profile'], (result) => {
  if (result.profile) {
    document.getElementById('fullName').value = result.profile.fullName || '';
    document.getElementById('email').value = result.profile.email || '';
    document.getElementById('phone').value = result.profile.phone || '';
    document.getElementById('location').value = result.profile.location || '';
    document.getElementById('linkedin').value = result.profile.linkedin || '';
    document.getElementById('website').value = result.profile.website || '';
    document.getElementById('workAuth').value = result.profile.workAuth || '';
    document.getElementById('sponsorship').value = result.profile.sponsorship || '';
  }
});

// Save profile
document.getElementById('saveBtn').addEventListener('click', () => {
  const profile = {
    fullName: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    location: document.getElementById('location').value,
    linkedin: document.getElementById('linkedin').value,
    website: document.getElementById('website').value,
    workAuth: document.getElementById('workAuth').value,
    sponsorship: document.getElementById('sponsorship').value
  };

  chrome.storage.local.set({ profile }, () => {
    showStatus('Profile saved!', 'success');
  });
});

// Import from claude-resume (tries to fetch from localStorage via content script)
document.getElementById('importBtn').addEventListener('click', async () => {
  // Open claude-resume in a new tab to sync
  chrome.tabs.create({ url: 'https://claude-resume.pages.dev' }, (tab) => {
    showStatus('Opening claude-resume - copy your data from there', 'success');
  });
});

// Auto-fill button
document.getElementById('fillBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.storage.local.get(['profile'], async (result) => {
    if (!result.profile || !result.profile.fullName) {
      showStatus('Please fill in your profile first!', 'error');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillForm,
        args: [result.profile, 'full']
      });
      showStatus('Form filled! Review and submit.', 'success');
    } catch (e) {
      showStatus('Could not fill this page. Try a job application page.', 'error');
    }
  });
});

// Fill basic info only
document.getElementById('fillBasicBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.storage.local.get(['profile'], async (result) => {
    if (!result.profile || !result.profile.fullName) {
      showStatus('Please fill in your profile first!', 'error');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: fillForm,
        args: [result.profile, 'basic']
      });
      showStatus('Basic info filled!', 'success');
    } catch (e) {
      showStatus('Could not fill this page. Try a job application page.', 'error');
    }
  });
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status ' + type;
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}

// This function runs in the context of the page
function fillForm(profile, mode) {
  // Helper to set input value and trigger events
  function setInputValue(input, value) {
    if (!input || !value) return false;

    // Focus the input
    input.focus();

    // Clear existing value
    input.value = '';

    // Set new value
    input.value = value;

    // Trigger various events that frameworks listen to
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

    return true;
  }

  // Helper to find input by various attributes
  function findInput(patterns) {
    for (const pattern of patterns) {
      // Try by name
      let input = document.querySelector(`input[name*="${pattern}" i], textarea[name*="${pattern}" i]`);
      if (input) return input;

      // Try by id
      input = document.querySelector(`input[id*="${pattern}" i], textarea[id*="${pattern}" i]`);
      if (input) return input;

      // Try by placeholder
      input = document.querySelector(`input[placeholder*="${pattern}" i], textarea[placeholder*="${pattern}" i]`);
      if (input) return input;

      // Try by aria-label
      input = document.querySelector(`input[aria-label*="${pattern}" i], textarea[aria-label*="${pattern}" i]`);
      if (input) return input;

      // Try by associated label
      const labels = document.querySelectorAll('label');
      for (const label of labels) {
        if (label.textContent.toLowerCase().includes(pattern.toLowerCase())) {
          const forId = label.getAttribute('for');
          if (forId) {
            input = document.getElementById(forId);
            if (input) return input;
          }
          // Check for nested input
          input = label.querySelector('input, textarea');
          if (input) return input;
        }
      }

      // Try data attributes (common in React/Angular apps)
      input = document.querySelector(`input[data-automation-id*="${pattern}" i]`);
      if (input) return input;
    }
    return null;
  }

  // Helper to select dropdown option
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

  // Helper for radio buttons
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

  // Basic info - always fill
  // Name fields
  const fullNameInput = findInput(['full name', 'fullname', 'name', 'legal name', 'legalname']);
  if (fullNameInput && setInputValue(fullNameInput, profile.fullName)) filled++;

  // Try first/last name separately if full name field not found
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

  // Location/Address
  const locationInput = findInput(['location', 'city', 'address', 'current location']);
  if (locationInput && setInputValue(locationInput, profile.location)) filled++;

  // LinkedIn
  const linkedinInput = findInput(['linkedin', 'linked in']);
  if (linkedinInput && setInputValue(linkedinInput, profile.linkedin)) filled++;

  // Website/Portfolio
  const websiteInput = findInput(['website', 'portfolio', 'personal site', 'url', 'github']);
  if (websiteInput && setInputValue(websiteInput, profile.website)) filled++;

  if (mode === 'full') {
    // Work authorization
    if (profile.workAuth) {
      selectOption(['work auth', 'authorized', 'legally authorized', 'legal'], profile.workAuth) ||
      selectRadio(['work auth', 'authorized', 'legally authorized', 'legal'], profile.workAuth);
    }

    // Sponsorship
    if (profile.sponsorship) {
      selectOption(['sponsor', 'visa', 'require sponsor'], profile.sponsorship) ||
      selectRadio(['sponsor', 'visa', 'require sponsor'], profile.sponsorship);
    }
  }

  console.log(`Resume AutoFill: Filled ${filled} fields`);
  return filled;
}
