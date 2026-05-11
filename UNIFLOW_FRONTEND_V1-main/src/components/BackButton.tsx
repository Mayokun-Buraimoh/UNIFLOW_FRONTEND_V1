import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import './BackButton.css';
import { getDefaultStartPath } from '../utils/appPreferences';

interface BackButtonProps {
    onClick?: () => void;
    to?: string;
    className?: string;
    icon?: string;
    style?: React.CSSProperties;
}

/**
 * A bulletproof BackButton component designed to eliminate all visual shifts or jitter on interaction.
 * Uses a strict CSS reset to disable ripples, transforms, and layout reflows.
 */
const BackButton: React.FC<BackButtonProps> = ({ 
    onClick,
    to,
    className = '', 
    icon = arrowBackOutline,
    style
}) => {
    const history = useHistory();
    const location = useLocation();

    const getFallbackPath = () => {
        const pathname = location.pathname;
        if (pathname === '/login' || pathname === '/register') return '/signup';
        if (pathname === '/signup') return '/onboarding2';
        if (pathname === '/onboarding2') return '/onboarding';
        if (pathname === '/onboarding') return '/splash';
        const defaultPath = getDefaultStartPath();
        // Bottom nav uses `root` + `replace`, so stack depth is often 1. If the user's
        // default start page equals the current route, `replace(default)` would no-op.
        if (defaultPath === pathname) {
            return '/home';
        }
        return defaultPath;
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (to) {
            history.push(to);
        } else if (onClick) {
            onClick();
        } else {
            if (history.length > 1) {
                history.goBack();
            } else {
                history.replace(getFallbackPath());
            }
        }
    };

    return (
        <button 
            type="button"
            className={`stable-back-button ${className}`}
            onClick={handleClick}
            onMouseDown={(e) => e.preventDefault()} // Prevent focus ring shift on some browsers
            style={style}
            aria-label="Go back"
        >
            <IonIcon icon={icon} className="stable-back-icon" />
        </button>
    );
};

export default BackButton;
