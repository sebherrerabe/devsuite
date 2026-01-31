import { toast } from 'sonner';

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, {
      description,
    });
  },
  error: (message: string, description?: string) => {
    toast.error(message, {
      description,
    });
  },
  info: (message: string, description?: string) => {
    toast.info(message, {
      description,
    });
  },
  warning: (message: string, description?: string) => {
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
