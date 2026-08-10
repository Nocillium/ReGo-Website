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

  try {
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