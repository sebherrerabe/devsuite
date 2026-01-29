---
id: '13-performance-module'
title: 'Performance Signals'
status: 'pending'
priority: 11
assigned_pm: null
depends_on: ['08-session-module', '10-pr-review-module']
unlocks: []
estimated_complexity: 'medium'
---

# Performance Signals Module

## Summary

Implement performance signal collection and visualization. DevSuite collects raw signals but avoids premature judgement - interpretation is left to the user (and later, AI assistance).

## Objective

Provide visibility into work patterns through objective metrics.

## Key Deliverables

- Signal collection from sessions, tasks, reviews
- Signal storage in Convex
- Performance dashboard page
- Time-based charts (daily, weekly, monthly)
- Metrics: time per task, time per project, complexity vs effort
- Context switching frequency
- Review load tracking

## Success Criteria

- [ ] Signals are collected automatically
- [ ] Dashboard shows key metrics
- [ ] Can filter by date range
- [ ] Can filter by project/company
- [ ] No judgement labels ("good"/"bad")

## Architecture Reference

From spec section 2.9/2.10:

- Collects raw signals, avoids premature judgement
- Examples: time per task, time per project, complexity vs actual effort, context switching, review load
- Interpretation left to user (and later AI)

## Quick Links

- [Scope](./SCOPE.md) _(to be created by AI PM)_
- [Dependencies](./DEPENDENCIES.md) _(to be created by AI PM)_
- [Tasks](./TASKS.md) _(to be created by AI PM)_
- [Status](./STATUS.md) _(to be created by AI PM)_

## Notes for AI PM

When decomposing this project:

1. Focus on data collection first, then visualization
2. Charts should be clear and informative
3. Avoid gamification or judgement
4. Consider export for further analysis
