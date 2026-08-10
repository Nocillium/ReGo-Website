export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const {
    SHOPMONKEY_API_TOKEN,
    SHOPMONKEY_API_URL,
    SHOPMONKEY_APPOINTMENT_URL,
    SHOPMONKEY_LOCATION_ID,
  } = process.env;

  const shopmonkeyUrl = SHOPMONKEY_APPOINTMENT_URL || SHOPMONKEY_API_URL;

  if (!SHOPMONKEY_API_TOKEN || !shopmonkeyUrl) {
    return res.status(500).json({ success: false, message: 'Server booking configuration is missing.' });
  }

  try {
    const appointmentData = { ...req.body };
    if (SHOPMONKEY_LOCATION_ID && !appointmentData.locationIds) {
      appointmentData.locationIds = [SHOPMONKEY_LOCATION_ID];
    }
    const response = await fetch(shopmonkeyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SHOPMONKEY_API_TOKEN}`,
      },
      body: JSON.stringify(appointmentData),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      return res.status(response.status).json({ success: false, message: result.message || 'Booking API error.' });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Appointment API error:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit appointment request.' });
  }
}