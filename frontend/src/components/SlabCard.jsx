import React, { useState } from 'react';
import { Card } from 'antd';

const SlabCard = ({ children, style, bodyStyle, shadowColor = 'var(--text-primary)', className, onClick, ...rest }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Card 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      className={`glassmorphism ${className || ''}`}
      bodyStyle={{ padding: '24px 28px', ...bodyStyle }} 
      {...rest}
      style={{ 
        borderRadius: 12, 
        border: '2px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        boxShadow: isHovered ? '0px 0px 0px transparent' : `6px 6px 0px ${shadowColor}`,
        transform: isHovered ? 'translate(6px, 6px)' : 'translate(0px, 0px)',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        ...style 
      }}
    >
      {children}
    </Card>
  );
};

export default SlabCard;
