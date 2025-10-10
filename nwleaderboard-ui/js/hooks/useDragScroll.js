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
    let lastX = 0;

    const clearDragState = () => {
      pointerActive = false;
      dragging = false;
      target.classList.remove('is-dragging');
    };

    const handlePointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      pointerActive = true;
      dragging = false;
      suppressClick = false;
      startX = event.clientX;
      lastX = event.clientX;
      if (typeof event.pointerId === 'number' && target.setPointerCapture) {
        try {
          target.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore capture errors
        }
      }
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
      const movementX = lastX - event.clientX;
      lastX = event.clientX;
      if (movementX !== 0) {
        event.preventDefault();
        target.scrollLeft += movementX;
      }
    };

    const handlePointerEnd = (event) => {
      if (!pointerActive) {
        return;
      }
      if (dragging) {
        suppressClick = true;
        window.setTimeout(() => {
          suppressClick = false;
        }, 0);
      }
      if (event && typeof event.pointerId === 'number' && target.releasePointerCapture) {
        try {
          target.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release errors
        }
      }
      clearDragState();
    };

    const handlePointerCancel = (event) => {
      handlePointerEnd(event);
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
