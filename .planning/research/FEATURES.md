# Feature Landscape

**Domain:** Embeddable Roofing Estimate Calculator SaaS (lead generation widget)
**Researched:** 2026-03-09
**Overall confidence:** MEDIUM-HIGH

## Table Stakes

Features users (both roofing companies AND homeowners) expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Address / location input | Every competitor asks for it; needed for regional pricing | Low | Text field, optionally with autocomplete later |
| Roof square footage input | Core variable for any estimate | Low | Numeric input with validation (typical range 1,000-5,000 sqft) |
| Roof pitch selection | Major cost factor; all competitors include it | Low | Dropdown or visual selector: Flat, Low (3-4/12), Medium (5-7/12), Steep (8-12/12) |
| Material type selection | Homeowners want to compare materials; drives price dramatically | Low | At minimum: 3-tab shingle, architectural shingle, metal |
| Contact info capture | Core value prop for roofing companies (lead generation) | Low | First name, last name, email, phone |
| Consent checkbox | Legal requirement for lead generation / communications | Low | Required before submit |
| Instant price range display | "Instant" is the category-defining feature; Roofle, Instant Roofer, Roofr all do this | Medium | Show as range (e.g., "$8,500 - $12,000") not a single number |
| Email lead notification | Roofing company must receive leads immediately | Medium | Email with all submitted details + estimate shown |
| Embeddable via script tag | Must work on any website (WordPress, Wix, Squarespace, custom) | Medium | Single `<script>` tag or iframe snippet |
| Mobile responsive | Many homeowners browse on phones; PROJECT.md constraint | Medium | Widget must render well at all viewport sizes |
| Company logo on widget | Basic branding; every competitor offers this | Low | Image upload in settings |
| Company color theming | Basic branding; competitors allow at least primary color | Low | Color picker in settings |

## Differentiators

Features that set the product apart from competitors. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pricing override controls | Let each roofing company set their own $/sqft, multipliers, and margins -- most competitors lock pricing or require contacting support | Medium | Settings page with per-material base cost, pitch multiplier overrides, margin % |
| Complexity factor selection | Most basic calculators ignore roof complexity; adding it increases estimate credibility | Low | Simple/Ranch, Average, Complex/Multi-level selector |
| Tear-off / existing layers option | Adds $1-3/sqft; improves accuracy and shows sophistication | Low | Toggle: "Does your roof have existing shingles to remove?" |
| Regional cost factor | Auto-adjusts pricing by state/region; most small competitors skip this | Medium | Lookup table by state, applied as multiplier (0.80 - 1.25x) |
| Estimate breakdown display | Show homeowners HOW the price was calculated (materials + labor + tear-off); builds trust | Medium | Optional detailed view below the price range |
| QR code generation | Roofr offers this -- lets companies put calculator on trucks, business cards, door hangers | Low | Generate QR linking to company's calculator instance |
| Multi-material comparison | Show prices for 2-3 material types side by side in results | Medium | Roofle does this well; high perceived value |
| Lead performance tracking | Which embed locations / channels generate the most leads | Medium | Analytics dashboard (v2 feature) |
| Webhook / Zapier integration | Let companies push leads to their CRM without custom dev | Medium | v2 feature; Roofr has native CRM, but most small companies use spreadsheets |
| Financing estimate | Show monthly payment estimate; Roofle offers this | Low | Simple calculation: total / months at typical APR |

## Anti-Features

Features to explicitly NOT build. These are traps.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Satellite / aerial roof measurement | Massive complexity (AI/ML, imagery APIs, accuracy liability); Instant Roofer and Roofr have invested millions here. Not a viable v1 differentiator. | Manual sqft entry. Revisit only if product achieves significant traction and revenue. |
| Full CRM / lead management dashboard | Scope creep; roofing companies already have tools or spreadsheets. Building CRM = building a different product. | Email notifications for v1. Webhook/Zapier for v2. |
| Payment processing / SaaS billing | Complex (Stripe integration, subscription management, dunning). Not needed to validate demand. | Handle billing offline/manually for v1. |
| WordPress plugin | Limits market to WordPress only; script embed works everywhere. | Script tag embed that works on any site. |
| Contractor marketplace / matching | Completely different business model (Instant Roofer does this). Conflicts with white-label value prop. | Each company gets their own branded widget. |
| Permit cost estimation | Varies wildly by municipality; impossible to maintain accurate data. | Mention "permit costs not included" in disclaimer. |
| Exact/guaranteed pricing | Creates liability. All competitors show ranges and include disclaimers. | Always show ranges. Include "estimate only" language. |
| Full theme control (fonts, spacing, layout) | Over-engineering for v1. Roofing companies care about logo and colors, not typography. | Logo + primary color for v1. Expand if demanded. |

