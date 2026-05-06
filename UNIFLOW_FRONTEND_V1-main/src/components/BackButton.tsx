import React from 'react';
import { useHistory } from 'react-router-dom';
import { IonIcon } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import './BackButton.css';

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

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (to) {
            history.push(to);
        } else if (onClick) {
            onClick();
        } else {
            history.goBack();
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
