---
id: "14-invoicing-module"
title: "Invoicing Module"
status: "pending"
priority: 12
assigned_pm: null
depends_on: ["04-company-module", "08-session-module"]
unlocks: []
estimated_complexity: "medium"
---

# Invoicing Module

## Summary
Implement session-based invoicing with configurable rate cards. Invoicing is derivative (based on sessions), not a primary data source. Produces simple, auditable CSV outputs.

## Objective
Enable users to generate invoices from tracked sessions for client billing.

## Key Deliverables
- Rate card management (hourly rates per company/project)
- Invoice generation from sessions
- Invoice preview page
- Invoice period selection (typically monthly)
- CSV export
- Invoice history

## Success Criteria
- [ ] Can configure rate cards
- [ ] Can generate invoice for date range
- [ ] Invoice shows session breakdown
- [ ] Can export to CSV
- [ ] Totals are calculated correctly

## Architecture Reference

From spec section 2.11:
- Derivative, not primary data
- Based on sessions
- Grouped by time period (typically monthly)
- Uses configurable hourly rate cards
- Produces simple, auditable outputs (CSV)
- Not an accounting system

## Quick Links
- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM
When decomposing this project:
1. Rate cards are the configuration point
2. Invoice is a view over sessions, not separate data
3. CSV export is the primary output format
4. Keep it simple - not accounting software