## Feature Dependencies

```
Material Type Selection --> Pricing Formula (material drives base cost)
Roof Pitch Selection ----> Pricing Formula (pitch drives multiplier)
Complexity Selection ----> Pricing Formula (complexity drives multiplier)
Square Footage Input ----> Pricing Formula (base area input)
Tear-off Toggle ---------> Pricing Formula (adds per-sqft cost)
Regional Factor ---------> Pricing Formula (state-based multiplier)

Pricing Formula ---------> Price Range Display (formula output)
Contact Info Capture ----> Lead Email Notification (data to send)
Price Range Display -----> Lead Email Notification (include estimate in email)

Company Logo Upload -----> Widget Rendering (branding)
Company Color Setting ---> Widget Rendering (theming)
Pricing Overrides -------> Pricing Formula (company-specific adjustments)

Embeddable Script -------> Widget Rendering (delivery mechanism)
```

## MVP Recommendation

Prioritize (aligned with PROJECT.md):

1. **Estimate engine with pricing formula** -- This IS the product. Without credible estimates, nothing else matters.
2. **4-step widget flow** -- Address/sqft, roof details (pitch + complexity + material), contact info, results display.
3. **Email lead notification** -- Core value delivery to paying customer (the roofing company).
4. **Embeddable script tag** -- Distribution mechanism.
5. **Basic branding (logo + color)** -- Minimum viable white-labeling.
6. **Pricing override settings** -- Key differentiator; lets each company customize to their market.

Defer:
- **Regional cost factor**: Useful but can be approximated via pricing overrides per company. Add in v1.1.
- **Multi-material comparison in results**: Nice-to-have. v1 can show one material at a time.
- **QR code generation**: Trivial to add later, low priority.
- **Tear-off toggle**: Good accuracy boost, but adds form complexity. Consider for v1.1.
- **Lead analytics / tracking**: v2 feature after validating core product.
- **Webhook / Zapier**: v2 feature.

---

## Roofing Pricing Formulas and Standard Multipliers

This section provides the data needed to build the estimate engine.

### Core Estimate Formula

```
Estimated Cost = Base Material Cost per SqFt
               x Roof Square Footage
               x Pitch Multiplier
               x Complexity Multiplier
               x (1 + Waste Factor)
               x Regional Factor (optional)
               + Tear-off Cost (optional)
               + Margin/Markup
```

For a consumer-facing estimate, simplify to:

```
Low Estimate  = (sqft x pitch_mult x complexity_mult x material_cost_low)  x (1 + waste)
High Estimate = (sqft x pitch_mult x complexity_mult x material_cost_high) x (1 + waste)
```

The range naturally accounts for labor variation, regional differences, and contractor margin without needing to expose those variables to the homeowner.

### Material Base Costs (Installed, per Square Foot, 2026)

These are national averages including labor and materials. Sources: HomeGuide, Modernize, FieldCamp, ThisOldHouse (2025-2026 data).

| Material | Cost Low ($/sqft) | Cost High ($/sqft) | Notes |
|----------|-------------------|---------------------|-------|
| 3-Tab Asphalt Shingles | $3.50 | $4.75 | Most affordable, 15-20 year lifespan |
| Architectural Asphalt Shingles | $4.00 | $5.75 | Most popular choice, 25-30 year lifespan |
| Premium Asphalt Shingles | $4.50 | $6.00 | 50-year warranty options |
| Metal (Corrugated/Panels) | $6.00 | $8.50 | Budget metal option |
| Metal Shingles | $7.50 | $10.50 | Metal look with shingle profile |
| Standing Seam Metal | $12.00 | $18.00 | Premium metal, 40-70 year lifespan |
| Concrete Tile | $6.50 | $10.00 | Mediterranean aesthetic |
| Clay Tile | $11.00 | $22.00 | Premium tile, regional popularity |
| Natural Slate | $15.00 | $30.00 | Ultra-premium, 75-100+ year lifespan |

