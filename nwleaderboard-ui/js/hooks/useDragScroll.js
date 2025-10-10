export default function useDragScroll(ref, options = {}) {
  React.useEffect(() => {
    const target = ref && 'current' in ref ? ref.current : null;
    if (!target) {
      return undefined;
    }

    const threshold = Math.max(0, Number(options.threshold) || 8);

    let pointerActive = false;
    let dragging = false;
    let suppressClick = false;
    let startX = 0;
    let startScrollLeft = 0;
    let pendingScrollLeft = null;
    let animationFrame = null;

    const cancelScheduledFrame = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
    };

    const flushScroll = () => {
      animationFrame = null;
      if (pendingScrollLeft !== null) {
        target.scrollLeft = pendingScrollLeft;
        pendingScrollLeft = null;
      }
    };

    const scheduleScroll = (value) => {
      pendingScrollLeft = value;
      if (animationFrame === null) {
        animationFrame = window.requestAnimationFrame(flushScroll);
      }
    };

    const clearDragState = () => {
      pointerActive = false;
      dragging = false;
      target.classList.remove('is-dragging');
      cancelScheduledFrame();
      pendingScrollLeft = null;
    };

    const handlePointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      pointerActive = true;
      dragging = false;
      suppressClick = false;
      startX = event.clientX;
      startScrollLeft = target.scrollLeft;
    };

    const handlePointerMove = (event) => {
      if (!pointerActive) {
        return;
      }
      const deltaFromStart = event.clientX - startX;
      if (!dragging && Math.abs(deltaFromStart) >= threshold) {
        dragging = true;
        target.classList.add('is-dragging');
      }
      if (!dragging) {
        return;
      }
      event.preventDefault();
      scheduleScroll(startScrollLeft - deltaFromStart);
    };

    const handlePointerEnd = () => {
      if (!pointerActive) {
        return;
      }
      if (dragging) {
        suppressClick = true;
        window.requestAnimationFrame(() => {
          suppressClick = false;
        });
      }
      clearDragState();
    };

    const handlePointerCancel = () => {
      clearDragState();
    };

    const handleClickCapture = (event) => {
      if (suppressClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    target.addEventListener('pointerdown', handlePointerDown);
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerEnd);
    target.addEventListener('pointerleave', handlePointerCancel);
    target.addEventListener('pointercancel', handlePointerCancel);
    target.addEventListener('click', handleClickCapture, true);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerEnd);
      target.removeEventListener('pointerleave', handlePointerCancel);
      target.removeEventListener('pointercancel', handlePointerCancel);
      target.removeEventListener('click', handleClickCapture, true);
      clearDragState();
    };
  }, [ref, options.threshold]);
}
