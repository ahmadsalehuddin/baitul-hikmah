import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Controls that hide after `delay` ms of inactivity while `active` (playing), and come back on
 * any activity. Hovering or focusing the controls pins them open. Always visible when not active.
 */
export function useAutoHide(active, delay = 3000) {
  const [visible, setVisible] = useState(true);
  const timer = useRef(null);
  const pinned = useRef(false);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    if (active && !pinned.current) timer.current = setTimeout(() => setVisible(false), delay);
  }, [active, delay]);

  const show = useCallback(() => {
    setVisible(true);
    schedule();
  }, [schedule]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    if (active) setVisible(false);
  }, [active]);

  useEffect(() => {
    if (active) show();
    else {
      clearTimeout(timer.current);
      setVisible(true);
    }
    return () => clearTimeout(timer.current);
  }, [active, show]);

  const pinProps = {
    onPointerEnter: () => {
      pinned.current = true;
      clearTimeout(timer.current);
    },
    onPointerLeave: () => {
      pinned.current = false;
      schedule();
    },
    onFocus: () => {
      pinned.current = true;
      setVisible(true);
      clearTimeout(timer.current);
    },
    onBlur: () => {
      pinned.current = false;
      schedule();
    },
  };

  return { visible: visible || !active, show, hide, pinProps };
}
