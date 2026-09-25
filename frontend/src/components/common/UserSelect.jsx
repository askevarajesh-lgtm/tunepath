
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Select, Spin } from 'antd';
import { useGetUsersDropdownQuery } from '../../api/userApi';


const UserSelect = ({ 
  value, 
  onChange, 
  mode, 
  placeholder = "Select user(s)", 
  disabled, 
  style, 
  className,
  allowClear = true,
  companyId, // Optional, for filtering
  role, // Optional, for filtering
  ...restProps
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const limit = 50;

  // Track if we need to include specific IDs to ensure currently selected values display correctly
  const includeIds = useMemo(() => {
    if (!value) return '';
    if (Array.isArray(value)) return value.join(',');
    return value;
  }, [value]);

  const queryArgs = useMemo(() => {
    const args = { page, limit, search: searchTerm };
    if (includeIds && page === 1) args.includeIds = includeIds;
    if (companyId) args.companyId = companyId;
    if (role) args.role = role;
    return args;
  }, [page, limit, searchTerm, includeIds, companyId, role]);

  const { data, isLoading, isFetching } = useGetUsersDropdownQuery(queryArgs);

  // Update internal users array when data changes
  useEffect(() => {
    if (data?.data?.users) {
      if (page === 1) {
        setUsers(data.data.users);
      } else {
        setUsers(prev => {
          const newUsers = [...prev];
          const existingIds = new Set(prev.map(u => u._id));
          data.data.users.forEach(u => {
            if (!existingIds.has(u._id)) {
              newUsers.push(u);
            }
          });
          return newUsers;
        });
      }
      setHasMore(data.data.pagination?.hasMore || false);
    }
  }, [data, page]);

  const debouncedSearch = useRef(
    debounce((value) => {
      setSearchTerm(value);
      setPage(1); // Reset page on new search
    }, 400)
  ).current;

  const handleSearch = (value) => {
    debouncedSearch(value);
  };

  const handlePopupScroll = (e) => {
    const { target } = e;
    if (target.scrollTop + target.offsetHeight === target.scrollHeight) {
      if (hasMore && !isFetching) {
        setPage(prev => prev + 1);
      }
    }
  };

  const handleDropdownVisibleChange = (open) => {
    if (open && page > 1) {
      // Reset when opening again to prevent bloated lists if not needed
      // Actually, keeping the loaded list is fine, but if you want to reset:
      // setPage(1);
    }
  };

  return (
    <Select
      {...restProps}
      mode={mode}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={style}
      className={className}
      allowClear={allowClear}
      showSearch
      onSearch={handleSearch}
      filterOption={false} // Server-side filtering
      onPopupScroll={handlePopupScroll}
      onDropdownVisibleChange={handleDropdownVisibleChange}
      notFoundContent={isLoading || isFetching ? <Spin size="small" /> : null}
      loading={isLoading}
    >
      {users.map(user => (
        <Select.Option key={user._id} value={user._id}>
          {user.name} {user.departmentName ? `(${user.departmentName})` : ''} {user.role ? `[${user.role.replace(/_/g, ' ')}]` : ''}
        </Select.Option>
      ))}
      {(isLoading || isFetching) && page > 1 && (
        <Select.Option key="loading" disabled>
          <Spin size="small" style={{ marginLeft: 8 }} /> Loading more...
        </Select.Option>
      )}
    </Select>
  );
};

export default UserSelect;
