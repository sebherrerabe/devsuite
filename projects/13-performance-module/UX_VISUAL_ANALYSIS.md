# UX Visual Analysis: Performance Module

## Goal

Improve scanability and insight speed by shifting the page from table-first to visual-first, while preserving raw-data transparency.

## Design Principles

- Start with trend and change, not static totals.
- Keep "overview -> diagnosis -> detail" information hierarchy.
- Use one primary visual encoding per section (avoid mixed metaphors).
- Preserve deterministic, auditable numbers (tooltips/tables remain accessible).
- Avoid judgement language; emphasize neutral signals.

## Section-by-Section Recommendations

### 1) KPI Overview (Focus, Sessions, Tasks, Reviews, Context Switches)

- **Current pattern**: static metric cards.
- **Recommended pattern**:
  - KPI cards with a mini sparkline for the selected period.
  - Delta chip vs previous period (e.g., `+12%`, `-8%`) with neutral color semantics.
  - Clickable cards to filter/highlight the relevant downstream charts.
- **Why**: adds trend context without forcing users into charts first.

### 2) Focus Trend (Daily/Weekly/Monthly)

- **Current pattern**: horizontal bars.
- **Recommended pattern**:
  - Daily: line chart with area fill and optional rolling average.
  - Weekly/monthly: stacked columns (focus + non-focus session time optional).
  - Brush/range selector for fast zooming.
- **Why**: line/area communicates temporal continuity better than repeated bars.

### 3) Top Projects by Focus Time

- **Current pattern**: ranked list.
- **Recommended pattern**:
  - Horizontal bar ranking with normalized scale.
  - Toggle between absolute minutes and percentage share.
  - Optional "Others" bucket to avoid long tails.
- **Why**: relative contribution is easier to compare visually.

### 4) Complexity vs Effort

- **Current pattern**: tabular rows.
- **Recommended pattern**:
  - Scatter plot:
    - X-axis: complexity score
    - Y-axis: focus minutes
    - Bubble size: number of sessions touching task
    - Color: task status
  - Add reference trend line (minutes per point baseline).
  - Keep table below as drilldown.
- **Why**: correlation/outliers are nearly impossible to detect in tables alone.

### 5) Review Load

- **Current pattern**: summary cards + repository table.
- **Recommended pattern**:
  - Calendar heatmap for reviews/day.
  - Repository distribution donut or sorted bars.
  - Toggle: linked vs unlinked review share.
- **Why**: load concentration across days/repos becomes immediately visible.

### 6) Daily Breakdown Table

- **Current pattern**: full detail table.
- **Recommended pattern**:
  - Keep table, but move into "Details" accordion/drawer.
  - Add sticky header + column sort.
  - Add export button (CSV) for audit workflow.
- **Why**: keeps precision available without dominating the layout.

## Page Information Architecture (Recommended)

1. Sticky filter bar (date range, project, granularity, compare toggle).
2. KPI band with mini trends.
3. Primary chart: Focus trend (large, first fold).
4. Secondary two-column area:
   - Left: Project share chart
   - Right: Review load chart
5. Diagnostic area:
   - Complexity vs effort scatter + outlier list
6. Collapsible details:
   - Daily breakdown table + raw metrics export

## Interaction Model

- Global cross-filtering: clicking a project/repo/task updates all relevant sections.
- Hover synchronization across charts for same date bucket.
- URL-synced filter state for shareable views.
- Explicit reset filters action.

## Accessibility and UX Quality Bar

- Color is not the only channel; use shape/labels for states.
- Keyboard-accessible tooltips and legend toggles.
- Minimum contrast for chart strokes and fills.
- Empty/error states with next actions (e.g., adjust range, add project filter).

## Suggested Implementation Phases

1. Visual shell + chart primitives + cross-filter state model.
2. Replace KPI cards and focus trend chart.
3. Add project share + review load visuals.
4. Add complexity scatter + keep table drilldown.
5. QA and performance pass (mobile + large datasets).

## Open Decisions for Validation

- Preferred charting direction:
  - Option A: `Recharts` (faster implementation, common React patterns)
  - Option B: `Visx` (more control, higher implementation effort)
- Compare mode:
  - Option A: previous period
  - Option B: same period last month/last year
- Mobile behavior:
  - Option A: vertical stacked charts
  - Option B: section tabs with one chart per view
