---
id: '14-invoicing-module'
title: 'Invoicing Module'
status: 'pending'
priority: 12
assigned_pm: null
depends_on: ['04-company-module', '08-session-module']
unlocks: []
estimated_complexity: 'medium'
---

# Invoicing Module

## Summary

Implement session-based invoicing with configurable rate cards and rounding policies. Invoicing is derivative (based on ended sessions + task effective time), not a primary data source. Produces simple, auditable CSV outputs via immutable invoice snapshots (including multi-rate lines per day when work spans rates).

## Objective

Enable users to generate invoices from tracked sessions for client billing.

## Key Deliverables

- Rate card management (hourly rates per company/project)
- Rounding configuration (company default + per-project override)
- Invoice generation from sessions
- Invoice preview page
- Invoice period selection (typically monthly)
- CSV export
- Invoice history

## Success Criteria

- [ ] Can configure rate cards
- [ ] Can generate invoice for date range
- [ ] Invoice shows per-day per-rate summary and session breakdown
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

- [Scope](./SCOPE.md)
- [Dependencies](./DEPENDENCIES.md)
- [Tasks](./TASKS.md)
- [Status](./STATUS.md)

## Notes for AI PM

When decomposing this project:

1. Rate cards are the configuration point
2. Invoices are snapshots derived from sessions/tasks (not separate source-of-truth)
3. CSV export is the primary output format
4. Multi-project invoices imply multi-rate day lines
5. Day grouping uses user timezone; sessions without tasks are not billable
6. Keep it simple - not accounting software
