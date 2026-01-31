import { createFileRoute } from '@tanstack/react-router';
import {
  Clock,
  CheckCircle2,
  GitPullRequest,
  TrendingUp,
  Inbox,
  Plus,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Route = createFileRoute('/_app/')({
  component: DashboardPage,
});

const Kpis = [
  {
    title: 'Hours Logged',
    value: '6.5h',
    description: 'Today',
    icon: Clock,
    trend: '+12% from yesterday',
  },
  {
    title: 'Tasks Completed',
    value: '12',
    description: 'This week',
    icon: CheckCircle2,
    trend: '+4 from last week',
  },
  {
    title: 'PRs Reviewed',
    value: '5',
    description: 'This week',
    icon: GitPullRequest,
    trend: '+2 from last week',
  },
  {
    title: 'Efficiency Score',
    value: '94%',
    description: 'Current session',
    icon: TrendingUp,
    trend: '+3% improvement',
  },
];

const RecentActivity = [
  {
    id: '1',
    type: 'task',
    title: 'Implement Auth Middleware',
    project: 'Core Engine',
    status: 'In Progress',
    time: '2h ago',
  },
  {
    id: '2',
    type: 'pr',
    title: 'feat: add company switcher',
    project: 'Web App',
    status: 'Reviewing',
    time: '4h ago',
  },
  {
    id: '3',
    type: 'task',
    title: 'Refactor UI Components',
    project: 'Design System',
    status: 'Completed',
    time: 'Yesterday',
  },
  {
    id: '4',
    type: 'session',
    title: 'Focus Session: Dashboard Implementation',
    project: 'Web App',
    status: 'Completed',
    time: 'Yesterday',
  },
  {
    id: '5',
    type: 'task',
    title: 'Setup Convex Schema',
    project: 'Core Engine',
    status: 'Completed',
    time: '2 days ago',
  },
];

const InboxItems = [
  {
    id: '1',
    source: 'GitHub',
    title: 'New PR assigned to you',
    time: '10m ago',
  },
  {
    id: '2',
    source: 'Notion',
    title: 'Meeting notes updated',
    time: '1h ago',
  },
  {
    id: '3',
    source: 'DevSuite',
    title: 'Task "Fix CSS" completed by @seb',
    time: '3h ago',
  },
];

function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Inbox</h1>
        <p className="text-muted-foreground">
          Your productivity overview and pending actions.
        </p>
      </div>

      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Kpis.map(kpi => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-primary font-medium">
                  {kpi.trend.split(' ')[0]}
                </span>{' '}
                {kpi.trend.split(' ').slice(1).join(' ')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-3">
        {/* Left Column: Recent Activity */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Updates across your projects and tasks.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Project
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RecentActivity.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground sm:hidden">
                        {item.project}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {item.project}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === 'Completed'
                            ? 'bg-primary/10 text-primary'
                            : item.status === 'In Progress'
                              ? 'bg-blue-500/10 text-blue-400'
                              : 'bg-yellow-500/10 text-yellow-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.time}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Right Column: Inbox & Quick Actions */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Inbox className="w-5 h-5 text-primary" /> Inbox Summary
              </CardTitle>
              <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                {InboxItems.length}
              </span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="space-y-4">
                {InboxItems.map(item => (
                  <div
                    key={item.id}
                    className="group flex items-start gap-3 text-sm"
                  >
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium group-hover:text-primary transition-colors cursor-pointer leading-tight">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.source}</span>
                        <span>•</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto self-start text-muted-foreground hover:text-primary"
              >
                Go to Inbox <ExternalLink className="ml-1 w-3 h-3" />
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-dashed"
              >
                <Plus className="w-4 h-4" /> New Task
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-dashed"
              >
                <Clock className="w-4 h-4" /> Log Time
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2 border-dashed col-span-2"
              >
                <TrendingUp className="w-4 h-4" /> Start Focus Session
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
