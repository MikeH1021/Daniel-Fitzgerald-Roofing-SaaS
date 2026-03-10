import { buildLeadEmailHtml, type LeadEmailData } from './lead-email-template';

export async function sendLeadNotification(
  apiKey: string,
  options: {
    from: string;
    to: string;
    companyName: string;
    lead: LeadEmailData;
  }
): Promise<any> {
  const { from, to, lead } = options;
  const subject = `New Roofing Lead: ${lead.firstName} ${lead.lastName}`;
  const html = buildLeadEmailHtml(lead);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }

  return res.json();
}
