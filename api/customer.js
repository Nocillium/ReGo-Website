function normalizeText(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

function extractCustomerEmails(customer = {}) {
  const emails = Array.isArray(customer.emails) ? customer.emails : [];
  const emailValues = emails
    .map((entry) => entry?.email || entry?.value || '')
    .filter(Boolean);

  if (customer.email) {
    emailValues.push(customer.email);
  }

  return emailValues.map((value) => normalizeText(value));
}

function extractCustomerPhones(customer = {}) {
  const phones = Array.isArray(customer.phoneNumbers) ? customer.phoneNumbers : [];
  const phoneValues = phones
    .map((entry) => entry?.number || entry?.value || '')
    .filter(Boolean);

  if (customer.phone) {
    phoneValues.push(customer.phone);
  }

  return phoneValues.map((value) => normalizePhone(value));
}

function matchesExistingCustomer(customer, desiredCustomer) {
  const desiredEmail = normalizeText(desiredCustomer.email || '');
  const desiredPhone = normalizePhone(desiredCustomer.phone || '');
  const desiredFirst = normalizeText(desiredCustomer.firstName || '');
  const desiredLast = normalizeText(desiredCustomer.lastName || '');

  const customerFirst = normalizeText(customer?.firstName || customer?.first_name || '');
  const customerLast = normalizeText(customer?.lastName || customer?.last_name || '');
  const customerEmailMatches = desiredEmail && extractCustomerEmails(customer).includes(desiredEmail);
  const customerPhoneMatches = desiredPhone && extractCustomerPhones(customer).includes(desiredPhone);

  const sameNameMatch = desiredFirst && desiredLast && customerFirst && customerLast
    ? customerFirst === desiredFirst && customerLast === desiredLast
    : false;

  return customerEmailMatches || customerPhoneMatches || sameNameMatch;
}

async function findExistingCustomer(customerUrl, apiToken, desiredCustomer) {
  const normalizedEmail = normalizeText(desiredCustomer.email || '');
  const normalizedPhone = normalizePhone(desiredCustomer.phone || '');
  const searchUrls = [];

  if (normalizedEmail) {
    searchUrls.push(`${customerUrl}?email=${encodeURIComponent(normalizedEmail)}`);
    searchUrls.push(`${customerUrl}?query=${encodeURIComponent(normalizedEmail)}`);
  }

  if (normalizedPhone) {
    searchUrls.push(`${customerUrl}?phone=${encodeURIComponent(normalizedPhone)}`);
    searchUrls.push(`${customerUrl}?query=${encodeURIComponent(normalizedPhone)}`);
  }

  searchUrls.push(customerUrl);

  const seenUrls = new Set();

  for (const url of searchUrls) {
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        continue;
      }

      const result = await response.json();
      const customers = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.customers)
            ? result.customers
            : Array.isArray(result?.results)
              ? result.results
              : [];

      const matchingCustomer = customers.find((customer) => matchesExistingCustomer(customer, desiredCustomer));
      if (matchingCustomer) {
        return matchingCustomer;
      }
    } catch (error) {
      console.warn('Customer lookup failed:', error);
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const {
    SHOPMONKEY_API_TOKEN,
    SHOPMONKEY_CUSTOMER_URL,
    SHOPMONKEY_LOCATION_ID,
  } = process.env;

  const customerUrl = SHOPMONKEY_CUSTOMER_URL;

  if (!SHOPMONKEY_API_TOKEN || !customerUrl) {
    return res.status(500).json({
      success: false,
      message: 'Server customer configuration is missing. Set SHOPMONKEY_API_TOKEN and SHOPMONKEY_CUSTOMER_URL.',
    });
  }

  const { firstName, lastName, email, phone, companyName, customerType = 'Customer' } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ success: false, message: 'First name, last name, and email are required.' });
  }

  const desiredCustomer = { firstName, lastName, email, phone, companyName, customerType };

  try {
    const existingCustomer = await findExistingCustomer(customerUrl, SHOPMONKEY_API_TOKEN, desiredCustomer);
    if (existingCustomer) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Customer already exists in Shopmonkey. Reused the existing record.',
        data: existingCustomer,
      });
    }

    const customerPayload = {
      firstName,
      lastName,
      companyName: companyName || '',
      customerType,
      ...(SHOPMONKEY_LOCATION_ID ? { locationIds: [SHOPMONKEY_LOCATION_ID] } : {}),
      emails: [
        {
          email,
          primary: true,
          subscribed: true,
          marketingOptIn: true,
        },
      ],
      phoneNumbers: phone
        ? [
            {
              number: phone,
              primary: true,
            },
          ]
        : [],
      origin: 'WebsiteRegistration',
    };

    const response = await fetch(customerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SHOPMONKEY_API_TOKEN}`,
      },
      body: JSON.stringify(customerPayload),
    });

    const result = await response.json();

    if (!response.ok || result?.success === false) {
      return res.status(response.status || 500).json({
        success: false,
        message: result?.message || 'Shopmonkey customer creation failed.',
        data: result,
      });
    }

    return res.status(200).json({ success: true, data: result?.data || result });
  } catch (error) {
    console.error('Customer API error:', error);
    return res.status(500).json({ success: false, message: 'Unable to create customer record.' });
  }
}