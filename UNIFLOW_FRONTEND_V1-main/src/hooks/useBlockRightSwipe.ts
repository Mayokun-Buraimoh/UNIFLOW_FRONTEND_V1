import { useEffect } from 'react';

/**
 * Custom hook to block rightward swipe gestures (like native swipe-to-go-back)
 * on specific screens. It prevents the default touchmove behavior
 * when a rightward drag is detected, while preserving other gestures like vertical scrolling.
 */
export function useBlockRightSwipe() {
    useEffect(() => {
        let startX = 0;
        let startY = 0;
        let isDragging = false;

        const getCoords = (e: Event) => {
            if ('touches' in e) {
                const te = e as TouchEvent;
                if (te.touches.length > 0) {
                    return { x: te.touches[0].clientX, y: te.touches[0].clientY };
                }
            } else if ('clientX' in e) {
                const pe = e as MouseEvent | PointerEvent;
                return { x: pe.clientX, y: pe.clientY };
            }
            return { x: 0, y: 0 };
        };

        const handleStart = (e: Event) => {
            const { x, y } = getCoords(e);
            startX = x;
            startY = y;
            isDragging = true;
        };

        const handleEnd = () => {
            isDragging = false;
        };

        const handleCancel = () => {
            isDragging = false;
        };

        const handleMove = (e: Event) => {
            if (!isDragging) return;
            const { x, y } = getCoords(e);
            
            const dx = x - startX;
            const dy = y - startY;

            // Check if it's a rightward swipe (dx > 0) and more horizontal than vertical
            if (dx > 10 && Math.abs(dx) > Math.abs(dy)) {
                // Block rightward horizontal drags everywhere, including left-edge starts.
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        };

        // Use capture phase to intercept the events BEFORE Ionic's Gesture Controller gets them
        const opts = { capture: true, passive: false };
        const passiveOpts = { capture: true, passive: true };

        document.addEventListener('touchstart', handleStart, passiveOpts);
        document.addEventListener('touchmove', handleMove, opts);
        document.addEventListener('touchend', handleEnd, passiveOpts);
        document.addEventListener('touchcancel', handleCancel, passiveOpts);
        
        document.addEventListener('pointerdown', handleStart, passiveOpts);
        document.addEventListener('pointermove', handleMove, opts);
        document.addEventListener('pointerup', handleEnd, passiveOpts);
        document.addEventListener('pointercancel', handleCancel, passiveOpts);

        return () => {
            document.removeEventListener('touchstart', handleStart, passiveOpts);
            document.removeEventListener('touchmove', handleMove, opts);
            document.removeEventListener('touchend', handleEnd, passiveOpts);
            document.removeEventListener('touchcancel', handleCancel, passiveOpts);
            
            document.removeEventListener('pointerdown', handleStart, passiveOpts);
            document.removeEventListener('pointermove', handleMove, opts);
            document.removeEventListener('pointerup', handleEnd, passiveOpts);
            document.removeEventListener('pointercancel', handleCancel, passiveOpts);
        };
    }, []);
}
