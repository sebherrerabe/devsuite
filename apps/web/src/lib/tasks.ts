import type { Doc, Id } from '../../../../convex/_generated/dataModel';

export type TaskDoc = Doc<'tasks'>;

export type TaskNode = TaskDoc & {
  children: TaskNode[];
};

/**
 * Builds a hierarchical tree from a flat list of Convex task docs.
 *
 * Notes:
 * - Uses `_id` as the node key (Convex doc identity).
 * - Assumes `parentTaskId` is either an Id<'tasks'> or null.
 * - Sorts each sibling group by `sortKey` (string compare).
 */
export function buildTaskTree(tasks: TaskDoc[]): TaskNode[] {
  const taskMap = new Map<Id<'tasks'>, TaskNode>();
  const roots: TaskNode[] = [];

  for (const task of tasks) {
    taskMap.set(task._id, { ...task, children: [] });
  }

  for (const task of tasks) {
    const node = taskMap.get(task._id);
    if (!node) continue;
    if (task.parentTaskId) {
      const parent = taskMap.get(task.parentTaskId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not present in the list (shouldn't happen with correct scoping)
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  const sortTasks = (taskList: TaskNode[]) => {
    taskList.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    for (const t of taskList) sortTasks(t.children);
  };

  sortTasks(roots);
  return roots;
}

/**
 * Flattens a tree back to a list of tasks in visual order (pre-order traversal).
 */
export function flattenTaskTree(tree: TaskNode[]): TaskNode[] {
  const flattened: TaskNode[] = [];
  const traverse = (node: TaskNode) => {
    flattened.push(node);
    node.children.forEach(traverse);
  };
  tree.forEach(traverse);
  return flattened;
}

/**
 * Calculates the depth of a task in the tree (0-based).
 */
export function getTaskDepth(
  task: TaskDoc,
  taskMap: Map<Id<'tasks'>, TaskDoc>
): number {
  let depth = 0;
  let current: TaskDoc | undefined = task;
  while (current?.parentTaskId) {
    const parent = taskMap.get(current.parentTaskId);
    if (!parent) break;
    depth++;
    current = parent;
  }
  return depth;
}
