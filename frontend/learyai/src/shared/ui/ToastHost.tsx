// ToastHost 负责把主站 Redux toast 状态接入通用 @leary/ui ToastHost。
import { useAppDispatch, useAppSelector } from '@/app/store/hooks';
import { dismissToast } from '@/app/store/ui/toastSlice';
import MaterialIcon from '@/shared/ui/icons/MaterialIcon';
import { ToastHost as SharedToastHost, type ToastVariant } from '@leary/ui';

const getIconName = (variant: ToastVariant) => {
  if (variant === 'success') {
    return 'check';
  }
  if (variant === 'error') {
    return 'close';
  }
  return 'info';
};

const ToastHost = () => {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((state) => state.toast.toasts);

  return (
    <SharedToastHost
      toasts={toasts}
      onDismiss={(toastId) => {
        dispatch(dismissToast(toastId));
      }}
      renderIcon={(variant) => (
        <MaterialIcon name={getIconName(variant)} className="text-[15px]" />
      )}
    />
  );
};

export default ToastHost;
