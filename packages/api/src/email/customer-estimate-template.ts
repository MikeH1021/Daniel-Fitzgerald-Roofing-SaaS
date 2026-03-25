export interface CustomerEstimateData {
  companyName: string;
  firstName: string;
  sqft: number;
  pitch: string;
  material: string;
  estimateLow: number;
  estimateHigh: number;
  address?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function buildCustomerEstimateHtml(data: CustomerEstimateData): string {
  const firstName = escapeHtml(data.firstName);
  const companyName = escapeHtml(data.companyName);
  const pitch = escapeHtml(data.pitch);
  const material = escapeHtml(data.material);
  const sqft = data.sqft;
  const low = currencyFmt.format(data.estimateLow);
  const high = currencyFmt.format(data.estimateHigh);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
  <div style="background: #2563eb; color: #fff; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 22px;">Your Roofing Estimate</h1>
  </div>

  <div style="padding: 24px;">
    <p style="font-size: 16px; margin-top: 0;">Hi ${firstName},</p>
    <p style="font-size: 16px;">Thank you for using the ${companyName} roofing estimator. Here are the details for your estimate:</p>

    <h2 style="font-size: 18px; color: #1e40af;">Roof Details</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 140px;">Square Feet</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${sqft}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Pitch</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pitch}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Material</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${material}</td>
      </tr>${data.address ? `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Property Address</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(data.address)}</td>
      </tr>` : ''}
    </table>

    <div style="background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
      <div style="font-size: 14px; color: #64748b; margin-bottom: 8px;">Estimated Range</div>
      <div style="font-size: 28px; font-weight: bold; color: #2563eb;">${low} &ndash; ${high}</div>
    </div>

    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      This is an estimate only. Final pricing may vary based on inspection.
    </p>
    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
      Estimate provided by ${companyName}.
    </p>
  </div>
</body>
</html>`;
}
