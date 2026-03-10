# Pitfalls Research

**Domain:** Embeddable roofing estimate calculator SaaS (lead-gen widget)
**Researched:** 2026-03-09 (v1.0), updated 2026-03-10 (v1.1 Google Maps additions)
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: CSS Bleed -- Widget Styling Breaks on Host Sites

**What goes wrong:**
The widget renders correctly in development but looks broken when embedded on real roofing company websites. Host site CSS bleeds into the widget (resetting fonts, overriding colors, breaking layouts) or the widget's CSS leaks out and breaks the host site's navigation, footer, or other elements. This is the single most common failure mode for embeddable widgets.

**Why it happens:**
Developers build and test the widget in isolation. Script-tag-injected DOM elements share the host page's CSS cascade. A host site with `* { box-sizing: border-box; }`, aggressive resets, or Bootstrap/Tailwind utility classes will override widget styles unpredictably. Every host site is different, making this impossible to catch with a single test environment.

**How to avoid:**
Use Shadow DOM for CSS encapsulation. Render the widget inside a custom element with a closed shadow root. This provides true style isolation -- host CSS cannot reach into the shadow tree, and widget CSS cannot leak out. Shadow DOM has 96% global browser support (IE11 is the only gap, which is irrelevant for this audience). Do NOT rely on high-specificity selectors, BEM naming, or CSS-in-JS alone -- these are incomplete solutions that still leak through inheritance and `!important` rules.

**Warning signs:**
- Widget looks different when embedded on a WordPress theme vs. a Wix site vs. a Squarespace site
- Font sizes, padding, or input field heights vary across host sites
- Host site elements shift or change appearance after widget loads

**Phase to address:**
Phase 1 (Widget Foundation). This must be the architectural starting point, not retrofitted later. Switching from direct DOM injection to Shadow DOM after building the widget requires rewriting the entire rendering layer.

---

### Pitfall 2: Email Notifications Land in Spam -- Core Value Destroyed

**What goes wrong:**
Lead notification emails to roofing companies go to spam folders or never arrive. Since email is the ONLY lead delivery mechanism in v1 (no dashboard), a single missed email means a lost lead and lost revenue for the customer. The roofing company blames your product and churns. This is existential for the business.

**Why it happens:**
Developers use a shared sending service (SendGrid free tier, generic SMTP) without proper domain authentication. New sending domains have no reputation. Roofing company email servers (often small-business-grade setups like GoDaddy email or shared hosting) have aggressive spam filters. Transactional emails get mixed with marketing emails on the same IP, dragging down sender reputation.

**How to avoid:**
Use Postmark for transactional email (98.7% inbox placement rate, purpose-built for transactional delivery). Set up SPF, DKIM, and DMARC records on your sending domain from day one. Never mix marketing and transactional email streams. Send from a subdomain like `leads.yourdomain.com` to protect the root domain's reputation. Include a plain-text version of every email. Keep emails short, professional, and free of spammy language ("FREE," excessive links, images-only content).

**Warning signs:**
- No reply or acknowledgment from roofing companies after leads are submitted
- Bounce rate above 2%
- Spam complaint rate above 0.1%
- Test emails to Gmail/Outlook/Yahoo land in spam or Promotions tab

**Phase to address:**
Phase 2 (Lead Capture & Notification). Email delivery infrastructure must be production-grade from the first lead sent. Do not ship with a "we'll fix deliverability later" approach -- by then you've already lost customer trust.

---

### Pitfall 3: Estimate Prices Are Wildly Inaccurate -- Kills Credibility for Both You and the Roofer

**What goes wrong:**
The calculator shows a homeowner $8,000 for a roof replacement. The roofer shows up and quotes $18,000. The homeowner feels deceived. The roofer is furious because they now have to manage an angry lead. The roofer blames your widget, disables it, and tells other roofers. Online calculators are known to be off by an average of 20%.

**Why it happens:**
Developers use a single national average cost-per-square-foot without accounting for regional variation (roofing costs in San Francisco vs. rural Alabama differ by 2-3x). The formula doesn't account for material type (asphalt shingles vs. metal vs. tile differ by 3-5x). The "complexity" multiplier is a guess without contractor input. There is no mechanism for the roofing company to calibrate the formula to their actual pricing.

**How to avoid:**
Present estimates as a RANGE, never a single number. Make the range wide enough to be defensible (e.g., "$12,000 - $18,000") while narrow enough to be useful. Include prominent disclaimers ("This is a rough estimate. Your actual quote may vary based on materials, roof condition, and local labor costs."). Make pricing parameter overrides dead simple for roofing companies -- they know their local costs and should be able to set their own base price per square foot, pitch multipliers, and complexity multipliers. Default values should be conservative (slightly high rather than low -- under-promising and over-delivering is better than the reverse).

**Warning signs:**
- Roofing companies complain that leads have unrealistic expectations
- Homeowners submit but never respond to the roofer's follow-up
- Roofing companies immediately override all default pricing parameters (defaults are clearly wrong)
- Significant negative feedback in the first week of a new customer going live

**Phase to address:**
Phase 1 (Pricing Formula) and Phase 2 (Settings Page). Research actual roofing costs by region before setting defaults. The settings page must make price calibration the most prominent feature, not buried in an advanced section.

---

### Pitfall 4: TCPA/Consent Compliance Violations -- Legal Liability for You and Your Customers

**What goes wrong:**
The widget collects contact information and shares it with the roofing company without proper consent documentation. A homeowner claims they never agreed to be contacted. Under TCPA, penalties are $500-$1,500 PER unauthorized contact. A roofing company that calls 50 leads without proper consent records faces $25,000-$75,000 in potential liability. They will come after you.

**Why it happens:**
Developers treat the consent checkbox as a UX formality rather than a legal requirement. The checkbox is pre-checked (illegal under TCPA). Consent text is vague ("I agree to terms") instead of explicitly naming the company that will contact them and the methods of contact. No timestamped record of consent is stored. The consent text doesn't mention the specific roofing company by name (required for one-to-one consent).

**How to avoid:**
The consent checkbox must be unchecked by default. Consent text must explicitly name the roofing company and the contact methods: "I consent to [Company Name] contacting me by phone, text, or email regarding my roofing estimate." Store a timestamped consent record with the exact text shown, the IP address, and the user agent for every submission. Make this consent record available to the roofing company. Never pre-check the checkbox. Consult a lawyer before finalizing consent language.

**Warning signs:**
- Consent checkbox is pre-checked in any environment
- Consent text does not mention the specific roofing company name
- No audit trail of consent records in the database
- Roofing company asks "do I have proof they agreed to be contacted?" and you can't answer

**Phase to address:**
Phase 2 (Lead Capture Form). Consent architecture must be designed into the form from the start, not bolted on. The database schema must include consent fields from the first migration.

