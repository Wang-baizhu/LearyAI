// useCountdown 封装倒计时逻辑，供验证码等场景共享。
import { useEffect, useRef, useState } from 'react';

export const useCountdown = (initialSeconds: number) => {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<number | null>(null);

  const start = () => {
    setRemaining(initialSeconds);
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    remaining,
    isRunning: remaining > 0,
    start,
  };
};
