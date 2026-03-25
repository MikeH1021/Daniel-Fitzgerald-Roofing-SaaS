import { buildCustomerEstimateHtml, type CustomerEstimateData } from './customer-estimate-template';

export async function sendEstimateToCustomer(
  apiKey: string,
  options: {
    from: string;
    to: string;
    companyName: string;
    estimate: CustomerEstimateData;
  }
): Promise<any> {
  const { from, to, companyName, estimate } = options;
  const subject = `Your Roofing Estimate from ${companyName}`;
  const html = buildCustomerEstimateHtml(estimate);

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
