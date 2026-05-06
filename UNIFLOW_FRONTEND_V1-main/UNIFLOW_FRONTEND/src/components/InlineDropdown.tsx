import React from 'react';
import './InlineDropdown.css';

export interface DropdownOption {
    label: string;
    value: string;
}

interface InlineDropdownProps {
    label: string;
    options: DropdownOption[];
    selectedValue: string;
    isOpen: boolean;
    onSelect: (value: string) => void;
    onToggle: () => void;
}

const InlineDropdown: React.FC<InlineDropdownProps> = ({
    label,
    options,
    selectedValue,
    isOpen,
    onSelect,
    onToggle,
}) => {
    // Find the label of the currently selected option
    const selectedLabel = options.find((opt) => opt.value === selectedValue)?.label || selectedValue;

    return (
        <div className="inline-dropdown-container">
            <div
                className={`preference-dropdown ${isOpen ? 'active' : ''}`}
                onClick={onToggle}
            >
                <div className="preference-content">
                    <h4 className="preference-title">{label}</h4>
                </div>
                <div className="preference-control">
                    {/* We hide the span text in CSS as per the mockup, but keeping it for accessibility */}
                    <span className="preference-value">{selectedLabel}</span>
                    <svg
                        className={`dropdown-chevron ${isOpen ? 'open' : ''}`}
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="#666"
                    >
                        <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
                    </svg>
                </div>
            </div>

            {isOpen && (
                <div className="dropdown-menu">
                    {options.map((option) => (
                        <div
                            key={option.value}
                            className="dropdown-option"
                            onClick={() => onSelect(option.value)}
                        >
                            <span className={`option-label ${selectedValue === option.value ? 'selected-text' : ''}`}>
                                {option.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InlineDropdown;
