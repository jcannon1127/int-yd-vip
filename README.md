# Yoga Democracy VIP Membership (`int_yd_vip`)

Two-tier paid VIP membership for the Yoga Democracy SFCC B2C storefront.

| Tier | Fee | Everyday | Welcome (first order) |
|------|-----|----------|------------------------|
| Silver | $15/mo | 30% off | 60% off — `WELCOME60` |
| Gold | $30/mo | 40% off | 80% off — `WELCOME80` (+ free item/mo) |

## Structure
- `cartridges/int_yd_vip/` — controllers (`VIP.js`), membership service, Cybersource recurring-billing job (mock mode), ISML templates, client assets
- `metadata/` — Profile & SitePreferences custom attributes, `VIPBillingLedger` custom object, Cybersource service definition
- `docs/VIP Membership - Developer Handoff.pdf` — full install + BM config guide, the instant-pricing (dynamic customer group) recommendation, and open items

## Quick start
1. Add `int_yd_vip` to your code version + site cartridge path; reactivate.
2. Import `metadata/` via Site Import & Export.
3. Recreate the BM config (customer groups, promotions, coupons, campaigns, content assets) per the handoff PDF.

## Open items
- Instant member pricing on join → dynamic customer groups (see PDF §5)
- Cybersource dev credentials for real billing (currently mock mode)
- Gold monthly free-item job

Built in sandbox BLZZ_003, July 2026.
