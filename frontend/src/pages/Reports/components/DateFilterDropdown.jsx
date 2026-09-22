import React, { useState } from 'react';
import { Dropdown, Button, DatePicker, Radio, Typography, Divider } from 'antd';
import { Calendar, ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';

const { Text } = Typography;

const DateFilterDropdown = ({ onApply, onClear, defaultFilter = 'thisMonth', defaultLabel = 'This Month' }) => {
  const [open, setOpen] = useState(false);
  const [filterType, setFilterType] = useState(defaultFilter);
  const [customRange, setCustomRange] = useState([null, null]);
  const [activeLabel, setActiveLabel] = useState(defaultLabel);

  const handleApply = () => {
    let fromDate = null;
    let toDate = null;
    let label = '';

    if (filterType === 'thisWeek') {
      fromDate = dayjs().startOf('week').format('YYYY-MM-DD');
      toDate = dayjs().endOf('week').format('YYYY-MM-DD');
      label = 'This Week';
    } else if (filterType === 'thisMonth') {
      fromDate = dayjs().startOf('month').format('YYYY-MM-DD');
      toDate = dayjs().endOf('month').format('YYYY-MM-DD');
      label = 'This Month';
    } else if (filterType === 'custom') {
      if (customRange[0] && customRange[1]) {
        fromDate = customRange[0].format('YYYY-MM-DD');
        toDate = customRange[1].format('YYYY-MM-DD');
        label = `${customRange[0].format('MMM D, YYYY')} - ${customRange[1].format('MMM D, YYYY')}`;
      } else {
        return; // require both
      }
    }

    setActiveLabel(label);
    onApply({ fromDate, toDate, label, filterType });
    setOpen(false);
  };

  const handleClear = () => {
    setFilterType('none');
    setCustomRange([null, null]);
    setActiveLabel('Date Range');
    onClear();
    setOpen(false);
  };

  const menu = (
    <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', width: 300 }}>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>Date Range</Text>
      
      <Radio.Group 
        value={filterType} 
        onChange={e => setFilterType(e.target.value)}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <Radio value="thisWeek">This Week</Radio>
        <Radio value="thisMonth">This Month</Radio>
        <Radio value="custom">Custom Range</Radio>
      </Radio.Group>

      {filterType === 'custom' && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>From</Text>
            <DatePicker 
              value={customRange[0]}
              onChange={val => setCustomRange([val, customRange[1]])}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>To</Text>
            <DatePicker 
              value={customRange[1]}
              onChange={val => setCustomRange([customRange[0], val])}
              disabledDate={current => customRange[0] && current.isBefore(customRange[0], 'day')}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button onClick={handleClear} type="text">Clear</Button>
        <Button 
          type="primary" 
          onClick={handleApply}
          disabled={filterType === 'custom' && (!customRange[0] || !customRange[1])}
        >
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown 
      dropdownRender={() => menu}
      trigger={['click']}
      open={open}
      onOpenChange={setOpen}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '0 8px' }}>
        <Calendar size={16} color="var(--text-tertiary)" />
        <Text style={{ fontWeight: 500 }}>{activeLabel}</Text>
        <ChevronDown size={14} color="var(--text-tertiary)" />
      </div>
    </Dropdown>
  );
};

export default DateFilterDropdown;
