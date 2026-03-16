import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildLeadEmailHtml, type LeadEmailData } from '../src/email/lead-email-template';
import { sendLeadNotification } from '../src/email/send-lead-notification';

const sampleLead: LeadEmailData = {
  companyName: 'Acme Roofing',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '5551234567',
  sqft: 2000,
  pitch: 'medium',
  material: 'architectural',
  estimateLow: 8900,
  estimateHigh: 12400,
};

describe('buildLeadEmailHtml', () => {
  it('includes all lead details in HTML output', () => {
    const html = buildLeadEmailHtml(sampleLead);
    expect(html).toContain('John');
    expect(html).toContain('Doe');
    expect(html).toContain('john@example.com');
    expect(html).toContain('5551234567');
    expect(html).toContain('2000');
    expect(html).toContain('medium');
    expect(html).toContain('architectural');
  });

  it('formats currency with $ sign and no decimals', () => {
    const html = buildLeadEmailHtml(sampleLead);
    expect(html).toContain('$8,900');
    expect(html).toContain('$12,400');
  });

  it('escapes HTML entities in user-supplied fields', () => {
    const xssLead: LeadEmailData = {
      ...sampleLead,
      firstName: '<script>alert("xss")</script>',
    };
    const html = buildLeadEmailHtml(xssLead);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('includes property address in HTML when address is provided', () => {
    const leadWithAddress: LeadEmailData = {
      ...sampleLead,
      address: '123 Main St, Springfield, IL 62701',
    };
    const html = buildLeadEmailHtml(leadWithAddress);
    expect(html).toContain('Property Address');
    expect(html).toContain('123 Main St, Springfield, IL 62701');
  });

  it('omits property address row when address is absent', () => {
    const html = buildLeadEmailHtml(sampleLead);
    expect(html).not.toContain('Property Address');
  });
});

describe('sendLeadNotification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends email with correct Resend API call', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-123' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await sendLeadNotification('test-api-key', {
      from: 'leads@example.com',
      to: 'company@example.com',
      companyName: 'Acme Roofing',
      lead: sampleLead,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
    expect(opts.headers['Authorization']).toBe('Bearer test-api-key');
    expect(opts.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(opts.body);
    expect(body.from).toBe('leads@example.com');
    expect(body.to).toEqual(['company@example.com']);
    expect(body.subject).toContain('John');
    expect(body.subject).toContain('Doe');
    expect(body.html).toBeDefined();
  });

  it('throws on non-2xx response with status and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', mockFetch);

    await expect(
      sendLeadNotification('test-api-key', {
        from: 'leads@example.com',
        to: 'company@example.com',
        companyName: 'Acme Roofing',
        lead: sampleLead,
      })
    ).rejects.toThrow('Resend API error 500');
  });

  it('returns parsed JSON response on success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email-456' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await sendLeadNotification('test-api-key', {
      from: 'leads@example.com',
      to: 'company@example.com',
      companyName: 'Acme Roofing',
      lead: sampleLead,
    });

    expect(result).toEqual({ id: 'email-456' });
  });
});
