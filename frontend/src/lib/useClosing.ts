import { useCallback, useState } from "react";

/**
 * Plays a panel's exit animation before actually unmounting it, so closing
 * feels as physical as opening instead of the panel just vanishing. Panels
 * still only close via their X button or an outside click — this doesn't
 * add any swipe/drag gesture, it just gives those two triggers a real
 * motion to play instead of an instant unmount.
 */
export function useClosing(onClose: () => void, durationMs = 220) {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, durationMs);
  }, [closing, onClose]);

  return { closing, requestClose };
}
