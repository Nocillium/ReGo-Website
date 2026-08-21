async function sendAppointmentEmail(appointment) {
  const {
    RESEND_API_KEY,
    ADMIN_EMAIL,
    FROM_EMAIL,
  } = process.env;

  if (!RESEND_API_KEY || !ADMIN_EMAIL || !FROM_EMAIL) {
    return;
  }

  const fullName = [appointment?.firstName, appointment?.lastName].filter(Boolean).join(' ') || 'Customer';
  const preferredDate = appointment?.preferredDate || 'Not specified';
  const preferredTime = appointment?.preferredTime || 'Not specified';
  const serviceType = appointment?.serviceType || 'Not specified';
  const notes = appointment?.notes || 'No additional notes.';

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
          <p><strong>Email:</strong> ${appointment?.email || 'N/A'}</p>
          <p><strong>Phone:</strong> ${appointment?.phone || 'N/A'}</p>
          <p><strong>Service:</strong> ${serviceType}</p>
          <p><strong>Preferred date:</strong> ${preferredDate}</p>
          <p><strong>Preferred time:</strong> ${preferredTime}</p>
          <p><strong>Vehicle details:</strong> ${appointment?.vehicleDetails || 'N/A'}</p>
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

import nodemailer from 'nodemailer';

async function sendAppointmentEmail(appointment) {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    ADMIN_EMAIL,
    FROM_EMAIL,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !ADMIN_EMAIL) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const fullName = [appointment?.firstName, appointment?.lastName].filter(Boolean).join(' ') || 'Customer';

  try {
    await transporter.sendMail({
      from: FROM_EMAIL || SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `New appointment request from ${fullName}`,
      html: `
        <h2>New appointment request</h2>
        <p><strong>Name:</strong> ${fullName}</p>
        <p><strong>Email:</strong> ${appointment?.email || 'N/A'}</p>
        <p><strong>Phone:</strong> ${appointment?.phone || 'N/A'}</p>
        <p><strong>Service:</strong> ${appointment?.serviceType || 'N/A'}</p>
        <p><strong>Preferred date:</strong> ${appointment?.preferredDate || 'N/A'}</p>
        <p><strong>Preferred time:</strong> ${appointment?.preferredTime || 'N/A'}</p>
        <p><strong>Vehicle details:</strong> ${appointment?.vehicleDetails || 'N/A'}</p>
        <p><strong>Notes:</strong> ${appointment?.notes || 'No notes provided'}</p>
      `,
    });
  } catch (error) {
    console.error('Gmail SMTP error:', error);
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