**Recommendation for v1:** Offer 3-tab shingles, architectural shingles, and standing seam metal as the default material options. These cover the vast majority of residential projects. Let companies add/remove materials via settings.

### Roof Pitch Multipliers

Pitch multipliers account for the increased surface area of a sloped roof compared to its flat footprint. Derived from Pythagorean theorem: `sqrt((rise/12)^2 + 1)`.

| Pitch Category | Pitch Range | Multiplier | Used In Calculator As |
|----------------|-------------|------------|----------------------|
| Flat | 0-2/12 | 1.00 | "Flat" |
| Low | 3/12 | 1.03 | "Low Slope" |
| Low | 4/12 | 1.05 | "Low Slope" |
| Medium | 5/12 | 1.08 | "Medium" |
| Medium | 6/12 | 1.12 | "Medium" |
| Steep | 7/12 | 1.16 | "Steep" |
| Steep | 8/12 | 1.20 | "Steep" |
| Very Steep | 9/12 | 1.25 | "Steep" |
| Very Steep | 10/12 | 1.30 | "Steep" |
| Very Steep | 12/12 | 1.41 | "Steep" |

**Recommendation for v1 simplified categories:**

| User Selection | Multiplier Used | Rationale |
|----------------|-----------------|-----------|
| Flat | 1.00 | No slope adjustment |
| Low (3-4/12) | 1.05 | Midpoint of low range |
| Medium (5-7/12) | 1.12 | Midpoint of medium range; 6/12 is most common residential pitch |
| Steep (8-12/12) | 1.25 | Conservative midpoint; accounts for extra labor difficulty |

Confidence: HIGH -- pitch multipliers are derived from geometry and consistent across all sources.

### Complexity Multipliers

Complexity accounts for extra labor time, waste, and difficulty from roof design features (hips, valleys, dormers, multiple levels). These are NOT standardized across the industry -- they are contractor rules of thumb.

| Complexity Level | Multiplier | Description | Waste Factor |
|------------------|------------|-------------|--------------|
| Simple / Ranch | 1.00 | Gable roof, 1-2 planes, no dormers, no valleys | 10% |
| Average | 1.15 | Hip roof or gable with 1-2 valleys, minor features | 12-15% |
| Complex / Multi-level | 1.35 | Multiple dormers, many valleys/hips, steep sections, multi-story | 15-20% |

