import { useState, useMemo, useCallback } from 'react';

const usePagination = (options = {}) => {
  const [current, setCurrent] = useState(options.defaultCurrent || 1);
  const [pageSize, setPageSize] = useState(options.defaultPageSize || 10);
  const [search, setSearch] = useState('');

  const pagination = useMemo(() => ({
    current,
    pageSize,
    onChange: (p, s) => { setCurrent(p); setPageSize(s); },
    total: 0,
  }), [current, pageSize]);

  const queryParams = useMemo(() => ({
    page: current,
    limit: pageSize,
    search,
  }), [current, pageSize, search]);

  const handleTableChange = useCallback((newPagination) => {
    setCurrent(newPagination.current);
    setPageSize(newPagination.pageSize);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setCurrent(1);
  }, []);

  const setPagination = useCallback((setter) => {
    if (typeof setter === 'function') {
      setCurrent(prev => {
        const val = setter({ current: prev, pageSize });
        if (val.pageSize) setPageSize(val.pageSize);
        return val.current || prev;
      });
    } else {
      if (setter.current) setCurrent(setter.current);
      if (setter.pageSize) setPageSize(setter.pageSize);
    }
  }, [pageSize]);

  return { pagination, queryParams, handleTableChange, handleSearchChange, setPagination };
};

export default usePagination;
