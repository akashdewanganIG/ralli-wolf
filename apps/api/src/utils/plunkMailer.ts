// Utility to send user welcome credentials using Plunk transactional API
const PLUNK_API_URL = "https://api.useplunk.com/v1/send";
const PLUNK_API_KEY = process.env.PLUNK_API_KEY || "<your_token_here>";
const FROM_EMAIL = "noreply@crm-suite.local";

export async function sendPlunkUserWelcome({
  to,
  name,
  email,
  password,
}: {
  to: string;
  name: string;
  email: string;
  password: string;
}) {
  const subject = "Your CRM Suite Account Credentials";
  const body = `Hi ${name || email},

Your account has been created.

Username: ${email}
Password: ${password}

Login at: https://your-login-url

Best Regards,
CRM Suite Team`;

  const payload = {
    to,
    subject,
    body,
    subscribed: true,
    name: name || email,
    from: FROM_EMAIL,
    reply: FROM_EMAIL,
    headers: {},
    attachments: {},
  };

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PLUNK_API_KEY}`,
    },
    body: JSON.stringify(payload),
  };

  const response = await fetch(PLUNK_API_URL, options as any);
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Plunk email failed: ${response.status}: ${errorBody}`);
  }
  return response.json();
}
