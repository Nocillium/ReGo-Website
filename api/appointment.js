async function sendAppointmentEmail(appointment) {
  const {
    RESEND_API_KEY,
    ADMIN_EMAIL,
    FROM_EMAIL,
  } = process.env;

  if (!RESEND_API_KEY || !ADMIN_EMAIL || !FROM_EMAIL) {
    return;
  }

  const customer = appointment?.customer || {};
  const firstName = appointment?.firstName || customer?.firstName || '';
  const lastName = appointment?.lastName || customer?.lastName || '';
  const email = appointment?.email || customer?.email || customer?.emails?.[0]?.email || 'N/A';
  const phone = appointment?.phone || customer?.phone || customer?.phoneNumbers?.[0]?.number || 'N/A';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Customer';
  const preferredDate = appointment?.preferredDate || appointment?.startDate || 'Not specified';
  const preferredTime = appointment?.preferredTime || 'Not specified';
  const serviceType = appointment?.serviceType || 'Not specified';
  const notes = appointment?.notes || 'No additional notes.';
  const vehicleDetails = appointment?.vehicleDetails || appointment?.vehicle?.name || 'N/A';

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `New appointment request from ${fullName}`,
        html: `
          <h2>New appointment request</h2>
          <p><strong>Name:</strong> ${fullName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Service:</strong> ${serviceType}</p>
          <p><strong>Preferred date:</strong> ${preferredDate}</p>
          <p><strong>Preferred time:</strong> ${preferredTime}</p>
          <p><strong>Vehicle details:</strong> ${vehicleDetails}</p>
          <p><strong>Notes:</strong> ${notes}</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorResult = await response.json().catch(() => null);
      console.error('Resend email error:', errorResult || response.statusText);
    }
  } catch (error) {
    console.error('Unable to send appointment email notification:', error);
  }
}

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

    await sendAppointmentEmail(appointmentData);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Appointment API error:', error);
    return res.status(500).json({ success: false, message: 'Unable to submit appointment request.' });
  }
}