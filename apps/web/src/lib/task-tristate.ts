export type TriState = 'todo' | 'ongoing' | 'done';

export function getTriState(
  taskStatus: string,
  isActive: boolean = false
): TriState {
  if (taskStatus === 'done' || taskStatus === 'cancelled') {
    return 'done';
  }
  if (isActive || taskStatus === 'in_progress') {
    return 'ongoing';
  }
  return 'todo';
}

export function getNextTriState(state: TriState): TriState {
  if (state === 'todo') return 'ongoing';
  if (state === 'ongoing') return 'done';
  return 'todo';
}

export function triStateToStatus(
  state: TriState
): 'todo' | 'in_progress' | 'done' {
  if (state === 'ongoing') return 'in_progress';
  if (state === 'done') return 'done';
  return 'todo';
}
