import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { showToast } from '@/lib/toast';
import { formatDurationMs } from '@/lib/time';
import { cn } from '@/lib/utils';
import { getNextTriState, getTriState } from '@/lib/task-tristate';
import { TaskTriStateButton } from '@/components/task-tristate-button';
import { Loader2, Pause, Play, Square, XCircle, Timer } from 'lucide-react';
import type { Doc, Id } from '../../../../convex/_generated/dataModel';

const statusBadgeVariant = (
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'RUNNING':
      return 'default';
    case 'PAUSED':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'outline';
  }
};

type TaskDoc = Doc<'tasks'>;
type TaskListDoc = Doc<'project_task_lists'>;

type TaskGroup = {
  key: string;
  label: string;
  tasks: TaskDoc[];
  projectSort: string;
  listOrder: number;
};

export function SessionWidget() {
  const { currentCompany } = useCurrentCompany();
  const companyId = currentCompany?._id;

  const activeSession = useQuery(
    api.sessions.getActiveSession,
    companyId ? { companyId } : 'skip'
  );

  const sessionDetail = useQuery(
    api.sessions.getSession,
    companyId && activeSession
      ? { companyId, sessionId: activeSession._id }
      : 'skip'
  );

  const projects = useQuery(
    api.projects.listProjects,
    companyId ? { companyId, includeArchived: false } : 'skip'
  );
  const tasks = useQuery(
    api.tasks.listAllTasks,
    companyId ? { companyId } : 'skip'
  );

  const startSession = useMutation(api.sessions.startSession);
  const pauseSession = useMutation(api.sessions.pauseSession);
  const resumeSession = useMutation(api.sessions.resumeSession);
  const finishSession = useMutation(api.sessions.finishSession);
  const cancelSession = useMutation(api.sessions.cancelSession);
  const activateTask = useMutation(api.sessions.activateTask);
  const deactivateTask = useMutation(api.sessions.deactivateTask);
  const markTaskDone = useMutation(api.sessions.markTaskDone);
  const resetTask = useMutation(api.sessions.resetTask);
  const updateTask = useMutation(api.tasks.updateTask);

  const [summary, setSummary] = useState('');
  const [selectedProjectId, setSelectedProjectId] =
    useState<Id<'projects'> | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false);
  const [pendingFinishTaskIds, setPendingFinishTaskIds] = useState<
    Id<'tasks'>[]
  >([]);
  const [isFinishing, setIsFinishing] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isRunning = sessionDetail?.session?.status === 'RUNNING';

  useEffect(() => {
    if (!isRunning) {
      return;
    }
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const projectNameById = useMemo(() => {
    const map = new Map<Id<'projects'>, string>();
    if (!projects) return map;
    for (const project of projects) {
      map.set(project._id, project.name);
    }
    return map;
  }, [projects]);

  const projectName = useMemo(() => {
    if (!selectedProjectId) return null;
    return projectNameById.get(selectedProjectId) ?? null;
  }, [projectNameById, selectedProjectId]);

  const activeTaskIds = (() => {
    const active = new Set<Id<'tasks'>>();
    if (!sessionDetail?.events) {
      return active;
    }
    for (const event of sessionDetail.events) {
      if (event.type === 'TASK_ACTIVATED') {
        const taskId = (event.payload as { taskId?: Id<'tasks'> }).taskId;
        if (taskId) active.add(taskId);
      }
      if (event.type === 'TASK_DEACTIVATED' || event.type === 'TASK_RESET') {
        const taskId = (event.payload as { taskId?: Id<'tasks'> }).taskId;
        if (taskId) active.delete(taskId);
      }
      if (
        event.type === 'SESSION_FINISHED' ||
        event.type === 'SESSION_CANCELLED'
      ) {
        active.clear();
      }
    }
    return active;
  })();

  const allowedProjectIds = (() => {
    if (selectedProjectId) return new Set([selectedProjectId]);
    if (sessionDetail?.session?.projectIds?.length) {
      return new Set(sessionDetail.session.projectIds);
    }
    return null;
  })();

  const listProjectIds = allowedProjectIds
    ? Array.from(allowedProjectIds).sort((a, b) => a.localeCompare(b))
    : null;

  const taskLists = useQuery(
    api.projectTaskLists.listByCompany,
    companyId
      ? listProjectIds
        ? { companyId, projectIds: listProjectIds }
        : { companyId }
      : 'skip'
  );

  const visibleTasks = (() => {
    if (!tasks) return [];
    const filtered = tasks.filter(task => {
      if (allowedProjectIds) {
        return task.projectId !== null && allowedProjectIds.has(task.projectId);
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const aActive = activeTaskIds.has(a._id);
      const bActive = activeTaskIds.has(b._id);
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (a.status !== b.status) {
        if (a.status === 'in_progress') return -1;
        if (b.status === 'in_progress') return 1;
      }
      return a.title.localeCompare(b.title);
    });
  })();

  const listMaps = useMemo(() => {
    const defaultListIdByProject = new Map<
      Id<'projects'>,
      Id<'project_task_lists'> | null
    >();
    const defaultNameByProject = new Map<Id<'projects'>, string>();
    const customOrderByProject = new Map<
      Id<'projects'>,
      Map<Id<'project_task_lists'>, number>
    >();
    const customNameByProject = new Map<
      Id<'projects'>,
      Map<Id<'project_task_lists'>, string>
    >();

    if (!taskLists) {
      return {
        defaultListIdByProject,
        defaultNameByProject,
        customOrderByProject,
        customNameByProject,
      };
    }

    const customListsByProject = new Map<Id<'projects'>, TaskListDoc[]>();

    for (const list of taskLists) {
      if (list.isDefault) {
        defaultListIdByProject.set(list.projectId, list._id);
        defaultNameByProject.set(list.projectId, list.name);
        continue;
      }
      const bucket = customListsByProject.get(list.projectId) ?? [];
      bucket.push(list);
      customListsByProject.set(list.projectId, bucket);
    }

    for (const [projectId, lists] of customListsByProject) {
      lists.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const order = new Map<Id<'project_task_lists'>, number>();
      const names = new Map<Id<'project_task_lists'>, string>();
      lists.forEach((list, index) => {
        order.set(list._id, index + 1);
        names.set(list._id, list.name);
      });
      customOrderByProject.set(projectId, order);
      customNameByProject.set(projectId, names);
    }

    return {
      defaultListIdByProject,
      defaultNameByProject,
      customOrderByProject,
      customNameByProject,
    };
  }, [taskLists]);

  const taskGroups = useMemo(() => {
    if (visibleTasks.length === 0) return [];
    const projectIds = new Set<Id<'projects'>>();
    for (const task of visibleTasks) {
      if (task.projectId) {
        projectIds.add(task.projectId);
      }
    }
    const hasMultipleProjects = projectIds.size > 1;

    const groups = new Map<string, TaskGroup>();

    for (const task of visibleTasks) {
      if (!task.projectId) {
        const key = 'company';
        const group = groups.get(key) ?? {
          key,
          label: 'Company tasks',
          tasks: [],
          projectSort: 'company',
          listOrder: 0,
        };
        group.tasks.push(task);
        groups.set(key, group);
        continue;
      }

      const projectId = task.projectId;
      const defaultListId =
        listMaps.defaultListIdByProject.get(projectId) ?? null;
      const defaultListName =
        listMaps.defaultNameByProject.get(projectId) ?? 'Inbox';
      const customOrder = listMaps.customOrderByProject.get(projectId);
      const customNames = listMaps.customNameByProject.get(projectId);
      const listId = task.listId ?? null;
      const isCustom = !!listId && (customOrder?.has(listId) ?? false);
      const listName = isCustom
        ? (customNames?.get(listId) ?? 'List')
        : defaultListName;
      const projectName = projectNameById.get(projectId) ?? 'Project';
      const label = hasMultipleProjects
        ? `${projectName} · ${listName}`
        : `List: ${listName}`;
      const listOrder = isCustom ? (customOrder?.get(listId) ?? 1) : 0;
      const groupKey = `${projectId}:${
        isCustom ? listId : (defaultListId ?? listId ?? 'default')
      }`;
      const projectSort = projectName.toLowerCase();
      const group = groups.get(groupKey) ?? {
        key: groupKey,
        label,
        tasks: [],
        projectSort,
        listOrder,
      };
      group.tasks.push(task);
      groups.set(groupKey, group);
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.projectSort !== b.projectSort) {
        return a.projectSort.localeCompare(b.projectSort);
      }
      return a.listOrder - b.listOrder;
    });
  }, [listMaps, projectNameById, visibleTasks]);

  const needsListNames = visibleTasks.some(task => task.projectId);
  const isTaskListLoading =
    tasks !== undefined && needsListNames && taskLists === undefined;

  const status = sessionDetail?.session?.status ?? 'IDLE';
  const displayDurationMs = useMemo(() => {
    if (!sessionDetail?.session) {
      return 0;
    }

    const { session, events, durationSummary } = sessionDetail;
    if (session.status !== 'RUNNING') {
      return durationSummary?.effectiveDurationMs ?? 0;
    }

    if (!events || events.length === 0) {
      return Math.max(0, nowMs - session.startAt);
    }

    let effectiveDuration = 0;
    let running = false;
    let lastTimestamp = session.startAt;
    const orderedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

    for (const event of orderedEvents) {
      if (running) {
        effectiveDuration += Math.max(0, event.timestamp - lastTimestamp);
      }

      if (
        event.type === 'SESSION_STARTED' ||
        event.type === 'SESSION_RESUMED'
      ) {
        running = true;
      } else if (
        event.type === 'SESSION_PAUSED' ||
        event.type === 'SESSION_FINISHED' ||
        event.type === 'SESSION_CANCELLED'
      ) {
        running = false;
      }

      lastTimestamp = event.timestamp;
    }

    if (running) {
      effectiveDuration += Math.max(0, nowMs - lastTimestamp);
    }

    return effectiveDuration;
  }, [nowMs, sessionDetail]);
  const isLoading = activeSession === undefined;
  const canEditTasks =
    status !== 'IDLE' && status !== 'FINISHED' && status !== 'CANCELLED';

  const handleStart = async () => {
    if (!companyId) return;
    try {
      await startSession({
        companyId,
        projectIds: selectedProjectId ? [selectedProjectId] : [],
      });
      setSummary('');
      showToast.success('Session started');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to start session'
      );
    }
  };

  const handlePause = async () => {
    if (!companyId || !activeSession) return;
    try {
      await pauseSession({ companyId, sessionId: activeSession._id });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to pause session'
      );
    }
  };

  const handleResume = async () => {
    if (!companyId || !activeSession) return;
    try {
      await resumeSession({ companyId, sessionId: activeSession._id });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to resume session'
      );
    }
  };

  const handleCancel = async (mode: 'DISCARD' | 'KEEP_EXCLUDED') => {
    if (!companyId || !activeSession) return;
    try {
      await cancelSession({
        companyId,
        sessionId: activeSession._id,
        cancelMode: mode,
      });
      setIsCancelDialogOpen(false);
      showToast.success('Session cancelled');
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to cancel session'
      );
    }
  };

  const ongoingTasks = visibleTasks.filter(task => {
    const isActive = activeTaskIds.has(task._id);
    return getTriState(task.status, isActive) === 'ongoing';
  });
  const finishTaskCount =
    pendingFinishTaskIds.length > 0
      ? pendingFinishTaskIds.length
      : ongoingTasks.length;

  const finishSessionNow = async () => {
    if (!companyId || !activeSession) return false;
    try {
      await finishSession({
        companyId,
        sessionId: activeSession._id,
        summary: summary.trim() || undefined,
      });
      setSummary('');
      showToast.success('Session finished');
      return true;
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to finish session'
      );
      return false;
    }
  };

  const handleFinish = async () => {
    if (!companyId || !activeSession) return;
    if (ongoingTasks.length > 0) {
      setPendingFinishTaskIds(ongoingTasks.map(task => task._id));
      setIsFinishDialogOpen(true);
      return;
    }
    setIsFinishing(true);
    await finishSessionNow();
    setIsFinishing(false);
  };

  const handleFinishKeepOngoing = async () => {
    setIsFinishing(true);
    const finished = await finishSessionNow();
    setIsFinishing(false);
    if (finished) {
      setPendingFinishTaskIds([]);
      setIsFinishDialogOpen(false);
    }
  };

  const handleFinishMarkDone = async () => {
    if (!companyId || !activeSession) return;
    setIsFinishing(true);
    try {
      const taskMap = new Map(
        (tasks ?? []).map(task => [task._id, task] as const)
      );
      for (const taskId of pendingFinishTaskIds) {
        const task = taskMap.get(taskId);
        if (!task) continue;
        const isActive = activeTaskIds.has(taskId);
        if (isActive) {
          await deactivateTask({
            companyId,
            sessionId: activeSession._id,
            taskId,
          });
        }
        await markTaskDone({
          companyId,
          sessionId: activeSession._id,
          taskId,
        });
      }
      const finished = await finishSessionNow();
      if (finished) {
        setPendingFinishTaskIds([]);
        setIsFinishDialogOpen(false);
      }
    } catch (error) {
      showToast.error(
        error instanceof Error
          ? error.message
          : 'Failed to update ongoing tasks'
      );
    } finally {
      setIsFinishing(false);
    }
  };

  const handleCycleTaskState = async (
    task: { _id: Id<'tasks'>; status: string },
    isActive: boolean
  ) => {
    if (!companyId || !activeSession) return;
    const currentState = getTriState(task.status, isActive);
    const nextState = getNextTriState(currentState);

    try {
      if (nextState === 'todo') {
        await resetTask({
          companyId,
          sessionId: activeSession._id,
          taskId: task._id,
        });
        return;
      }

      if (nextState === 'ongoing') {
        if (task.status !== 'in_progress') {
          await updateTask({
            companyId,
            taskId: task._id,
            status: 'in_progress',
          });
        }
        if (!isActive) {
          await activateTask({
            companyId,
            sessionId: activeSession._id,
            taskId: task._id,
          });
        }
        return;
      }

      if (isActive) {
        await deactivateTask({
          companyId,
          sessionId: activeSession._id,
          taskId: task._id,
        });
      }
      await markTaskDone({
        companyId,
        sessionId: activeSession._id,
        taskId: task._id,
      });
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to update task state'
      );
    }
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'hidden h-8 gap-2 border-primary/20 font-mono text-xs md:flex',
              status === 'RUNNING' && 'border-primary/40 bg-primary/5'
            )}
          >
            <Timer className="h-3 w-3 text-primary" />
            <span className="text-primary">
              {isLoading ? '...' : formatDurationMs(displayDurationMs)}
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">
              {status === 'IDLE' ? 'No session' : status}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="center">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Session</p>
                <p className="text-xs text-muted-foreground">
                  {status === 'IDLE'
                    ? 'Start tracking focus time'
                    : 'Manage your active session'}
                </p>
              </div>
              {status !== 'IDLE' && (
                <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
              )}
            </div>

            {status === 'IDLE' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Project (optional)
                  </label>
                  <Select
                    value={selectedProjectId ?? 'none'}
                    onValueChange={value =>
                      setSelectedProjectId(
                        value === 'none' ? null : (value as Id<'projects'>)
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue
                        placeholder="Select a project"
                        className="text-xs"
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects?.map(project => (
                        <SelectItem key={project._id} value={project._id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {projectName && (
                  <p className="text-xs text-muted-foreground">
                    Starting in {projectName}
                  </p>
                )}
                <Button className="w-full" onClick={handleStart}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Session
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Elapsed</p>
                      <p className="text-lg font-semibold">
                        {formatDurationMs(displayDurationMs)}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Summary (optional)
                  </label>
                  <Input
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    placeholder="What did you work on?"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {status === 'RUNNING' ? (
                    <Button variant="secondary" onClick={handlePause}>
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handleResume}>
                      <Play className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleFinish}
                    disabled={isFinishing}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Finish
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setIsCancelDialogOpen(true)}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Session
                </Button>
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      Tasks
                    </p>
                    {allowedProjectIds ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Project scope
                      </Badge>
                    ) : null}
                  </div>
                  {tasks === undefined || isTaskListLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : visibleTasks.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                      No tasks available for this scope.
                    </div>
                  ) : (
                    <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
                      {taskGroups.map(group => (
                        <div key={group.key} className="space-y-2">
                          <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground">
                            <span>{group.label}</span>
                            <div className="h-px flex-1 bg-border/60" />
                          </div>
                          {group.tasks.map(task => {
                            const isActive = activeTaskIds.has(task._id);
                            const isDone =
                              task.status === 'done' ||
                              task.status === 'cancelled';
                            const triState = getTriState(task.status, isActive);
                            return (
                              <div
                                key={task._id}
                                className={cn(
                                  'flex items-center justify-between rounded-md border px-2 py-2 text-xs',
                                  isActive && 'border-primary/40 bg-primary/5'
                                )}
                              >
                                <div className="flex items-center gap-3">
                                  <TaskTriStateButton
                                    state={triState}
                                    disabled={!canEditTasks}
                                    aria-label={`Set task ${task.title} to ${getNextTriState(
                                      triState
                                    )}`}
                                    onClick={event => {
                                      event.stopPropagation();
                                      handleCycleTaskState(task, isActive);
                                    }}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">
                                      {task.title}
                                    </span>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                      <span>
                                        {task.status.replace('_', ' ')}
                                      </span>
                                      {isActive && status === 'RUNNING' && (
                                        <Badge
                                          variant="secondary"
                                          className="px-1.5 py-0 text-[9px]"
                                        >
                                          Recording
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {isDone && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px]"
                                  >
                                    Done
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Cancel session</DialogTitle>
            <DialogDescription>
              Choose whether to discard the session entirely or keep it in
              history but exclude it from summaries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCancelDialogOpen(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleCancel('KEEP_EXCLUDED')}
            >
              Keep Excluded
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleCancel('DISCARD')}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFinishDialogOpen}
        onOpenChange={open => {
          setIsFinishDialogOpen(open);
          if (!open) {
            setPendingFinishTaskIds([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Finish with ongoing tasks?</DialogTitle>
            <DialogDescription>
              You still have {finishTaskCount}{' '}
              {finishTaskCount === 1 ? 'task' : 'tasks'} in progress. Keep them
              ongoing or mark them all done before finishing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsFinishDialogOpen(false)}
              disabled={isFinishing}
            >
              Keep Editing
            </Button>
            <Button
              variant="secondary"
              onClick={handleFinishKeepOngoing}
              disabled={isFinishing}
            >
              Keep Ongoing
            </Button>
            <Button
              variant="default"
              onClick={handleFinishMarkDone}
              disabled={isFinishing}
            >
              Mark All Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
