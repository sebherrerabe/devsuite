import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressRing } from './progress-ring';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
} from 'recharts';
import { CheckCircle2 } from 'lucide-react';

interface DailyFocus {
  label: string;
  minutes: number;
}

interface RecentCompletion {
  id: string;
  title: string;
  projectName?: string;
  completedAgo: string;
}

interface WeekOverviewProps {
  completedThisWeek: number;
  totalTasks: number;
  dailyFocus: DailyFocus[];
  recentCompletions: RecentCompletion[];
}

export function WeekOverview({
  completedThisWeek,
  totalTasks,
  dailyFocus,
  recentCompletions,
}: WeekOverviewProps) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">This week</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top row: progress ring + focus chart */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Weekly task progress */}
          <div className="flex items-center gap-4">
            <ProgressRing
              value={completedThisWeek}
              max={Math.max(totalTasks, 1)}
              size={72}
              strokeWidth={6}
              fillClassName="stroke-chart-2"
            />
            <div>
              <div className="text-2xl font-bold tabular-nums">
                {completedThisWeek}
              </div>
              <p className="text-sm text-muted-foreground">
                tasks completed of {totalTasks}
              </p>
            </div>
          </div>

          {/* Daily focus chart */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Daily focus
            </p>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyFocus} barCategoryGap="20%">
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 10,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    itemStyle={{ color: 'hsl(var(--popover-foreground))' }}
                    formatter={value => [`${Number(value ?? 0)}m`, 'Focus']}
                    cursor={{ fill: 'hsl(var(--accent))', opacity: 0.3 }}
                  />
                  <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                    {dailyFocus.map((entry, index) => (
                      <Cell
                        key={entry.label}
                        fill={
                          index === dailyFocus.length - 1
                            ? 'hsl(var(--primary))'
                            : 'hsl(var(--primary) / 0.4)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Recent completions */}
        {recentCompletions.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              Recently completed
            </p>
            <div className="space-y-2">
              {recentCompletions.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-chart-2" />
                  <span className="min-w-0 truncate font-medium">
                    {task.title}
                  </span>
                  {task.projectName && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                      {task.projectName}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {task.completedAgo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            No tasks completed this week yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
