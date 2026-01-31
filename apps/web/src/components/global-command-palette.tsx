import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { Settings, LayoutGrid, CheckSquare } from 'lucide-react';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import { api } from '../../../../convex/_generated/api';
import { useCurrentCompany } from '@/lib/company-context';
import { TaskSheet } from '@/components/task-sheet';
import type { Id } from '../../../../convex/_generated/dataModel';

export function GlobalCommandPalette() {
  const [open, setOpen] = React.useState(false);
  const { currentCompany } = useCurrentCompany();
  const navigate = useNavigate();

  // Task Sheet State
  const [selectedTaskId, setSelectedTaskId] =
    React.useState<Id<'tasks'> | null>(null);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = React.useState(false);

  // Data Fetching
  const projects = useQuery(
    api.projects.listProjects,
    currentCompany ? { companyId: currentCompany._id } : 'skip'
  );

  const tasks = useQuery(
    api.tasks.listAllTasks,
    currentCompany ? { companyId: currentCompany._id } : 'skip'
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(open => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  if (!currentCompany) return null;

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          <CommandGroup heading="Projects">
            {projects?.map(project => (
              <CommandItem
                key={project._id}
                onSelect={() => {
                  runCommand(() =>
                    navigate({
                      to: '/projects/$projectId/tasks',
                      params: { projectId: project._id },
                    })
                  );
                }}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>{project.name}</span>
                {project.isFavorite && <CommandShortcut>★</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Tasks">
            {tasks?.map(task => (
              <CommandItem
                key={task._id}
                onSelect={() => {
                  runCommand(() => {
                    setSelectedTaskId(task._id);
                    setIsTaskSheetOpen(true);
                  });
                }}
              >
                <CheckSquare className="mr-2 h-4 w-4" />
                <span>{task.title}</span>
                <span className="ml-2 text-xs text-muted-foreground capitalize">
                  {task.status.replace('_', ' ')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Company Settings">
            <CommandItem
              onSelect={() => {
                runCommand(() => navigate({ to: '/settings/company' }));
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Global Task Sheet */}
      <TaskSheet
        taskId={selectedTaskId}
        companyId={currentCompany._id}
        open={isTaskSheetOpen}
        onOpenChange={setIsTaskSheetOpen}
      />
    </>
  );
}