**Recommendation for v1:** Use the multiplier AND build the waste factor into it (don't expose waste as a separate input). So:

| User Selection | Effective Multiplier (includes waste) |
|----------------|---------------------------------------|
| Simple / Ranch | 1.10 (1.00 x 1.10 waste) |
| Average | 1.32 (1.15 x 1.15 waste) |
| Complex | 1.58 (1.35 x 1.17 waste) |

Confidence: MEDIUM -- complexity multipliers vary by contractor. These are reasonable midpoints from multiple sources but companies should be able to override.

### Tear-Off / Removal Costs

| Scenario | Additional Cost per SqFt |
|----------|--------------------------|
| No existing roof (new construction) | $0.00 |
| Single layer tear-off (most common) | $1.00 - $1.50 |
| Two layer tear-off | $1.50 - $3.00 |
| Heavy material tear-off (tile, slate) | $3.00 - $5.00 |

**Recommendation for v1:** If including tear-off toggle, add a flat $1.25/sqft to both low and high estimates when "existing shingles" is selected. Keep it simple.

### Regional Cost Multipliers (by State)

These adjust national average pricing to local market conditions. Source: RoofObservations.com (construction cost index data).

| Region | States | Multiplier Range |
|--------|--------|-----------------|
| High Cost | CA, CT, MA, NY, HI, AK | 1.15 - 1.25 |
| Above Average | IL, NJ, OR, WA, DE, RI, MN | 1.05 - 1.11 |
| Average | MI, WI, IA, PA, MO, NV, NH | 0.93 - 1.03 |
| Below Average | IN, KS, CO, MT, ND, OH, WV, MD | 0.90 - 0.95 |
| Low Cost | AL, AR, FL, GA, ID, KY, LA, ME, MS, NC, NE, NM, OK, SC, TN, TX, UT, VA, VT, WY, AZ, SD | 0.80 - 0.89 |

**Full state-level multiplier table (for implementation):**

| State | Factor | State | Factor | State | Factor |
|-------|--------|-------|--------|-------|--------|
| AL | 0.88 | LA | 0.82 | OH | 0.92 |
| AK | 1.25 | ME | 0.86 | OK | 0.83 |
| AZ | 0.86 | MD | 0.93 | OR | 1.08 |
| AR | 0.80 | MA | 1.18 | PA | 0.96 |
| CA | 1.15 | MI | 1.03 | RI | 1.07 |
| CO | 0.91 | MN | 1.06 | SC | 0.86 |
| CT | 1.18 | MS | 0.80 | SD | 0.89 |
| DE | 1.05 | MO | 0.95 | TN | 0.85 |
| FL | 0.85 | MT | 0.91 | TX | 0.82 |
| GA | 0.88 | NE | 0.88 | UT | 0.89 |
| HI | 1.20 | NV | 0.95 | VT | 0.85 |
| ID | 0.88 | NH | 0.93 | VA | 0.85 |
| IL | 1.10 | NJ | 1.11 | WA | 1.05 |
| IN | 0.90 | NM | 0.88 | WV | 0.93 |
| IA | 0.97 | NY | 1.18 | WI | 0.99 |
| KS | 0.90 | NC | 0.80 | WY | 0.90 |
| KY | 0.87 | ND | 0.92 | National Avg | 1.00 |

**Recommendation for v1:** Do NOT auto-apply regional factors. Instead, let each roofing company's pricing overrides implicitly capture their regional costs. Add auto-regional-adjustment as a v1.1 feature for companies that want to use default pricing. Store the table for future use.

Confidence: MEDIUM -- these are approximate construction cost indices, not roofing-specific multipliers. They are directionally correct but rough.

### Example Calculations

**Example 1: Basic ranch home, architectural shingles**
- Square footage: 1,800 sqft (footprint)
- Pitch: Medium (6/12) -- multiplier: 1.12
- Complexity: Simple -- effective multiplier (with waste): 1.10
- Material: Architectural shingles ($4.00 - $5.75/sqft)

```
Low:  1,800 x 1.12 x 1.10 x $4.00 = $8,870
High: 1,800 x 1.12 x 1.10 x $5.75 = $12,751
Display: "$8,900 - $12,800" (rounded to nearest $100)
```

**Example 2: Complex multi-level, standing seam metal**
- Square footage: 2,500 sqft
- Pitch: Steep (8/12) -- multiplier: 1.25
- Complexity: Complex -- effective multiplier (with waste): 1.58
- Material: Standing seam metal ($12.00 - $18.00/sqft)

```
Low:  2,500 x 1.25 x 1.58 x $12.00 = $59,250
High: 2,500 x 1.25 x 1.58 x $18.00 = $88,875
Display: "$59,300 - $88,900"
```

**Example 3: Average home, 3-tab shingles (budget option)**
- Square footage: 1,500 sqft
- Pitch: Low (4/12) -- multiplier: 1.05
- Complexity: Average -- effective multiplier (with waste): 1.32
- Material: 3-tab shingles ($3.50 - $4.75/sqft)

```
Low:  1,500 x 1.05 x 1.32 x $3.50 = $7,277
High: 1,500 x 1.05 x 1.32 x $4.75 = $9,876
Display: "$7,300 - $9,900"
```

### Formula Implementation Notes

1. **Always show ranges** -- never a single number. This manages expectations and reduces liability.
2. **Round to nearest $100** -- false precision ($8,873.42) looks algorithmic and untrustworthy to homeowners.
3. **Include disclaimer** -- "This is an estimate only. Final pricing requires an on-site inspection." Every competitor does this.
4. **Let companies override everything** -- base costs, multipliers, margins. The default formula gets companies started, but their local expertise should drive final numbers.
5. **Consider a "confidence buffer"** -- widen the range by 10-15% on each side. Better to under-promise. A $10,000-$14,000 range that contains the actual bid price builds more trust than a $11,000-$12,500 range that misses.

---

## Competitive Landscape Summary

### Roofr (Instant Estimator)
- **Model:** Full roofing SaaS platform with embeddable estimator as an add-on
- **Key features:** Satellite roof measurement, CRM, proposal generation, instant estimator widget
- **Pricing:** Tiered SaaS plans; estimator is add-on to any plan
- **Strengths:** Full platform, address-based measurement, lead-to-CRM pipeline
- **Weakness for our market:** Expensive and complex for small companies that just want leads. Overkill.
- **Source:** [Roofr Estimator Guide](https://roofr.com/blog/roofr-instant-estimator-guide), [Roofr Pricing](https://roofr.com/pricing)

### Roofle
- **Model:** Instant quote tool using satellite imagery
- **Key features:** Address-based measurement, multi-material comparison, financing estimates, brand-specific products (CertainTeed, Owens Corning)
- **Strengths:** Product-specific pricing, financing integration
- **Weakness for our market:** Focused on specific manufacturer partnerships, less accessible for independent contractors
- **Source:** [How to Use Roofle](https://www.lnshomeimprovements.com/how-to-use-roofle-roof-cost-calculator/), [Instant Quote via Roofle](https://bestexteriorsinc.com/blog/instant-roof-quote/)

### Instant Roofer
- **Model:** AI-powered measurement + contractor marketplace
- **Key features:** No-signup estimate, AI roof scanning (98% accuracy claim), contractor matching, embeddable widget
- **Strengths:** Privacy-focused (no info required for estimate), AI measurement
- **Weakness for our market:** Marketplace model conflicts with white-label approach; they match to THEIR contractors
- **Source:** [Instant Roofer](https://www.instantroofer.com/), [Embed Features](https://www.instantroofer.com/instant-roofer-embed-enhancements-and-features/)

### SimpleRoof Estimates
- **Model:** Embeddable lead generation widget (closest competitor to our product)
- **Key features:** 4-step form flow, instant estimate, lead capture
- **Minimal web presence** -- could not find detailed feature documentation. Appears to be a smaller player.
- **Source:** [simpleroofestimates.com](https://simpleroofestimates.com) (limited information available)

### Our Positioning
The gap in the market: **a simple, affordable, embeddable estimate widget that small roofing companies can set up in minutes with their own branding and pricing.** Roofr is a full platform (expensive, complex). Roofle is manufacturer-focused. Instant Roofer is a marketplace. SimpleRoof Estimates is the closest competitor but appears to have limited features. Our product targets the "just give me a lead capture widget" niche with the added value of customizable pricing formulas.

---

## Sources

- [FieldCamp: How to Price a Roofing Job](https://fieldcamp.ai/blog/how-to-price-a-roofing-job/) -- pricing formula, material costs, pitch multipliers
- [HomeGuide: Roof Replacement Cost 2026](https://homeguide.com/costs/roof-replacement-cost) -- material pricing data
- [HomeGuide: Roofing Material Prices 2026](https://homeguide.com/costs/roofing-material-prices) -- per-sqft costs
- [RoofObservations: Construction Costs by State](https://roofobservations.com/relative-construction-costs-by-state/) -- regional multipliers
- [Roofr: Instant Estimator Guide](https://roofr.com/blog/roofr-instant-estimator-guide) -- competitor features
- [Roofr: Waste Factor Guide](https://roofr.com/blog/how-to-calculate-roof-waste-factor) -- waste percentages
- [Ridgeline Roofing: 2026 Costs](https://ridgeline-roofing.com/news/roof-replacement-costs-in-2026-what-homeowners-should-expect/) -- 2026 pricing trends
- [Rhoden Roofing: Pitch Multipliers](https://rhodenroofing.com/pitch-multiplier-roofing-terms-that-impacts-roof/) -- pitch factor reference
- [Instant Roofer](https://www.instantroofer.com/) -- competitor analysis
- [Roofle](https://www.roofle.com/) -- competitor analysis