---

### Pitfall 5: Widget Breaks Host Site Performance -- Roofer's Site Slows Down, They Remove the Widget

**What goes wrong:**
The widget loads 500KB+ of JavaScript, makes multiple API calls on page load, and adds 2-3 seconds to the host site's load time. Google penalizes the site's SEO ranking. The roofing company's existing visitors bounce. The roofer removes the widget because it's hurting their business more than helping it.

**Why it happens:**
Developers use a full framework (React 18 is ~130KB gzipped with ReactDOM) plus a CSS framework plus analytics plus error tracking, all loaded synchronously in the host page. Every network request blocks rendering. The widget initializes eagerly even if it's below the fold.

**How to avoid:**
Keep the total widget bundle under 50KB gzipped. Use Preact (3KB) instead of React, or build with vanilla JS/web components. Lazy-load the widget -- the initial script tag should be a tiny loader (~2KB) that defers the full widget until the user scrolls to it or interacts. Load all assets asynchronously with `async` or `defer` attributes. Use a single API call on submission, not on load. No external font loading -- inherit from the host site or use system fonts inside the shadow DOM.

**Warning signs:**
- Bundle size exceeds 50KB gzipped
- Lighthouse performance score drops by more than 5 points on host site after widget embed
- Widget makes network requests before user interaction
- Time to Interactive increases by more than 500ms

**Phase to address:**
Phase 1 (Widget Foundation). Bundle size discipline must be enforced from the first line of code. It is extremely difficult to shrink a bundle after features are built -- the framework choice locks in a size floor.

---

### Pitfall 6: Bot Spam Floods Roofing Companies with Fake Leads

**What goes wrong:**
Bots discover the widget's submission endpoint and flood it with fake leads. The roofing company receives 200 "leads" overnight, wastes hours trying to contact fake people, and loses trust in the product. AI-powered bots now generate realistic-looking submissions with plausible names, emails, and phone numbers that pass basic validation.

**Why it happens:**
The widget has a publicly accessible API endpoint with no bot protection. Basic client-side validation (required fields, email format) is trivially bypassed. There is no rate limiting. The form can be submitted programmatically without rendering the widget.

