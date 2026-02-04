import { Sidebar } from './sidebar';
import { Header } from './header';
import { RouterDebugObserver } from '@/components/router-debug-observer';
import { Outlet } from '@tanstack/react-router';
import { GlobalCommandPalette } from './global-command-palette';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { useState, useRef, useEffect, useCallback } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';

const SIDEBAR_COLLAPSED_KEY = 'devsuite-sidebar-collapsed';
const SIDEBAR_SIZE_KEY = 'devsuite-sidebar-size';
const SIDEBAR_DEFAULT_SIZE = 20;
const SIDEBAR_MIN_SIZE = 15;
const SIDEBAR_MAX_SIZE = 30;
const SIDEBAR_COLLAPSED_SIZE_PX = 56;
const SIDEBAR_COLLAPSED_THRESHOLD_PX = 88;

export function AppShell() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<PanelImperativeHandle>(null);
  const initialCollapsed = useRef(isCollapsed);
  const [initialSidebarSize] = useState(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT_SIZE;
    const saved = Number(localStorage.getItem(SIDEBAR_SIZE_KEY));
    if (Number.isFinite(saved) && saved >= SIDEBAR_MIN_SIZE) {
      return Math.min(saved, SIDEBAR_MAX_SIZE);
    }
    return SIDEBAR_DEFAULT_SIZE;
  });
  const lastExpandedSizeRef = useRef(initialSidebarSize);

  const persistCollapsed = useCallback((next: boolean) => {
    setIsCollapsed(prev => {
      if (prev === next) return prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      }
      return next;
    });
  }, []);

  const persistSidebarSize = useCallback(
    (size: number | { asPercentage?: number }) => {
      if (typeof window === 'undefined') return;
      const nextSize =
        typeof size === 'number' ? size : (size?.asPercentage ?? null);
      if (typeof nextSize === 'number' && Number.isFinite(nextSize)) {
        const clamped = Math.min(
          SIDEBAR_MAX_SIZE,
          Math.max(SIDEBAR_MIN_SIZE, nextSize)
        );
        lastExpandedSizeRef.current = clamped;
        localStorage.setItem(SIDEBAR_SIZE_KEY, String(clamped));
      }
    },
    []
  );

  const toggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (panel) {
      if (isCollapsed) {
        const lastExpandedSize = lastExpandedSizeRef.current;
        if (Number.isFinite(lastExpandedSize)) {
          panel.resize(`${lastExpandedSize}%`);
        } else {
          panel.expand();
        }
        persistCollapsed(false);
      } else {
        panel.collapse();
        persistCollapsed(true);
      }
    }
  }, [isCollapsed, persistCollapsed]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleResize = useCallback(
    (size: number | { inPixels?: number; asPercentage?: number }) => {
      let nextCollapsed = isCollapsed;
      if (typeof size === 'number') {
        nextCollapsed = size <= SIDEBAR_MIN_SIZE;
      } else if (size && typeof size === 'object') {
        if (typeof size.inPixels === 'number') {
          nextCollapsed = size.inPixels <= SIDEBAR_COLLAPSED_THRESHOLD_PX;
        } else if (typeof size.asPercentage === 'number') {
          nextCollapsed = size.asPercentage <= SIDEBAR_MIN_SIZE;
        }
      }

      if (nextCollapsed !== isCollapsed) {
        persistCollapsed(nextCollapsed);
      }
    },
    [isCollapsed, persistCollapsed]
  );

  useEffect(() => {
    if (initialCollapsed.current) {
      sidebarRef.current?.collapse();
    }
  }, []);

  const handleLayoutChanged = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    const size = panel.getSize();
    if (size.inPixels <= SIDEBAR_COLLAPSED_THRESHOLD_PX) return;
    persistSidebarSize(size);
  }, [persistSidebarSize]);

  // Attach global mouseup listener to detect end of dragging even if mouse leaves handle
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchend', handleDragEnd);
    } else {
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragEnd]);

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      <RouterDebugObserver />
      <GlobalCommandPalette />
      <Header />
      <div className="flex-1 overflow-hidden pt-14">
        <ResizablePanelGroup
          orientation="horizontal"
          onLayoutChanged={handleLayoutChanged}
        >
          <ResizablePanel
            panelRef={sidebarRef}
            defaultSize={`${initialSidebarSize}%`}
            minSize={`${SIDEBAR_MIN_SIZE}%`}
            maxSize={`${SIDEBAR_MAX_SIZE}%`}
            collapsible={true}
            collapsedSize={`${SIDEBAR_COLLAPSED_SIZE_PX}px`}
            onResize={handleResize}
            className={cn(
              'hidden md:block',
              // Only animate width if NOT dragging.
              // This ensures smooth toggle button animation but instant drag response.
              !isDragging &&
                'transition-[flex-basis,width] duration-300 ease-in-out',
              isCollapsed && 'min-w-[50px]'
            )}
          >
            <Sidebar isCollapsed={isCollapsed} onToggle={toggleSidebar} />
          </ResizablePanel>
          <ResizableHandle
            className="hidden md:flex"
            withHandle
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          />
          <ResizablePanel>
            <main className="h-full w-full overflow-y-auto p-4 md:p-6">
              <Outlet />
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
