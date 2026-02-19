import { toast } from 'sonner';

type ToastLevel = 'success' | 'info' | 'warning' | 'error';

function isCompanionDesktopContext(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return (
    window.location.pathname === '/session-companion' &&
    !!window.desktopCompanionUi?.notify
  );
}

function showCompanionNativeToast(
  level: ToastLevel,
  message: string,
  description?: string
): boolean {
  if (!isCompanionDesktopContext()) {
    return false;
  }

  void window.desktopCompanionUi?.notify({
    level,
    title: message,
    body: description ?? null,
  });
  return true;
}

export const showToast = {
  success: (message: string, description?: string) => {
    if (showCompanionNativeToast('success', message, description)) {
      return;
    }
    toast.success(message, {
      description,
    });
  },
  error: (message: string, description?: string) => {
    if (showCompanionNativeToast('error', message, description)) {
      return;
    }
    toast.error(message, {
      description,
    });
  },
  info: (message: string, description?: string) => {
    if (showCompanionNativeToast('info', message, description)) {
      return;
    }
    toast.info(message, {
      description,
    });
  },
  warning: (message: string, description?: string) => {
    if (showCompanionNativeToast('warning', message, description)) {
      return;
    }
    toast.warning(message, {
      description,
    });
  },
  loading: (message: string, description?: string) => {
    return toast.loading(message, {
      description,
    });
  },
  promise: <T>(
    promise: Promise<T>,
    {
      loading,
      success,
      error,
    }: {
      loading: string;
      success: (data: T) => string;
      error: (err: unknown) => string;
    }
  ) => {
    return toast.promise(promise, {
      loading,
      success,
      error,
    });
  },
};
