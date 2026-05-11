import { useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { navigateBackSafely } from '../utils/navigation';

/**
 * Custom hook to allow swipe-to-back functionality on pages without a dedicated back button.
 * Triggers history.goBack() when horizontal swipe crosses the threshold.
 */
export function useSwipeBack(enabled = true, threshold = 90) {
    const history = useHistory();
    const location = useLocation();

    useEffect(() => {
        if (!enabled) return;

        let touchStartX = 0;
        let touchStartY = 0;
        let isSweeping = false;

        const handleTouchStart = (e: TouchEvent) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSweeping = true;
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isSweeping) return;
            const touchEndX = e.touches[0].clientX;
            const touchEndY = e.touches[0].clientY;

            const dx = touchEndX - touchStartX;
            const dy = touchEndY - touchStartY;

            // If vertical movement is significant, user is likely scrolling the page up/down. Cancel swipe
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
                isSweeping = false;
                return;
            }

            // Only keep the intended left-swipe-back gesture.
            if (dx < -threshold) {
                isSweeping = false; // prevent multiple triggers
                navigateBackSafely(history, location.pathname, '/home');
            }
        };

        const handleTouchEnd = () => {
            isSweeping = false;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [history, location.pathname, threshold, enabled]);
}
