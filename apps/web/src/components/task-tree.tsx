import {
  useState,
  useMemo,
  useRef,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type HTMLAttributes,
} from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { buildTaskTree, type TaskDoc, type TaskNode } from '@/lib/tasks';
import { cn, getMidSortKey } from '@/lib/utils';
import {
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
  MoreHorizontal,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { TaskSheet } from './task-sheet';
import { DeleteConfirmDialog } from './delete-confirm-dialog';
import { showToast } from '@/lib/toast';
import { toast } from 'sonner';
import type { Id } from '../../../../convex/_generated/dataModel';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createPortal } from 'react-dom';

interface TaskTreeProps {
  projectId: Id<'projects'> | null;
  companyId: Id<'companies'>;
  tasksFilter?: (task: TaskDoc) => boolean;
}

const INDENT_WIDTH = 24; // px (1.5rem)

export function TaskTree({ projectId, companyId, tasksFilter }: TaskTreeProps) {
  const projectTasks = useQuery(
    api.tasks.getProjectTasks,
    projectId ? { companyId, projectId } : 'skip'
  );
  const companyTasks = useQuery(
    api.tasks.getCompanyTasks,
    projectId ? 'skip' : { companyId }
  );
  const tasksData = projectId ? projectTasks : companyTasks;

  const createTask = useMutation(api.tasks.createTask);
  const updateTask = useMutation(api.tasks.updateTask);
  const moveTask = useMutation(api.tasks.moveTask);
  const deleteTask = useMutation(api.tasks.softDeleteTaskSubtree);
  const undoDelete = useMutation(api.tasks.undoRestoreTaskSubtree);

  const [expandedIds, setExpandedIds] = useState<Set<Id<'tasks'>>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<Id<'tasks'> | null>(
    null
  );
  const [taskToDelete, setTaskToDelete] = useState<TaskNode | null>(null);
  const [activeId, setActiveId] = useState<Id<'tasks'> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require movement to start drag, allowing clicks
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tree = useMemo(() => {
    if (!tasksData) return [];
    let filtered = tasksData as TaskDoc[];
    if (tasksFilter) {
      filtered = filtered.filter(tasksFilter);
    }
    return buildTaskTree(filtered);
  }, [tasksData, tasksFilter]);

  const flattenedTree = useMemo(() => {
    const visibleTasks: TaskNode[] = [];
    const traverse = (nodes: TaskNode[]) => {
      nodes.forEach(node => {
        visibleTasks.push(node);
        if (expandedIds.has(node._id)) {
          traverse(node.children);
        }
      });
    };
    traverse(tree);
    return visibleTasks;
  }, [tree, expandedIds]);

  const toggleExpand = (id: Id<'tasks'>) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleCreateTask = async (parentTaskId: Id<'tasks'> | null = null) => {
    try {
      const id = await createTask({
        companyId,
        projectId,
        parentTaskId,
        title: '',
        notesMarkdown: null,
        dueDate: null,
        complexityScore: null,
      });
      if (parentTaskId) {
        setExpandedIds(prev => new Set(prev).add(parentTaskId));
      }
      return id;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to create task';
      showToast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!taskToDelete) return;
    try {
      const result = await deleteTask({
        companyId,
        taskId: taskToDelete._id,
      });
      setTaskToDelete(null);

      toast.success(`Deleted task and ${result.deletedCount - 1} subtasks`, {
        action: {
          label: 'Undo',
          onClick: () => undoDelete({ companyId, taskId: taskToDelete._id }),
        },
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete task';
      showToast.error(message);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as Id<'tasks'>);

    // Collapse the dragged item to avoid dragging parents into their own visible children (visual cycle)
    // and to treat the subtree as a unit.
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.delete(active.id as Id<'tasks'>);
      return next;
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveId(null);

    if (!over || !tasksData) return;

    const activeId = active.id as Id<'tasks'>;
    const overId = over.id as Id<'tasks'>;

    // Find indices in the currently visible list
    const oldIndex = flattenedTree.findIndex(t => t._id === activeId);
    const newIndex = flattenedTree.findIndex(t => t._id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    // Calculate intended depth change from X-offset
    const dragDepthChange = Math.round(delta.x / INDENT_WIDTH);

    const activeTask = tasksData.find(t => t._id === activeId);
    if (!activeTask) return;

    const currentDepth = getDepth(activeTask, tasksData);
    const projectedDepth = currentDepth + dragDepthChange;

    // Simulate the reorder in the list to find context
    const newOrderedList = arrayMove(flattenedTree, oldIndex, newIndex);

    // Determine the item "above" the dropped position to infer parent
    const itemAbove = newIndex > 0 ? newOrderedList[newIndex - 1] : null;
    const itemAboveDepth = itemAbove ? getDepth(itemAbove, tasksData) : -1;

    // Max depth logic:
    // We can be at most `itemAboveDepth + 1` (child of above).
    // We can also be at most 3 (global constraint).
    const maxLocalDepth = itemAbove ? itemAboveDepth + 1 : 0;
    const maxGlobalDepth = 3;
    const maxAllowedDepth = Math.min(maxLocalDepth, maxGlobalDepth);

    // Clamp projected depth
    const newDepth = Math.max(0, Math.min(maxAllowedDepth, projectedDepth));

    // Resolve new parent based on depth relative to itemAbove
    let newParentId: Id<'tasks'> | null = null;

    if (itemAbove) {
      if (newDepth === itemAboveDepth + 1) {
        newParentId = itemAbove._id;
      } else if (newDepth === itemAboveDepth) {
        newParentId = itemAbove.parentTaskId;
      } else {
        // newDepth < itemAboveDepth: finding an ancestor sibling
        let curr: TaskNode | undefined = itemAbove;
        while (curr && getDepth(curr, tasksData) > newDepth) {
          if (curr.parentTaskId) {
            curr = tasksData.find(
              t => t._id === curr!.parentTaskId
            ) as TaskNode;
          } else {
            curr = undefined;
          }
        }
        newParentId = curr ? curr.parentTaskId : null;
      }
    } else {
      newParentId = null;
    }

    // Cycle check: verify we aren't dropping into our own subtree
    if (newParentId) {
      if (newParentId === activeId) return; // Should be impossible via UI but safe to check
      let p = tasksData.find(t => t._id === newParentId);
      while (p) {
        if (p._id === activeId) {
          toast.error('Cannot move a task inside itself');
          return;
        }
        if (!p.parentTaskId) break;
        p = tasksData.find(t => t._id === p!.parentTaskId);
      }
    }

    // Determine Sort Key
    // Find the nearest siblings in the projected new list order to calculate sort key
    let prevSibling: TaskNode | null = null;
    let nextSibling: TaskNode | null = null;

    // Scan backwards for prev sibling
    for (let i = newIndex - 1; i >= 0; i--) {
      const t = newOrderedList[i];
      if (!t) continue;
      if (t.parentTaskId === newParentId) {
        prevSibling = t;
        break;
      }
    }

    // Scan forwards for next sibling
    for (let i = newIndex + 1; i < newOrderedList.length; i++) {
      const t = newOrderedList[i];
      if (!t) continue;
      if (t.parentTaskId === newParentId) {
        nextSibling = t;
        break;
      }
    }

    const newSortKey = getMidSortKey(
      prevSibling?.sortKey ?? null,
      nextSibling?.sortKey ?? null
    );

    // Optimistic / Real update
    if (
      newParentId !== activeTask.parentTaskId ||
      newSortKey !== activeTask.sortKey
    ) {
      try {
        await moveTask({
          companyId,
          taskId: activeId,
          newParentId,
          newSortKey,
        });

        // If we reparented into something, expand it so we can see the result
        if (newParentId) {
          setExpandedIds(prev => new Set(prev).add(newParentId));
        }
      } catch (err) {
        showToast.error('Failed to move task');
        console.error(err);
      }
    }
  };

  const handleIndent = async (taskId: Id<'tasks'>) => {
    if (!tasksData) return;
    const index = flattenedTree.findIndex(t => t._id === taskId);
    if (index <= 0) return; // Can't indent first item

    const prevTask = flattenedTree[index - 1];
    if (!prevTask) return;

    const prevDepth = getDepth(prevTask, tasksData);
    if (prevDepth >= 3) {
      // 0, 1, 2 are valid parents. If prev is 3, child would be 4.
      toast.error('Maximum nesting depth reached (3 levels)');
      return;
    }

    await moveTask({
      companyId,
      taskId,
      newParentId: prevTask._id,
    });

    setExpandedIds(prev => new Set(prev).add(prevTask._id));
  };

  const handleReorder = async (
    taskId: Id<'tasks'>,
    direction: 'up' | 'down'
  ) => {
    if (!tasksData) return;
    const task = tasksData.find(t => t._id === taskId);
    if (!task) return;

    const siblings = tasksData
      .filter(t => t.parentTaskId === task.parentTaskId)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const myIndex = siblings.findIndex(t => t._id === taskId);
    if (myIndex === -1) return;

    if (direction === 'up' && myIndex > 0) {
      const target = siblings[myIndex - 1];
      if (!target) return;
      const predecessor = myIndex - 2 >= 0 ? siblings[myIndex - 2] : null;
      const newSortKey = getMidSortKey(
        predecessor?.sortKey ?? null,
        target.sortKey
      );
      await moveTask({
        companyId,
        taskId,
        newParentId: task.parentTaskId,
        newSortKey,
      });
    } else if (direction === 'down' && myIndex < siblings.length - 1) {
      const target = siblings[myIndex + 1];
      if (!target) return;
      const successor =
        myIndex + 2 < siblings.length ? siblings[myIndex + 2] : null;
      const newSortKey = getMidSortKey(
        target.sortKey,
        successor?.sortKey ?? null
      );
      await moveTask({
        companyId,
        taskId,
        newParentId: task.parentTaskId,
        newSortKey,
      });
    }
  };

  const activeTaskNode = activeId
    ? tasksData?.find(t => t._id === activeId)
    : null;

  if (tasksData === undefined) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const isEmpty = tasksData.length === 0;
  const isFilteredEmpty = !isEmpty && flattenedTree.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed rounded-lg space-y-4">
        <p className="text-muted-foreground text-sm">
          No tasks yet. Press Enter to create one.
        </p>
        <Button variant="outline" size="sm" onClick={() => handleCreateTask()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>
    );
  }

  if (isFilteredEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-32 border border-dashed rounded-lg">
        <p className="text-muted-foreground text-sm">
          No tasks match the current filter.
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={flattenedTree.map(t => t._id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-1">
          {flattenedTree.map(task => (
            <TaskItem
              key={task._id}
              task={task}
              depth={getDepth(task, tasksData)}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
              onUpdate={(taskId, updates) =>
                updateTask({ companyId, taskId, ...updates })
              }
              onDelete={task => setTaskToDelete(task)}
              onCreateSibling={parentTaskId => handleCreateTask(parentTaskId)}
              onCreateChild={parentTaskId => handleCreateTask(parentTaskId)}
              onSelect={taskId => setSelectedTaskId(taskId)}
              onOutdent={async taskId => {
                const current = tasksData.find(t => t._id === taskId);
                if (!current?.parentTaskId) return;
                const parent = tasksData.find(
                  t => t._id === current.parentTaskId
                );
                await moveTask({
                  companyId,
                  taskId,
                  newParentId: parent?.parentTaskId ?? null,
                });
              }}
              onIndent={handleIndent}
              onReorder={handleReorder}
            />
          ))}

          {createPortal(
            <DragOverlay>
              {activeTaskNode ? (
                <div className="opacity-90">
                  <TaskItemContent
                    task={activeTaskNode as TaskNode}
                    depth={getDepth(activeTaskNode, tasksData)}
                    expandedIds={expandedIds}
                    toggleExpand={() => {}}
                    isOverlay
                    onUpdate={() => {}}
                    onDelete={() => {}}
                    onCreateSibling={() => {}}
                    onCreateChild={() => {}}
                    onSelect={() => {}}
                    onOutdent={() => {}}
                    onIndent={() => {}}
                    onReorder={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body
          )}

          <TaskSheet
            taskId={selectedTaskId}
            companyId={companyId}
            open={!!selectedTaskId}
            onOpenChange={open => !open && setSelectedTaskId(null)}
          />

          <DeleteConfirmDialog
            open={!!taskToDelete}
            onOpenChange={open => !open && setTaskToDelete(null)}
            onConfirm={handleDelete}
            taskTitle={taskToDelete?.title || ''}
            subtaskCount={taskToDelete ? countDescendants(taskToDelete) : 0}
          />
        </div>
      </SortableContext>
    </DndContext>
  );
}

function getDepth(task: TaskDoc, allTasks: TaskDoc[]): number {
  const map = new Map<Id<'tasks'>, TaskDoc>(allTasks.map(t => [t._id, t]));
  let depth = 0;
  let current: TaskDoc | undefined = task;
  while (current?.parentTaskId) {
    const parent = map.get(current.parentTaskId);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}

function countDescendants(node: TaskNode): number {
  let count = 0;
  for (const child of node.children) {
    count += 1 + countDescendants(child);
  }
  return count;
}

interface TaskItemProps {
  task: TaskNode;
  depth: number;
  expandedIds: Set<Id<'tasks'>>;
  toggleExpand: (id: Id<'tasks'>) => void;
  onUpdate: (
    taskId: Id<'tasks'>,
    updates: Partial<{
      title: string;
      status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
    }>
  ) => void;
  onDelete: (task: TaskNode) => void;
  onCreateSibling: (parentTaskId: Id<'tasks'> | null) => void;
  onCreateChild: (parentTaskId: Id<'tasks'>) => void;
  onSelect: (taskId: Id<'tasks'>) => void;
  onOutdent: (taskId: Id<'tasks'>) => void;
  onIndent: (taskId: Id<'tasks'>) => void;
  onReorder: (taskId: Id<'tasks'>, direction: 'up' | 'down') => void;
}

function TaskItem(props: TaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('outline-none', isDragging && 'z-10')}
    >
      <TaskItemContent
        {...props}
        isDragging={isDragging}
        dragHandleProps={
          { ...attributes, ...listeners } as HTMLAttributes<HTMLElement>
        }
      />
    </div>
  );
}

interface TaskItemContentProps extends TaskItemProps {
  isDragging?: boolean;
  isOverlay?: boolean;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
}

function TaskItemContent({
  task,
  depth,
  expandedIds,
  toggleExpand,
  onUpdate,
  onDelete,
  onCreateSibling,
  onCreateChild,
  onSelect,
  onOutdent,
  onIndent,
  onReorder,
  isDragging,
  isOverlay,
  dragHandleProps,
}: TaskItemContentProps) {
  const isExpanded = expandedIds.has(task._id);
  const hasChildren = task.children.length > 0;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(task.title === '');

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    const newTitle = inputRef.current?.value.trim() || 'Untitled Task';
    if (task.title !== newTitle) {
      onUpdate(task._id, { title: newTitle });
    }
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSubmit();
      onCreateSibling(task.parentTaskId);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onOutdent(task._id);
      } else {
        onIndent(task._id);
      }
    } else if (e.key === 'ArrowUp' && e.altKey) {
      e.preventDefault();
      onReorder(task._id, 'up');
    } else if (e.key === 'ArrowDown' && e.altKey) {
      e.preventDefault();
      onReorder(task._id, 'down');
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-1 rounded-md transition-colors group/row',
        !isOverlay && 'hover:bg-accent/50',
        task.status === 'done' && 'opacity-60',
        isDragging && 'opacity-30 bg-accent',
        isOverlay && 'bg-background border rounded-md shadow-xl opacity-100'
      )}
    >
      <div className="flex shrink-0 h-6">
        {/* Depth indicators */}
        {Array.from({ length: depth }).map((_, i) => (
          <div
            key={i}
            className="w-6 border-r border-border/40 h-full relative last:border-0"
          />
        ))}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div
          {...dragHandleProps}
          className={cn(
            'cursor-grab text-muted-foreground/50',
            !isOverlay && 'hover:text-foreground'
          )}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {hasChildren && !isDragging && (
            <button
              onClick={e => {
                e.stopPropagation();
                toggleExpand(task._id);
              }}
              className="hover:bg-accent rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={val =>
            onUpdate(task._id, { status: val ? 'done' : 'todo' })
          }
          className="rounded-full h-4 w-4 shrink-0"
          onClick={e => e.stopPropagation()}
        />

        {isEditing && !isDragging && !isOverlay ? (
          <Input
            ref={inputRef}
            defaultValue={task.title}
            onBlur={handleTitleSubmit}
            onKeyDown={handleKeyDown}
            className="h-7 py-0 px-1 text-sm bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring min-w-0"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className={cn(
              'text-sm truncate cursor-text flex-1 py-0.5',
              task.status === 'done' && 'line-through text-muted-foreground'
            )}
            onClick={e => {
              e.stopPropagation();
              if (!isDragging && !isOverlay) setIsEditing(true);
            }}
          >
            {task.title || (
              <span className="text-muted-foreground italic">
                Untitled Task
              </span>
            )}
          </span>
        )}
      </div>

      {!isOverlay && (
        <div
          className="flex items-center gap-2 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity pr-2"
          onClick={e => e.stopPropagation()}
        >
          {task.dueDate && (
            <Badge variant="outline" className="text-[10px] h-5 font-normal">
              {new Date(task.dueDate).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </Badge>
          )}
          {task.complexityScore && (
            <Badge variant="secondary" className="text-[10px] h-5 font-normal">
              {task.complexityScore}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSelect(task._id)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Open Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCreateChild(task._id)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Subtask
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(task)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