**How to avoid:**
Implement a layered defense: (1) Honeypot fields -- hidden form fields that only bots fill out. (2) Rate limiting by IP -- max 3 submissions per IP per hour. (3) Server-side validation of all inputs. (4) Timing analysis -- reject submissions completed in under 3 seconds (humans can't fill a 4-step form that fast). (5) reCAPTCHA v3 (invisible, score-based) as a fallback -- only challenge suspicious submissions, never add friction for legitimate users. (6) Email verification via API (Kickbox or similar) to reject disposable/invalid email addresses before saving the lead.

**Warning signs:**
- Sudden spike in submissions from a single IP or IP range
- Submissions with sequential or pattern-based email addresses
- Form completion times under 3 seconds
- Roofing company reports that leads have disconnected phone numbers

**Phase to address:**
Phase 2 (Lead Capture). Honeypot and rate limiting must ship with the first public version. reCAPTCHA and email verification can be added iteratively based on observed spam volume.

---

## Critical Pitfalls: v1.1 Google Maps Integration

### Pitfall 7: Google Maps Drawing Library Is Deprecated -- Sunsets May 2026

**What goes wrong:**
You build polygon drawing using `google.maps.drawing.DrawingManager` (the Drawing Library). Google deprecated this library in August 2025 and will make it completely unavailable in May 2026. Any code using it will break in production within months of shipping v1.1.

**Why it happens:**
The Drawing Library is the most prominent result in search results and tutorials for "Google Maps polygon drawing." Developers reach for it because it's Google's own library and seems like the obvious choice. The deprecation is not prominently displayed in quick-start examples.

**How to avoid:**
Do not use the Drawing Library at all. Use Terra Draw (`terra-draw` on npm) instead -- it is the replacement Google recommends and supports Google Maps natively. Terra Draw provides GeoJSON output directly, handles both mouse and touch events correctly, and has better mobile support than the deprecated library. Alternatively, implement polygon drawing directly using Google Maps native `Polygon` and `Polyline` overlay classes with manual click-to-add-vertex interaction, which is the low-dependency fallback.

**Warning signs:**
- Any import of `google.maps.drawing` in the codebase
- Console warnings about deprecated API usage
- Build tooling pulling in `@googlemaps/js-api-loader` with `libraries: ["drawing"]`

**Phase to address:**
Phase 1 of Google Maps milestone (Drawing Tool setup). Never use the Drawing Library. Establish this as a hard constraint before implementation starts.

---

### Pitfall 8: Legacy Places Autocomplete Unavailable to New Projects

**What goes wrong:**
You implement address autocomplete using `google.maps.places.Autocomplete` or `google.maps.places.AutocompleteService` (the legacy API). As of March 1, 2025, these are unavailable to new Google Maps Platform customers. New API keys will not have access to them, causing silent failures or console errors.

**Why it happens:**
The vast majority of tutorials, Stack Overflow answers, and third-party library examples still use the legacy `Autocomplete` class because it was the standard for years. `google.maps.places.Autocomplete` remains in documentation under "legacy" but is not available for new API keys.

**How to avoid:**
Use `google.maps.places.PlaceAutocompleteElement` (the new Web Component) or the `AutocompleteSuggestion` class from the new Places API. For this project, `PlaceAutocompleteElement` is the right choice for UI use. Be aware: it renders inside its own closed Shadow DOM, which creates the styling conflict described in Pitfall 9 below.

**Warning signs:**
- `google.maps.places.Autocomplete is not available` error in browser console
- Autocomplete input appears but shows no suggestions
- Documentation page title reads "Place Autocomplete (Legacy)"

**Phase to address:**
Phase 1 of Google Maps milestone (Places API setup). Verify the new API surface before writing any autocomplete code.

---

### Pitfall 9: PlaceAutocompleteElement's Shadow DOM Conflicts With the Widget's Shadow DOM

**What goes wrong:**
The widget already uses Shadow DOM for style isolation. Google's `PlaceAutocompleteElement` is itself a Web Component with a closed Shadow DOM inside it. The autocomplete dropdown (`.pac-container`) is appended to the document body, outside both shadow roots. This creates three distinct style contexts that don't communicate:

1. The host page's styles
2. The widget's shadow root styles
3. Google's PlaceAutocompleteElement's closed shadow root

The widget's CSS cannot style the Google component's internal elements. The dropdown appears outside the widget's shadow root, inheriting host page styles instead of widget styles. Z-index conflicts with the host page can hide the dropdown behind other elements.

**Why it happens:**
A closed shadow root prevents external CSS from penetrating it by design. This is the correct behavior for both the widget's shadow DOM and Google's component, but their interaction creates an unstyled mismatch. Developers assume standard CSS classes will work until they try to style the component in production.

**How to avoid:**
Two approaches, in order of preference:

Option A (Recommended): Use the `Autocomplete` class attached to a plain `<input>` element that you render yourself inside the widget's shadow root. This gives you full styling control over the input. The `.pac-container` dropdown still renders outside your shadow root into the document body, but you can style it with a global CSS injection into the document (not shadow root) specifically targeting `.pac-container`. This is acceptable because `.pac-container` is a well-known class Google provides for this purpose.

Option B: Use `PlaceAutocompleteElement` and accept the styling constraints. Apply styles to the custom element's host container. Avoid aggressive overrides that break icon positioning. The "monkey patch" (`attachShadow` override to force open mode) is fragile and will break on any Google Maps API update.

Do not attempt to style the autocomplete dropdown from inside the widget's shadow root -- the dropdown lives in the document body and is unreachable from the shadow root's CSS scope.

**Warning signs:**
- Autocomplete input looks unstyled or mismatched vs. the rest of the widget
- Dropdown suggestions appear behind host page elements
- Icons appear outside the input field after applying custom CSS
- Console errors about shadow root access when attempting to style the component

**Phase to address:**
Phase 1 of Google Maps milestone (Places/autocomplete implementation). Decide on Option A vs. B before writing the autocomplete component. Retrofitting is painful.

---

### Pitfall 10: Google Maps API Key Exposed Client-Side Without Restrictions

**What goes wrong:**
The Google Maps API key is embedded in the widget JavaScript bundle, which is publicly accessible. Scrapers harvest keys from GitHub, browser DevTools, and minified JS. An attacker uses the key for expensive API calls (Street View, Routes, Geocoding) unrelated to the widget. A single billing spike can cost thousands of dollars before Google's fraud alerts trigger.

**Why it happens:**
Google Maps JavaScript API keys must be public -- the browser needs them to load the map. Developers know this but skip adding HTTP referrer restrictions, assuming obscurity is sufficient protection. The key sits in git history, in the built JS bundle, and potentially in error monitoring logs.

**How to avoid:**
Apply two hard restrictions to every API key:

1. **HTTP Referrer Restriction**: Only allow requests from your widget's domain(s) and the domains of your customers' websites. Use `*.yourdomain.com` plus specific customer domains. This is the primary defense.

2. **API Restriction**: Restrict the key to only the APIs it actually uses: Maps JavaScript API, Places API (New). Do not leave the key unrestricted or scoped to "All APIs."

Set a billing alert at $50/month. Enable usage quotas (e.g., 10,000 Maps loads/day). Enable Google Cloud's anomaly detection alerts. Note that HTTP referrer restrictions have a known bypass for requests that omit the `Referer` header -- this is why API restrictions (limiting to specific APIs) are equally important.

**Warning signs:**
- API key appears in git history without restrictions
- Google Cloud billing spike > 2x baseline in a day
- Maps loads from unrecognized domains in the Usage & Billing dashboard
- API key is the same key used across multiple projects or APIs

**Phase to address:**
Phase 1 of Google Maps milestone (API setup and key management). Set restrictions before the key touches any code that will be committed.

---

### Pitfall 11: Autocomplete Session Token Mismanagement Causes 5-10x Cost Overrun

**What goes wrong:**
Autocomplete requests without session tokens are billed individually at $2.83/1,000 requests. With sessions, the first 12 keystrokes in a session are billed at $2.83/1,000, but requests 13+ are free -- and the session is then closed by a single Place Details call. Without sessions, a user who types a 15-character address generates 15 individual billable requests. With sessions, the same interaction costs one session fee.

More specifically: if a session is started but never terminated with a Place Details call (user types but doesn't select a suggestion), all autocomplete requests in that incomplete session revert to per-request billing.

**Why it happens:**
Sessions require explicitly creating a `google.maps.places.AutocompleteSessionToken` and passing it through both the autocomplete requests and the subsequent Place Details call. Most tutorial code omits session tokens entirely for simplicity. Incomplete sessions (user types but abandons) are a normal usage pattern that developers don't account for.

**How to avoid:**
Always use session tokens. Create a new token when the autocomplete input is focused. Pass the same token for all autocomplete requests in that interaction. Terminate the session by passing the same token to `Place.fetchFields()` when the user selects a suggestion. Discard the token after the Place Details call and create a fresh one for the next interaction. With this pattern, a typical address-entry interaction costs one session (~$0.017) instead of 10-15 individual requests (~$0.03-$0.04).

Also: request only the Place fields you actually need. For roof measurement, you only need `formatted_address`, `geometry.location`, and possibly `address_components`. Requesting `photos`, `reviews`, or `opening_hours` adds cost with no benefit.

**Warning signs:**
- Autocomplete code has no reference to `AutocompleteSessionToken`
- Place Details request does not include the session token
- Cost-per-autocomplete-session in billing console significantly exceeds $0.017
- Usage reports show many autocomplete requests with no corresponding Place Details request

**Phase to address:**
Phase 1 of Google Maps milestone (Places/autocomplete implementation). Session token management is a first-implementation concern, not a post-launch optimization.

---

### Pitfall 12: Google Maps Loads Synchronously, Bloating Widget Bundle by 400KB+

**What goes wrong:**
The widget currently weighs 28KB gzipped. Loading the Google Maps JavaScript API adds approximately 400KB+ to the page weight (Google's map loader itself is not bundled -- it dynamically loads additional scripts at runtime). If the map is loaded eagerly on widget initialization, every page load incurs this cost even when the user never reaches the map step.

**Why it happens:**
The standard Maps API loading pattern (`<script src="https://maps.googleapis.com/...">`) is synchronous and loads immediately. Developers follow the quickstart docs without considering that their widget is embedded in someone else's page.

**How to avoid:**
Load Google Maps dynamically and lazily. Only trigger the Maps API load when the user reaches the map step in the widget flow (after they've entered roof details and the widget decides to show the map). Use `google.maps.importLibrary()` (the dynamic import API) which defers loading until called:

```javascript
// Only called when user reaches the map step, not on widget init
const { Map } = await google.maps.importLibrary("maps");
const { PlaceAutocompleteElement } = await google.maps.importLibrary("places");
```

Load the Maps API bootstrap script (`https://maps.googleapis.com/maps/api/js?key=...&loading=async`) with `loading=async` parameter and defer the bootstrap itself until needed. Do not include the Maps API URL in the widget's initial bundle.

**Warning signs:**
- Network tab shows `maps.googleapis.com` requests on first widget load before user interaction
- Maps API is included in `index.html` or the widget's top-level initialization
- Lighthouse shows Maps-related network requests in the initial load waterfall

**Phase to address:**
Phase 1 of Google Maps milestone (API loading architecture). Loading strategy must be decided before any Maps code is written. Lazy loading the API is as easy as eager loading if done from the start.

---

### Pitfall 13: Mobile Touch Conflicts Between Map Pan/Zoom and Polygon Drawing

**What goes wrong:**
On mobile, a single-finger touch on the map both pans the map AND attempts to draw a polygon vertex. Users cannot draw a polygon without accidentally moving the map. Conversely, if drawing mode captures all touch events, users cannot pan the map to position their view correctly before tracing. This makes the feature effectively unusable on mobile, which is a significant portion of the target user base.

**Why it happens:**
The default Google Maps gesture handling (`gestureHandling: "auto"`) uses one-finger touch to pan the map. Drawing tools also use tap/click events for placing polygon vertices. There is no built-in reconciliation between "I want to pan" vs. "I want to draw." The user has no way to communicate intent.

**How to avoid:**
Design an explicit mode toggle for mobile: "Pan Mode" (default, one-finger pans) vs. "Draw Mode" (taps add vertices). Make the toggle visually prominent. When in Draw Mode, set `gestureHandling: "none"` on the map to prevent pan/zoom interference. When in Pan Mode, restore `gestureHandling: "cooperative"` (two-finger to zoom, one-finger to pan page).

For map zoom during drawing: provide explicit +/- zoom buttons as an alternative to pinch-to-zoom, since pinch gestures are impossible to distinguish from two-finger drawing attempts.

Also set `draggable: false` and `scrollwheel: false` on the map when in Draw Mode to prevent accidental movement mid-trace.

**Warning signs:**
- Map pans while user is trying to place a polygon vertex on mobile
- Users cannot complete a polygon without accidentally moving the map
- No visible mode toggle between "pan" and "draw" in the UI
- Testing only done with a mouse, never touch

**Phase to address:**
Phase 2 of Google Maps milestone (Polygon drawing tool). Mobile interaction model must be designed upfront, not after desktop drawing works.

---

### Pitfall 14: Satellite Imagery Gaps Make Polygon Drawing Impossible for Rural Addresses

**What goes wrong:**
For rural and suburban addresses outside major metro areas, Google Maps satellite imagery maxes out at zoom levels 18-19 (vs. zoom 21 in cities). At these zoom levels, individual roof edges are not distinguishable. The homeowner cannot accurately trace their roof because the image is too low-resolution. The calculated area is meaningless. They abandon the map step and either manually enter sqft or leave entirely.

**Why it happens:**
Most residential roofing work happens in suburban and rural areas, exactly where Google's aerial imagery is lowest quality. Developers test with their own home address (usually in a metro area with good imagery) and assume it works everywhere. The accuracy variance is 0.5m in cities vs. 1.5m+ in rural areas.

**How to avoid:**
Use the `MaxZoomService` API to check the maximum available zoom level for the address before displaying the map. If the maximum zoom is below 19, show a warning: "Satellite imagery for this address may not be detailed enough to trace your roof accurately. You can still try, or enter your roof size manually." Never hide or disable the manual entry fallback -- it must remain available at every point in the map flow.

Always default the map to `mapTypeId: 'satellite'` and set initial zoom based on `MaxZoomService` result, not a hardcoded value.

**Warning signs:**
- No check for maximum available zoom level at the given address
- Manual sqft entry is only accessible by clicking "back" through the map flow
- Test addresses are all in major cities with high-resolution imagery
- No warning message for low-zoom addresses

**Phase to address:**
Phase 2 of Google Maps milestone (Map display and satellite view). Zoom level checking must be integrated into address resolution. Fallback to manual entry must be prominent throughout.

---

### Pitfall 15: Area Calculation Returns Meters, Not Sqft -- Silently Wrong Estimates

**What goes wrong:**
`google.maps.geometry.spherical.computeArea()` returns area in square meters. Passing this value directly to the pricing formula (which expects square feet) produces an estimate that is 10.76x too low. A 2,000 sqft roof calculates as approximately 186 sqft, generating a $500 estimate instead of $5,000+. The bug is non-obvious because the number looks plausible to a developer unfamiliar with roofing sizes.

**Why it happens:**
Google's geometry library uses SI units throughout. The function returns a float in m². The conversion to sqft (`m² * 10.7639`) is a single line but is easy to omit, especially when copying example code that doesn't explicitly document the unit. There is no type-level indication that the value is in square meters.

**How to avoid:**
Wrap `computeArea()` in a named function that makes units explicit and applies the pitch adjustment:

```javascript
function computeRoofSqft(polygon: google.maps.Polygon, pitchMultiplier: number): number {
  const areaSquareMeters = google.maps.geometry.spherical.computeArea(polygon.getPath());
  const flatFootprint = areaSquareMeters * 10.7639; // m² to sqft
  return Math.round(flatFootprint * pitchMultiplier);
}
```

Unit test this function with known inputs. A 20m x 10m rectangle should return approximately 2,153 sqft before pitch adjustment.

**Warning signs:**
- Area calculation result passed directly to pricing formula without explicit unit conversion
- Estimated prices for traced roofs are 10x lower than manually-entered equivalent
- No unit test for the area calculation function
- Variable named `area` rather than `areaSquareMeters` or `areaSquareFeet`

**Phase to address:**
Phase 2 of Google Maps milestone (Area calculation). Write the unit conversion wrapper before connecting the polygon to the pricing formula.

---

### Pitfall 16: Host Site CSP Blocks Google Maps -- Widget Silently Fails

**What goes wrong:**
The widget successfully loads on most sites but silently fails on sites with strict Content Security Policy headers. Host sites using WordPress security plugins (Wordfence, iThemes Security), security-conscious managed hosting, or enterprise CMSes often have CSPs that block external scripts. The map panel renders blank. The user sees nothing, no error message, no fallback to manual entry.

**Why it happens:**
Adding Google Maps to the widget requires the host page to allow these CSP sources:
- `script-src`: `*.googleapis.com`
- `img-src`: `*.googleapis.com *.gstatic.com *.google.com *.googleusercontent.com`
- `connect-src`: `*.googleapis.com *.gstatic.com`
- `frame-src`: `*.google.com`
- `worker-src`: `blob:`
- `font-src`: `fonts.gstatic.com`

Host sites cannot typically add CSP entries for a widget they just pasted in a code block. Even if technically possible, it requires technical knowledge most roofing company website owners don't have. This is a showstopper for some customers.

**How to avoid:**
Detect CSP failures gracefully. Use a try/catch around Google Maps initialization and a `script` element `onerror` handler to detect when the Maps API fails to load. When failure is detected, automatically show the manual sqft entry step instead of a blank map. Display a user-friendly message: "Map unavailable on this site -- enter your approximate roof size below." Document the required CSP additions for customers whose web developers can make the change.

The widget must degrade gracefully to the pre-v1.1 flow (manual sqft entry) when Maps fails, not to a blank screen.

**Warning signs:**
- Map panel shows blank with no error message or fallback
- No `onerror` handler on the Maps API script loading
- No CSP documentation in the embed guide
- Testing done only on sites without CSP

**Phase to address:**
Phase 1 of Google Maps milestone (API loading architecture) and Phase 3 (Error handling and fallback). Graceful degradation must be part of the initial architecture, not an afterthought.

---

## Moderate Pitfalls

### Pitfall 17: Content Security Policy Blocks Widget on Host Sites

**What goes wrong:**
The widget fails to load on host sites that have strict Content Security Policy (CSP) headers. The browser blocks the script, iframe, or API calls. The roofing company sees a blank space where the widget should be and assumes it's broken.

**Why it happens:**
Modern website builders and security-conscious hosting providers set CSP headers that restrict which external scripts can run, which domains can be framed, and which API endpoints can be contacted. A script-tag embed from `widget.yourdomain.com` will be blocked by `script-src 'self'` policies.

**How to avoid:**
Offer both script-tag AND iframe embed options. The iframe approach works in more CSP configurations because the host site only needs `frame-src widget.yourdomain.com`. Document the required CSP additions clearly. Provide a simple troubleshooting page: "If the widget doesn't appear, ask your web host to add `widget.yourdomain.com` to their Content Security Policy." For Wix/Squarespace/WordPress.com (managed hosting where customers can't change CSP), test and document specific embed instructions per platform.

**Warning signs:**
- Widget works in development but shows blank on customer's live site
- Browser console shows `Refused to load script` or `Refused to frame` errors
- Customer uses a managed hosting platform (Wix, Squarespace, WordPress.com)

**Phase to address:**
Phase 1 (Widget Embedding). Test embedding on the top 5 platforms roofing companies use (WordPress self-hosted, Wix, Squarespace, GoDaddy Website Builder, and raw HTML sites) before shipping.

---

### Pitfall 18: Mobile Experience Breaks in Embedded Context

**What goes wrong:**
The widget is responsive in isolation but breaks when embedded on a mobile site. The iframe doesn't resize properly, input fields are too small to tap, the keyboard covers the form, or the 4-step flow requires horizontal scrolling. More than 50% of homeowner traffic is mobile.

**Why it happens:**
Developers test the widget in a standalone browser tab on mobile, not embedded inside a real mobile website with its own viewport, navigation bars, and scroll behavior. iframe height cannot automatically adjust to content without JavaScript communication between parent and child. Mobile keyboards push content up in unpredictable ways inside iframes.

**How to avoid:**
If using iframe: implement `postMessage` height reporting -- the widget sends its current height to the parent page, which resizes the iframe container dynamically. If using Shadow DOM: the widget inherits the host page's viewport naturally, which is much simpler. Design mobile-first: minimum touch target size of 44x44px, generous spacing between form fields, full-width inputs. Test on actual devices embedded in real roofing company websites, not just Chrome DevTools responsive mode.

**Warning signs:**
- Form abandonment rate is significantly higher on mobile than desktop
- Horizontal scrollbar appears inside the widget on mobile
- Users report they "couldn't see" the submit button
- Widget height is fixed at a desktop-appropriate value

**Phase to address:**
Phase 1 (Widget Foundation). Mobile-first design and responsive embedding must be validated early with real-device testing on real host sites.

---

### Pitfall 19: Tenant Data Leaks Between Roofing Companies

**What goes wrong:**
Company A's leads appear in Company B's email notifications or settings page. A single missing `WHERE tenant_id = ?` clause in a database query exposes one company's leads to another. Even if the leak is brief, it destroys trust and may trigger breach notification obligations.

**Why it happens:**
In shared-database multi-tenant architectures, every query must filter by tenant ID. It only takes one missed filter in one code path -- a background job, an admin query, an edge case in the notification system -- to leak data. This is especially dangerous because the data includes homeowner PII (name, email, phone, address).

**How to avoid:**
Use Row-Level Security (RLS) in PostgreSQL -- enforce tenant isolation at the database level so application bugs cannot bypass it. Every table with tenant-scoped data gets an RLS policy: `CREATE POLICY tenant_isolation ON leads USING (tenant_id = current_setting('app.current_tenant')::uuid)`. Set the tenant context at the beginning of every request. This is a defense-in-depth layer that catches application-level bugs. For v1 with few customers, this is lightweight to implement and prevents catastrophic mistakes.

**Warning signs:**
- Any database query on tenant-scoped data that does not include a `tenant_id` filter
- A code path that accesses data without setting tenant context first
- No automated test that verifies tenant isolation (e.g., "user from tenant A cannot see tenant B's leads")

**Phase to address:**
Phase 1 (Database Schema). RLS policies must be defined alongside the initial table creation. Retrofitting RLS onto an existing schema with production data is risky and error-prone.

---

### Pitfall 20: Roofing Companies Can't Actually Embed the Widget

**What goes wrong:**
The embed process requires technical knowledge that small roofing company owners don't have. They can't find where to paste the script tag in WordPress, their Wix site doesn't support custom code on their plan, or they paste the snippet in the wrong place and it breaks their site. They give up and ask for a refund.

**Why it happens:**
Developers assume users know basic HTML. Most roofing company owners hired someone to build their website years ago and have never touched the code. Many use drag-and-drop builders where "paste this code" isn't an obvious action.

**How to avoid:**
Create platform-specific embed guides with screenshots for WordPress (Custom HTML block), Wix (Embed a Widget), and Squarespace (Code Block). Keep the embed snippet to a single line: `<script src="https://widget.yourdomain.com/v1/TENANT_ID.js" async></script>`. Offer a "test your embed" verification page where they paste their site URL and you check if the widget loads. Consider offering white-glove setup for early customers -- install it for them to learn what goes wrong.

**Warning signs:**
- Customers sign up but the widget never appears on their site
- Support tickets dominated by "how do I install this?"
- Time from signup to first live widget exceeds 48 hours

**Phase to address:**
Phase 3 (Settings & Onboarding). The embed experience must be polished before scaling customer acquisition. Early customers can receive manual help, but the process must be self-service for growth.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip Shadow DOM, use prefixed CSS classes | Faster initial build | CSS conflicts surface on every new host site, requires per-site debugging | Never -- Shadow DOM is the same effort as prefixed classes and eliminates an entire category of bugs |
| Use SendGrid free tier for email | Zero cost | Shared IPs, deliverability issues, no stream separation | Only for development/testing, never production |
| Hardcode pricing formula defaults | Ship faster | Every new customer requires manual calibration, wrong defaults erode trust | MVP only -- add per-tenant overrides in the same phase |
| Store leads in a flat table without tenant scoping | Simpler queries | Data leak risk, painful migration to add tenant isolation later | Never -- tenant_id column costs nothing to add upfront |
| Skip email verification on lead submissions | Less complexity | Fake leads waste roofer time, erode product trust | First 30 days only -- add verification once spam is observed |
| Use React for the widget | Familiar DX, ecosystem | 130KB+ framework tax on every host site, performance complaints | Never for the embeddable widget -- use Preact or vanilla. React is fine for the admin/settings dashboard |
| Use Google Maps Drawing Library for polygons | First result in search, Google's own library | Hard cutoff in May 2026 -- code stops working in production | Never -- use Terra Draw or native Polygon overlays |
| Load Google Maps API eagerly on widget init | Simpler code | 400KB+ loaded on every page, even when user never reaches map step | Never -- lazy loading is equally simple if designed from the start |
| Hardcode initial zoom level instead of using MaxZoomService | One less API call | Rural addresses show blurry imagery; users cannot trace roof | Never -- MaxZoomService call costs nothing and prevents bad UX for 30%+ of users |
| Reuse session token across multiple address searches | One less object to manage | All autocomplete requests in second search billed at per-request rates | Never -- tokens are cheap, per-request overages are not |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Email (Postmark/SendGrid) | Sending from a `noreply@` address that recipients can't reply to | Send from `leads@yourdomain.com` and forward replies to the roofing company -- some homeowners reply to the notification email |
| Email (Postmark/SendGrid) | Not setting up SPF/DKIM/DMARC before sending first email | Configure DNS records and verify domain before any production email is sent |
| reCAPTCHA | Using reCAPTCHA v2 checkbox that adds friction for every user | Use reCAPTCHA v3 (invisible, score-based) -- only challenge low-score submissions |
| Google Fonts | Loading Google Fonts in the widget for "nice typography" | Adds 100-300ms of render-blocking time; use system font stack or inherit host fonts |
| Analytics (GA/Mixpanel) | Loading a full analytics SDK inside the widget | Track events by posting to your own API endpoint; analytics SDK belongs on your dashboard, not the widget |
| Google Maps Places API | Using `google.maps.places.Autocomplete` (legacy, unavailable to new customers since March 2025) | Use `PlaceAutocompleteElement` or `AutocompleteSuggestion` from the new Places API |
| Google Maps Drawing Library | Using `DrawingManager` (deprecated Aug 2025, removed May 2026) | Use Terra Draw or native `google.maps.Polygon` with custom click handlers |
| Google Maps API key | Unrestricted key in widget bundle | Apply HTTP referrer restrictions + API-specific restrictions; set billing alerts |
| Google Maps geometry library | Passing `computeArea()` result directly to pricing formula | Convert m² to sqft (`* 10.7639`) then apply pitch multiplier in a single named function |
| Google Maps session tokens | Not creating or reusing session tokens across address lookups | Create new token on input focus, pass to all autocomplete + Place Details calls, discard after selection |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous email sending on form submission | Submission response time increases as email provider latency varies | Queue email sending asynchronously (background job or serverless function) | Immediately -- email APIs have 200-2000ms latency that blocks the user response |
| Serving widget JS from application server | Slow widget load, server overload during traffic spikes | Serve widget assets from a CDN (CloudFront, Cloudflare) with aggressive caching | 50+ concurrent widget loads |
| No CDN cache-busting strategy | Customers see stale widget after updates | Use content-hashed filenames (`widget.abc123.js`) and update the loader script to point to new hashes | First widget update |
| Storing all leads in a single database table without indexing | Lead queries slow down, notification emails delayed | Add composite index on `(tenant_id, created_at)` from day one | 10,000+ leads across all tenants |
| Eager Google Maps API load on widget init | Every page view loads 400KB+ Maps API even if user never reaches map step | Dynamically import Maps API only when user reaches the map step in the flow | Immediately -- every host page load penalized |
| Autocomplete without session tokens | API costs 5-10x higher than necessary; per-request billing instead of session billing | Implement session tokens from day one | Every autocomplete interaction without session tokens |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Widget API endpoint accepts submissions without origin validation | Anyone can POST fake leads to any roofing company's account | Validate `Origin`/`Referer` headers against the tenant's registered domain(s); also allow the tenant's staging domains |
| Tenant settings API accessible without authentication | Competitor or attacker reads/modifies a roofing company's pricing | All settings endpoints require authentication; widget embed uses a public read-only token, not the admin API key |
| Lead data (PII) transmitted over HTTP | Homeowner names, emails, phone numbers intercepted in transit | Enforce HTTPS-only on all endpoints; HSTS header; reject HTTP requests |
| Admin panel accessible by guessing tenant IDs | Sequential or guessable tenant IDs allow unauthorized access | Use UUIDs for tenant IDs; require authentication on all admin routes; rate-limit login attempts |
| No rate limiting on submission endpoint | DDoS via lead spam; database fills with junk | Rate limit by IP (3/hour), by tenant (100/day), with override capability for high-volume tenants |
| Unrestricted Google Maps API key | Attacker uses key for expensive APIs (Street View, Routes, Geocoding) at your expense | Apply HTTP referrer restrictions to allowed domains + restrict key to Maps JS API and Places API (New) only |
| Google Maps API key committed to git without restrictions | Permanent exposure -- git history persists even after deletion | Rotate compromised key immediately; use environment variables; never commit API keys |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Asking for square footage first without explaining why | Homeowners don't know their roof's square footage and abandon | Ask address first (familiar), then explain "Roof size helps us estimate -- if you're not sure, here's how to find it" with a help link |
| Showing a single price number ("$12,500") | Homeowner anchors on the exact number and feels deceived when the quote differs | Show a range ("$10,000 - $15,000") with a disclaimer that a final quote requires an inspection |
| Requiring phone number as mandatory | Privacy-conscious users abandon the form; phone is the highest-friction field | Make phone optional but explain "Adding your phone helps [Company Name] reach you faster" -- conversion rate increases when it's optional |
| Using a progress bar that doesn't reflect actual steps | Users feel misled when "Step 3 of 3" is followed by another step | Show all steps upfront (e.g., "Roof Details > Contact Info > Your Estimate") and be honest about count |
| Showing the estimate only after email submission | Feels like a bait-and-switch; homeowner wanted information, not a sales pitch | Show the estimate immediately on submission; the roofing company still gets the lead, and the homeowner feels they received value |
| Widget has its own scrollbar inside an iframe | Double-scroll (host page + widget iframe) is disorienting on mobile | Use `postMessage` to communicate height and make the iframe borderless and scrollbar-free |
| No "skip map" option in the map step | Homeowners without a recognizable address (new construction, rural) or those who just want to enter sqft are stuck | Provide a prominent "Enter size manually instead" link at the top of the map step -- never gate manual entry behind the map |
| Map defaults to standard road view instead of satellite | User sees street map and can't trace their roof; confused about what they're supposed to do | Always default to satellite (`mapTypeId: 'satellite'`) and disable the map type toggle to reduce confusion |
| Drawing mode active by default on mobile | First tap pans the map instead of drawing, or places an unwanted vertex | Start in Pan Mode on mobile; show a clear "Start Drawing" button that switches to Draw Mode with instructions |
| No undo/clear for polygon drawing | User makes a mistake placing a vertex and must start over; abandons the feature | Add an "Undo last point" button and a "Clear and restart" button during polygon drawing |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Email delivery:** Works in dev but not verified with a real roofing company email (GoDaddy, Outlook, Yahoo) -- test with actual customer email providers
- [ ] **Consent checkbox:** Present but consent text doesn't name the specific roofing company -- verify it dynamically inserts the tenant's company name
- [ ] **Pricing formula:** Returns a number but hasn't been validated against actual roofing quotes -- compare output to 5+ real contractor estimates
- [ ] **Mobile embed:** Responsive in standalone mode but not tested embedded on a real mobile site -- test on an actual WordPress/Wix site on a real phone
- [ ] **Widget styling:** Looks correct on your test page but not tested on sites with aggressive CSS resets -- embed on a Bootstrap site, a Tailwind site, and a plain HTML site
- [ ] **Lead email:** Arrives in your inbox but not tested against spam filters -- check Gmail, Outlook.com, Yahoo, and a GoDaddy-hosted email
- [ ] **Settings page:** Saves settings but doesn't preview what the widget will look like -- add a live preview so roofers can see changes before publishing
- [ ] **Error handling:** Happy path works but no feedback when API is down -- widget should show "Unable to generate estimate, please try again" not a blank screen
- [ ] **Rate limiting:** Exists on the API but not tested with actual bot traffic -- run a load test simulating 100 rapid submissions
- [ ] **Drawing Library:** Polygon drawing works but uses deprecated `DrawingManager` -- verify implementation uses Terra Draw or native Polygon overlays, not `google.maps.drawing`
- [ ] **Session tokens:** Autocomplete suggestions appear but no session token is being created or passed -- verify token creation on input focus and termination on place selection
- [ ] **Unit conversion:** Area calculation returns a number but it's in m², not sqft -- verify `computeArea()` result is multiplied by 10.7639 before passing to pricing formula
- [ ] **API key restrictions:** Map loads in dev but API key is unrestricted -- verify HTTP referrer restrictions and API restrictions are active in Google Cloud Console before shipping
- [ ] **Maps failure fallback:** Map loads in dev but there's no fallback when Maps fails to load (CSP block, network error) -- verify manual sqft entry is shown automatically on Maps load failure
- [ ] **MaxZoomService check:** Map displays for all addresses but no zoom-level warning for rural addresses -- verify MaxZoomService is called and low-zoom warning is shown when max zoom < 19

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| CSS conflicts on host sites | LOW (if Shadow DOM was used) / HIGH (if not) | If Shadow DOM: debug the specific inheritance issue. If no Shadow DOM: rewrite rendering layer to use Shadow DOM -- this is a near-complete rewrite of the widget frontend |
| Emails landing in spam | MEDIUM | Switch to Postmark if not already; warm up sending domain over 2 weeks; contact affected customers and offer manual lead delivery during transition |
| Inaccurate price estimates | LOW | Adjust default multipliers; reach out to affected roofing companies to help calibrate their overrides; add more prominent disclaimers |
| TCPA consent violation | HIGH | Engage legal counsel immediately; audit all stored consent records; notify affected roofing companies; implement proper consent architecture; this cannot be fixed retroactively for past leads |
| Tenant data leak | HIGH | Incident response: identify scope of leak, notify affected tenants and homeowners (breach notification may be legally required), implement RLS if not present, audit all queries |
| Bot spam flood | LOW | Enable reCAPTCHA v3; purge fake leads from database; notify affected roofing companies which leads were fake; add honeypot fields |
| Google Maps API key compromised / billing spike | MEDIUM | Rotate key immediately in Google Cloud Console; update environment variables; review billing to identify abuse period; add restrictions to new key; file billing dispute with Google if abuse was external |
| Drawing Library deprecation (code stops working May 2026) | HIGH (if not caught early) | Rewrite polygon drawing using Terra Draw or native Polygon overlays; this is a near-complete rewrite of the drawing feature with no backward compatibility |
| Area calculation unit bug found post-launch | LOW | Fix conversion, add unit test; recalculate and discard any affected leads with bad sqft values; notify affected roofing companies |
| Autocomplete session token missing (billing overrun) | LOW | Add session token logic; billing overrun stops immediately; no data loss but past overcharges are non-recoverable |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| CSS bleed / style isolation | Phase 1 (Widget Foundation) | Widget renders identically on 5+ different host site templates |
| Widget performance / bundle size | Phase 1 (Widget Foundation) | Bundle < 50KB gzipped; Lighthouse impact < 5 points on host site |
| Mobile responsive embedding | Phase 1 (Widget Foundation) | Widget tested embedded on real mobile devices across 3 platforms |
| CSP compatibility | Phase 1 (Widget Embedding) | Widget loads successfully on WordPress, Wix, Squarespace, GoDaddy, raw HTML |
| Tenant data isolation | Phase 1 (Database Schema) | RLS policies active; automated test proves cross-tenant query returns zero rows |
| Pricing inaccuracy | Phase 1-2 (Formula + Settings) | Default estimates within 25% of actual quotes for 3 test markets |
| Email deliverability | Phase 2 (Lead Notification) | Test emails arrive in inbox (not spam) on Gmail, Outlook, Yahoo, GoDaddy email |
| TCPA consent compliance | Phase 2 (Lead Capture Form) | Consent text dynamically includes tenant company name; timestamped record stored; checkbox unchecked by default |
| Bot spam protection | Phase 2 (Lead Capture) | Honeypot + rate limiting active; submission timing validated server-side |
| Embed difficulty for non-technical users | Phase 3 (Onboarding) | Non-technical tester can embed widget on WordPress within 10 minutes without help |
| Drawing Library deprecation | Maps Phase 1 (API setup) | No `google.maps.drawing` in codebase; polygon drawing uses Terra Draw or native overlays |
| Legacy Places API unavailability | Maps Phase 1 (API setup) | No `google.maps.places.Autocomplete` or `AutocompleteService` in codebase |
| PlaceAutocompleteElement Shadow DOM conflict | Maps Phase 1 (Autocomplete implementation) | Autocomplete styled consistently with widget; dropdown visible above host page elements |
| API key unrestricted | Maps Phase 1 (API key setup) | Google Cloud Console shows HTTP referrer + API restrictions active before first commit |
| Session token mismanagement | Maps Phase 1 (Autocomplete implementation) | Token created on focus, passed to Place Details, discarded after selection; verified in billing console |
| Eager Maps API loading | Maps Phase 1 (API loading architecture) | Network tab shows zero Maps API requests on initial widget load; load triggered only on map step |
| Mobile touch conflicts | Maps Phase 2 (Polygon drawing) | Pan/Draw mode toggle present; tested on 3 real mobile devices; no accidental map pan during drawing |
| Rural imagery gaps | Maps Phase 2 (Map display) | MaxZoomService checked; warning shown for low-zoom addresses; manual entry accessible without going back |
| Area unit conversion | Maps Phase 2 (Area calculation) | Unit test: 200m² polygon returns ~2,153 sqft; pitch adjustment applied correctly |
| Maps CSP failure / no fallback | Maps Phase 3 (Error handling) | Widget shows manual entry fallback automatically when Maps API fails to load |

## Sources

### v1.0 Sources (Baseline Widget)

- [Why Roof Replacement Cost Calculators Don't Add Up](https://hdroofers.com/roof-replacement-cost-calculator-doesnt-add-up/) - roofing estimate accuracy, 20% average error
- [How Accurate Are Roofing Estimates? - Leap](https://leaptodigital.com/blog/how-accurate-are-roofing-estimates) - calculator limitations
- [Best practices for using third-party embeds - web.dev](https://web.dev/articles/embed-best-practices) - Google's embed performance guidance
- [8 Reasons Not to Embed Dashboards with iFrames](https://embeddable.com/blog/iframes-for-embedding) - iframe performance and UX issues
- [Shadow DOM vs. iFrame - Medium](https://medium.com/@blue___gene/shadow-dom-vs-iframe-a-philosophical-and-practical-exploration-of-embedding-on-the-web-c5369031e54d) - embedding architecture comparison
- [Embeddable Web Applications with Shadow DOM - Viget](https://www.viget.com/articles/embedable-web-applications-with-shadow-dom) - Shadow DOM for widget isolation
- [Web Components: Working With Shadow DOM - Smashing Magazine](https://www.smashingmagazine.com/2025/07/web-components-working-with-shadow-dom/) - Shadow DOM patterns
- [Build an Embeddable Widget using Preact and Shadow DOM - DEV](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm) - Preact + Shadow DOM implementation
- [Best Practices on Embedding Third-Party Web Widgets - Bits and Pieces](https://blog.bitsrc.io/best-practices-for-web-embeds-a65416a21fc2) - widget embedding patterns
- [Postmark vs. SendGrid Comparison](https://postmarkapp.com/compare/sendgrid-alternative) - email deliverability comparison
- [SendGrid Email Deliverability Report 2025](https://www.emaildeliverabilityreport.com/en/deliverability/sendgrid/2025/08/) - 77% inbox placement rate
- [Lead Generation Fraud Guide 2026 - LeadsHook](https://www.leadshook.com/blog/lead-generation-fraud/) - bot spam and fake lead prevention
- [The Rise of AI-Powered Spam Form Fills - Enilon](https://www.enilon.com/blog/the-rise-of-ai-powered-spam-form-fills-its-affect-on-lead-gen/) - AI-generated spam submissions
- [TCPA Compliant Lead Generation 2025 - Phonexa](https://phonexa.com/blog/tcpa-compliant-lead-generation/) - consent requirements
- [FCC Closes TCPA Lead Generator Loophole - Orrick](https://www.orrick.com/en/Insights/2023/12/FCC-Closes-TCPA-Lead-Generator-Loophole-Requires-One-to-One-Consent) - one-to-one consent mandate
- [Tenant Isolation - AWS SaaS Architecture Fundamentals](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html) - multi-tenant isolation patterns
- [Data Isolation in Multi-Tenant SaaS - Redis](https://redis.io/blog/data-isolation-multi-tenant-saas/) - tenant data isolation strategies

### v1.1 Google Maps Sources

- [Google Maps Platform Deprecations](https://developers.google.com/maps/deprecations) - Drawing Library deprecated Aug 2025, removed May 2026; Places legacy unavailable to new customers Mar 2025 — HIGH confidence
- [Drawing Library Is Deprecated -- Migration Discussion](https://github.com/visgl/react-google-maps/discussions/825) - Terra Draw as recommended replacement — MEDIUM confidence
- [Mastering Google's New Places API: Shadow DOM Styling](https://juancrg90.me/posts/mastering-google-places-new-api/) - closed Shadow DOM conflicts, monkey-patch approach risks — HIGH confidence (practical implementation article with verified issues)
- [Places Autocomplete New API - Google Docs](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) - PlaceAutocompleteElement official documentation — HIGH confidence
- [Legacy Places Autocomplete Unavailable to New Customers - GitHub Issue](https://github.com/visgl/react-google-maps/issues/736) - confirmed Mar 2025 cutoff — HIGH confidence (reported by multiple developers)
- [Autocomplete Session Pricing - Google Docs](https://developers.google.com/maps/documentation/javascript/session-pricing) - session token mechanics and billing model — HIGH confidence
- [Google Maps Platform Pricing](https://developers.google.com/maps/billing-and-pricing/pricing) - per-request vs session billing rates — HIGH confidence
- [Google Maps Security Best Practices](https://developers.google.com/maps/api-security-best-practices) - API key restrictions guidance — HIGH confidence
- [Content Security Policy Guide for Google Maps](https://developers.google.com/maps/documentation/javascript/content-security-policy) - required CSP domains and directives — HIGH confidence
- [Load Maps JavaScript API - Dynamic Import](https://developers.google.com/maps/documentation/javascript/load-maps-js-api) - `importLibrary()` lazy loading pattern — HIGH confidence
- [Google Maps Map Interaction / gestureHandling](https://developers.google.com/maps/documentation/javascript/interaction) - cooperative/greedy/none gesture modes — HIGH confidence
- [Google Maps MaxZoom Service](https://developers.google.com/maps/documentation/javascript/maxzoom) - checking max zoom before displaying map — HIGH confidence
- [Geometry Library computeArea](https://developers.google.com/maps/documentation/javascript/reference/geometry) - returns m², not sqft — HIGH confidence
- [Terra Draw - GitHub](https://github.com/JamesLMilner/terra-draw) - Drawing Library replacement with Google Maps support — MEDIUM confidence (active project, Google-endorsed alternative)
- [pac-container z-index conflicts in embedded contexts](https://github.com/twbs/bootstrap/issues/4160) - dropdown z-index issues in stacking contexts — MEDIUM confidence

---
*Pitfalls research for: Embeddable roofing estimate calculator SaaS -- v1.0 baseline + v1.1 Google Maps integration*
*Researched: 2026-03-09 (v1.0), 2026-03-10 (v1.1 Google Maps)*
