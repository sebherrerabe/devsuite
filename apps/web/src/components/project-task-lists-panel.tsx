import { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import type { Id } from '../../../../convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TaskTree } from '@/components/task-tree';
import { buildTaskTree, flattenTaskTree, type TaskDoc } from '@/lib/tasks';
import { cn, getMidSortKey } from '@/lib/utils';
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface ProjectTaskListsPanelProps {
  companyId: Id<'companies'>;
  projectId: Id<'projects'>;
  selectedTaskId: Id<'tasks'> | null;
  onSelectTask: (taskId: Id<'tasks'>) => void;
}

const INDENT_WIDTH = 24;
type ListModel = {
  id: Id<'project_task_lists'>;
  name: string;
  isDefault: boolean;
};

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

export function ProjectTaskListsPanel({
  companyId,
  projectId,
  selectedTaskId,
  onSelectTask,
}: ProjectTaskListsPanelProps) {
  const lists = useQuery(api.projectTaskLists.listByProject, {
    companyId,
    projectId,
  });
  const tasks = useQuery(api.tasks.getProjectTasks, { companyId, projectId });
  const createList = useMutation(api.projectTaskLists.createList);
  const updateList = useMutation(api.projectTaskLists.updateList);
  const deleteList = useMutation(api.projectTaskLists.softDeleteList);
  const createTask = useMutation(api.tasks.createTask);
  const moveTask = useMutation(api.tasks.moveTask);

  const [collapsedListIds, setCollapsedListIds] = useState<
    Set<Id<'project_task_lists'>>
  >(new Set());
  const [editingListId, setEditingListId] =
    useState<Id<'project_task_lists'> | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [activeId, setActiveId] = useState<Id<'tasks'> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const listOrder = useMemo(() => {
    if (!lists) return [];
    const defaultList = lists.find(list => list.isDefault);
    const others = lists.filter(list => !list.isDefault);
    return defaultList ? [defaultList, ...others] : others;
  }, [lists]);
  const defaultListId = listOrder.find(list => list.isDefault)?._id ?? null;
  const customLists = useMemo(
    () => listOrder.filter(list => !list.isDefault),
    [listOrder]
  );
  const listModels = useMemo<ListModel[]>(() => {
    return listOrder.map(list => ({
      id: list._id,
      name: list.name,
      isDefault: list.isDefault,
    }));
  }, [listOrder]);

  const tasksByList = useMemo(() => {
    const map = new Map<Id<'project_task_lists'>, TaskDoc[]>();
    if (!tasks) return map;

    for (const list of listModels) {
      map.set(list.id, []);
    }

    for (const task of tasks) {
      const listId = task.listId;
      const targetListId = map.has(listId)
        ? listId
        : (defaultListId ?? listModels[0]?.id);
      if (!targetListId) continue;
      const bucket = map.get(targetListId) ?? [];
      bucket.push(task);
      map.set(targetListId, bucket);
    }

    return map;
  }, [tasks, listModels, defaultListId]);

  const taskMap = useMemo(() => {
    const map = new Map<Id<'tasks'>, TaskDoc>();
    if (!tasks) return map;
    for (const task of tasks) {
      map.set(task._id, task);
    }
    return map;
  }, [tasks]);

  const resolveListId = (task: TaskDoc): Id<'project_task_lists'> => {
    const listId = task.listId;
    if (tasksByList.has(listId)) {
      return listId;
    }
    return defaultListId ?? listModels[0]?.id ?? listId;
  };

  const flattenedByList = useMemo(() => {
    const map = new Map<Id<'project_task_lists'>, TaskDoc[]>();
    for (const [listId, listTasks] of tasksByList.entries()) {
      const tree = buildTaskTree(listTasks);
      const flattened = flattenTaskTree(tree);
      map.set(
        listId,
        flattened.map(node => ({ ...node }))
      );
    }
    return map;
  }, [tasksByList]);

  const toggleList = (listId: Id<'project_task_lists'>) => {
    setCollapsedListIds(prev => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleQuickCreateList = async () => {
    try {
      const listId = await createList({
        companyId,
        projectId,
        name: 'New list',
      });
      setEditingListId(listId);
      setEditingListName('');
    } catch {
      // errors surfaced via Convex
    }
  };

  const handleSaveListName = async (
    listId: Id<'project_task_lists'>,
    fallbackName: string
  ) => {
    const trimmed = editingListName.trim();
    if (!trimmed) {
      setEditingListId(null);
      setEditingListName('');
      return;
    }
    if (trimmed === fallbackName) {
      setEditingListId(null);
      setEditingListName('');
      return;
    }
    try {
      await updateList({ companyId, listId, name: trimmed });
    } finally {
      setEditingListId(null);
      setEditingListName('');
    }
  };

  const handleCreateTask = async () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    try {
      await createTask({
        companyId,
        projectId,
        parentTaskId: null,
        title: trimmed,
        notesMarkdown: null,
        dueDate: null,
        complexityScore: null,
        ...(defaultListId ? { listId: defaultListId } : {}),
      });
      setNewTaskTitle('');
    } catch {
      // errors surfaced via Convex
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as Id<'tasks'>);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over, delta } = event;
    setActiveId(null);
    if (!over || !tasks) return;

    const activeTaskId = active.id as Id<'tasks'>;
    const activeTask = taskMap.get(activeTaskId);
    if (!activeTask) return;

    const activeListId = resolveListId(activeTask);

    const overId = over.id as string;
    const isListDrop = typeof overId === 'string' && overId.startsWith('list:');

    if (isListDrop) {
      const targetListId = overId.replace(
        'list:',
        ''
      ) as Id<'project_task_lists'>;
      if (targetListId === activeListId) return;

      const targetTasks = tasksByList.get(targetListId) ?? [];
      const topLevel = targetTasks
        .filter(t => !t.parentTaskId)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const prevSibling = topLevel[topLevel.length - 1] ?? null;
      const newSortKey = getMidSortKey(prevSibling?.sortKey ?? null, null);

      await moveTask({
        companyId,
        taskId: activeTaskId,
        newParentId: null,
        newListId: targetListId,
        newSortKey,
      });
      return;
    }

    const overTaskId = over.id as Id<'tasks'>;
    const overTask = taskMap.get(overTaskId);
    if (!overTask) return;

    const targetListId = resolveListId(overTask);

    if (targetListId !== activeListId) {
      const targetTasks = tasksByList.get(targetListId) ?? [];
      const topLevel = targetTasks
        .filter(t => !t.parentTaskId)
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      const prevSibling = topLevel[topLevel.length - 1] ?? null;
      const newSortKey = getMidSortKey(prevSibling?.sortKey ?? null, null);

      await moveTask({
        companyId,
        taskId: activeTaskId,
        newParentId: null,
        newListId: targetListId,
        newSortKey,
      });
      return;
    }

    const listTasks = tasksByList.get(activeListId) ?? [];
    const flattenedTree = flattenedByList.get(activeListId) ?? [];
    const oldIndex = flattenedTree.findIndex(t => t._id === activeTaskId);
    const newIndex = flattenedTree.findIndex(t => t._id === overTaskId);
    if (oldIndex === -1 || newIndex === -1) return;

    const dragDepthChange = Math.round(delta.x / INDENT_WIDTH);
    const currentDepth = getDepth(activeTask, listTasks);
    const projectedDepth = currentDepth + dragDepthChange;
    const newOrderedList = arrayMove(flattenedTree, oldIndex, newIndex);
    const itemAbove = newIndex > 0 ? newOrderedList[newIndex - 1] : null;
    const itemAboveDepth = itemAbove ? getDepth(itemAbove, listTasks) : -1;

    const maxLocalDepth = itemAbove ? itemAboveDepth + 1 : 0;
    const maxGlobalDepth = 3;
    const maxAllowedDepth = Math.min(maxLocalDepth, maxGlobalDepth);
    const newDepth = Math.max(0, Math.min(maxAllowedDepth, projectedDepth));

    let newParentId: Id<'tasks'> | null = null;
    if (itemAbove) {
      if (newDepth === itemAboveDepth + 1) {
        newParentId = itemAbove._id;
      } else if (newDepth === itemAboveDepth) {
        newParentId = itemAbove.parentTaskId;
      } else {
        let curr: TaskDoc | undefined = itemAbove;
        while (curr && getDepth(curr, listTasks) > newDepth) {
          if (curr.parentTaskId) {
            curr = listTasks.find(t => t._id === curr!.parentTaskId);
          } else {
            curr = undefined;
          }
        }
        newParentId = curr ? curr.parentTaskId : null;
      }
    }

    if (newParentId) {
      if (newParentId === activeTaskId) return;
      let p = listTasks.find(t => t._id === newParentId);
      while (p) {
        if (p._id === activeTaskId) {
          return;
        }
        if (!p.parentTaskId) break;
        p = listTasks.find(t => t._id === p!.parentTaskId);
      }
    }

    let prevSibling: TaskDoc | null = null;
    let nextSibling: TaskDoc | null = null;
    for (let i = newIndex - 1; i >= 0; i--) {
      const t = newOrderedList[i];
      if (!t) continue;
      if (t.parentTaskId === newParentId) {
        prevSibling = t;
        break;
      }
    }
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

    await moveTask({
      companyId,
      taskId: activeTaskId,
      newParentId,
      newSortKey,
    });
  };

  if (!lists || !tasks) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 rounded bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const activeTask = activeId ? taskMap.get(activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-4">
        <Input
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder="Add task"
          className="h-9"
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleCreateTask();
            }
          }}
        />

        {customLists.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No custom lists yet.
            <Button size="sm" className="ml-2" onClick={handleQuickCreateList}>
              <Plus className="h-4 w-4 mr-1" />
              Create list
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {listModels.map(list => {
            const isCollapsed = collapsedListIds.has(list.id);
            const listTasks = tasksByList.get(list.id) ?? [];
            return (
              <ListSection
                key={list.id}
                list={list}
                listTasks={listTasks}
                isCollapsed={isCollapsed}
                onToggle={() => toggleList(list.id)}
                projectId={projectId}
                companyId={companyId}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onCreateList={handleQuickCreateList}
                onRenameList={() => {
                  setEditingListId(list.id);
                  setEditingListName(list.name);
                }}
                onDeleteList={() => {
                  if (list.isDefault) return;
                  void deleteList({
                    companyId,
                    listId: list.id,
                  });
                }}
                editingListId={editingListId}
                editingListName={editingListName}
                setEditingListName={setEditingListName}
                onSaveListName={handleSaveListName}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
            <span className="text-sm font-medium">{activeTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface ListSectionProps {
  list: ListModel;
  listTasks: TaskDoc[];
  isCollapsed: boolean;
  onToggle: () => void;
  projectId: Id<'projects'>;
  companyId: Id<'companies'>;
  selectedTaskId: Id<'tasks'> | null;
  onSelectTask: (taskId: Id<'tasks'>) => void;
  onCreateList: () => void;
  onRenameList: () => void;
  onDeleteList: () => void;
  editingListId: Id<'project_task_lists'> | null;
  editingListName: string;
  setEditingListName: (value: string) => void;
  onSaveListName: (
    listId: Id<'project_task_lists'>,
    fallbackName: string
  ) => void;
}

function ListSection({
  list,
  listTasks,
  isCollapsed,
  onToggle,
  projectId,
  companyId,
  selectedTaskId,
  onSelectTask,
  onCreateList,
  onRenameList,
  onDeleteList,
  editingListId,
  editingListName,
  setEditingListName,
  onSaveListName,
}: ListSectionProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `list:${list.id}`,
  });
  const listId = list.id;
  const isEditing = editingListId === listId;
  const displayName = list.name;
  const disableDelete = list.isDefault;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-shadow',
        isOver && 'rounded-md ring-2 ring-primary/40'
      )}
    >
      <div className="flex w-full items-center justify-between py-2 text-sm group">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            className="flex items-center"
            onClick={onToggle}
            disabled={isEditing}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {isEditing ? (
            <Input
              value={editingListName}
              onChange={e => setEditingListName(e.target.value)}
              placeholder="List name"
              className="h-7 w-48"
              autoFocus
              onBlur={() => {
                if (listId) onSaveListName(listId, list.name);
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (listId) onSaveListName(listId, list.name);
                }
              }}
            />
          ) : (
            <button
              type="button"
              className="font-medium truncate"
              onClick={onToggle}
            >
              {displayName}
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            {listTasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={event => {
              event.stopPropagation();
              onCreateList();
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={event => event.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={false}
                onClick={event => {
                  event.stopPropagation();
                  onRenameList();
                }}
              >
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disableDelete}
                onClick={event => {
                  event.stopPropagation();
                  onDeleteList();
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!isCollapsed && (
        <div className="pb-2">
          <TaskTree
            projectId={projectId}
            companyId={companyId}
            tasks={listTasks}
            listId={listId}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            showSheet={false}
            useExternalDnd
          />
        </div>
      )}
    </div>
  );
}
