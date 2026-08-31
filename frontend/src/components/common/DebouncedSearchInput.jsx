import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const DebouncedSearchInput = ({ 
  placeholder = "Search...", 
  onChange, 
  debounceDelay = 500,
  style = {},
  ...rest
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const isFirstRender = React.useRef(true);

  // Store latest onChange without triggering effect
  const onChangeRef = React.useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const handler = setTimeout(() => {
      if (onChangeRef.current) {
        onChangeRef.current(searchTerm);
      }
    }, debounceDelay);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm, debounceDelay]);

  return (
    <Input
      placeholder={placeholder}
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
      allowClear
      style={{ width: "100%", ...style }}
      {...rest}
    />
  );
};

export default DebouncedSearchInput;
