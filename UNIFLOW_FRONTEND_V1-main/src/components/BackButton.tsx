import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import './BackButton.css';
import { navigateBackSafely } from '../utils/navigation';

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

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (to) {
            history.push(to);
        } else if (onClick) {
            onClick();
        } else {
            navigateBackSafely(history, location.pathname);
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
