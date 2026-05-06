import React from 'react';
import { useHistory } from 'react-router-dom';
import BackButton from './BackButton';
import './PageHeader.css';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  showStatusBar?: boolean;
  backgroundColor?: string;
  textColor?: string;
  onBackClick?: () => void;
  rightContent?: React.ReactNode;
  children?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  showBackButton = true,
  showStatusBar = true,
  backgroundColor = '#447055',
  textColor = 'white',
  onBackClick,
  rightContent,
  children
}) => {
  const history = useHistory();

  return (
    <>
      {/* Status Bar Spacer */}
      {showStatusBar && <div className="status-bar-spacer"></div>}
      
      {/* Header */}
      <div 
        className="page-header"
        style={{ 
          backgroundColor,
          color: textColor
        }}
      >
        <div className="header-left">
          {showBackButton && (
            <BackButton 
              onClick={onBackClick} 
              style={{ color: textColor }} 
            />
          )}
        </div>
        
        <div className="header-center">
          <h1 className="page-title">{title}</h1>
          {children}
        </div>
        
        <div className="header-right">
          {rightContent}
        </div>
      </div>
    </>
  );
};

export default PageHeader;
