export default function useDragScroll(ref) {
  React.useEffect(() => {
    const target = ref && 'current' in ref ? ref.current : null;
    if (!target) {
      return undefined;
    }

    let isActive = false;
    let hasMoved = false;
    let startX = 0;
    let startScrollLeft = 0;

    const stopDragging = (event) => {
      if (!isActive) {
        return;
      }
      isActive = false;
      target.classList.remove('is-dragging');
      if (event && typeof event.pointerId === 'number') {
        try {
          target.releasePointerCapture(event.pointerId);
        } catch (error) {
          // Ignore release errors
        }
      }
      window.setTimeout(() => {
        hasMoved = false;
      }, 0);
    };

    const handlePointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) {
        return;
      }
      isActive = true;
      hasMoved = false;
      startX = event.clientX;
      startScrollLeft = target.scrollLeft;
      target.classList.add('is-dragging');
      try {
        target.setPointerCapture(event.pointerId);
      } catch (error) {
        // Ignore capture errors
      }
      event.preventDefault();
    };

    const handlePointerMove = (event) => {
      if (!isActive) {
        return;
      }
      const deltaX = event.clientX - startX;
      if (!hasMoved && Math.abs(deltaX) > 3) {
        hasMoved = true;
      }
      target.scrollLeft = startScrollLeft - deltaX;
    };

    const handlePointerUp = (event) => {
      stopDragging(event);
    };

    const handlePointerCancel = (event) => {
      stopDragging(event);
    };

    const handleClickCapture = (event) => {
      if (hasMoved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    target.addEventListener('pointerdown', handlePointerDown, { passive: false });
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointerleave', handlePointerCancel);
    target.addEventListener('pointercancel', handlePointerCancel);
    target.addEventListener('click', handleClickCapture, true);

    return () => {
      target.removeEventListener('pointerdown', handlePointerDown);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointerleave', handlePointerCancel);
      target.removeEventListener('pointercancel', handlePointerCancel);
      target.removeEventListener('click', handleClickCapture, true);
      target.classList.remove('is-dragging');
    };
  }, [ref]);
}
