import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Tag, Spin, Input, Empty, Button, Tooltip } from 'antd';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  CreditCard, 
  Briefcase, 
  AlertCircle, 
  UserCheck, 
  Search, 
  ArrowRight,
  Filter,
  Layers,
  Sparkles,
  HelpCircle,
  TrendingUp,
  FolderKanban
} from 'lucide-react';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

const formatStatus = (status) => {
  if (!status) return '';
  return status
    .toString()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const ClientActivity = ({ 
  clientId, 
  client, 
  compact = false, 
  limit = 50,
  onTaskClick 
}) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (clientId) {
      fetchClientActivities();
    }
  }, [clientId]);

  const fetchClientActivities = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const safeArray = (res) => (Array.isArray(res) ? res : []);

      // Fetch all client-associated records in parallel
      const [
        proposalsRes,
        invoicesRes,
        projectsRes,
        tasksRes,
        slaRes
      ] = await Promise.allSettled([
        fetch(`/api/proposals?clientId=${clientId}`, { headers }).then(r => r.json()),
        fetch(`/api/invoices?clientId=${clientId}`, { headers }).then(r => r.json()),
        fetch(`/api/projects?clientId=${clientId}`, { headers }).then(r => r.json()),
        fetch(`/api/tasks?companyId=${clientId}&limit=100`, { headers }).then(r => r.json()),
        fetch(`/api/sla?clientId=${clientId}`, { headers }).then(r => r.json())
      ]);

      let items = [];

      // 1. Process Proposals
      if (proposalsRes.status === 'fulfilled') {
        const pData = proposalsRes.value;
        const proposals = safeArray(pData?.data?.proposals || pData?.data || pData?.proposals);
        
        proposals.forEach(p => {
          const propTitle = p.title || p.name || 'Proposal';
          const amount = Number(p.totalAmount) || Number(p.value) || 0;
          const amtStr = amount > 0 ? ` · ₹${amount.toLocaleString()}` : '';

          // Creation event
          if (p.createdAt) {
            items.push({
              id: `prop-created-${p._id}`,
              date: p.createdAt,
              type: 'proposal',
              action: 'Proposal Created',
              title: `Proposal created: "${propTitle}"`,
              desc: `Proposal draft was created${amtStr}`,
              tag: 'Proposal',
              tagColor: '#6366f1',
              statusTag: p.status || 'Draft',
              statusColor: 'processing',
              icon: <FileText size={16} />
            });
          }

          // Status-specific events (e.g. Approved / Sent / Rejected)
          const statusLower = (p.status || '').toLowerCase();
          if (statusLower === 'approved' || statusLower === 'accepted') {
            items.push({
              id: `prop-approved-${p._id}`,
              date: p.approvedAt || p.updatedAt || p.createdAt,
              type: 'proposal',
              action: 'Proposal Approved',
              title: `Proposal approved: "${propTitle}"`,
              desc: `Proposal was accepted and approved${amtStr}`,
              tag: 'Proposal',
              tagColor: '#6366f1',
              statusTag: 'Approved',
              statusColor: 'success',
              icon: <CheckCircle2 size={16} />
            });
          } else if (statusLower === 'rejected' || statusLower === 'declined') {
            items.push({
              id: `prop-rejected-${p._id}`,
              date: p.updatedAt || p.createdAt,
              type: 'proposal',
              action: 'Proposal Rejected',
              title: `Proposal rejected: "${propTitle}"`,
              desc: `Proposal was marked rejected${amtStr}`,
              tag: 'Proposal',
              tagColor: '#6366f1',
              statusTag: 'Rejected',
              statusColor: 'error',
              icon: <XCircle size={16} />
            });
          } else if (statusLower === 'sent') {
            items.push({
              id: `prop-sent-${p._id}`,
              date: p.updatedAt || p.createdAt,
              type: 'proposal',
              action: 'Proposal Sent',
              title: `Proposal sent: "${propTitle}"`,
              desc: `Proposal was dispatched to client${amtStr}`,
              tag: 'Proposal',
              tagColor: '#6366f1',
              statusTag: 'Sent',
              statusColor: 'warning',
              icon: <ArrowRight size={16} />
            });
          }
        });
      }

      // 2. Process Invoices
      if (invoicesRes.status === 'fulfilled') {
        const iData = invoicesRes.value;
        const invoices = safeArray(iData?.data?.invoices || iData?.data || iData?.invoices);

        invoices.forEach(inv => {
          const invNum = inv.invoiceNumber || 'INV';
          const amount = Number(inv.grandTotal) || Number(inv.totalAmount) || 0;
          const amtStr = `₹${amount.toLocaleString()}`;

          // Invoice Created
          if (inv.createdAt || inv.invoiceDate) {
            items.push({
              id: `inv-created-${inv._id}`,
              date: inv.createdAt || inv.invoiceDate,
              type: 'invoice',
              action: 'Invoice Created',
              title: `Invoice #${invNum} generated`,
              desc: `Invoice for ${amtStr} was created`,
              tag: 'Invoice',
              tagColor: '#10b981',
              statusTag: inv.paymentStatus || 'Pending',
              statusColor: inv.paymentStatus === 'Paid' ? 'success' : 'warning',
              icon: <CreditCard size={16} />
            });
          }

          // Invoice Paid / Status
          const payStatus = (inv.paymentStatus || '').toLowerCase();
          if (payStatus === 'paid') {
            items.push({
              id: `inv-paid-${inv._id}`,
              date: inv.paidAt || inv.updatedAt || inv.createdAt,
              type: 'invoice',
              action: 'Invoice Paid',
              title: `Invoice #${invNum} paid`,
              desc: `Full payment of ${amtStr} received`,
              tag: 'Invoice',
              tagColor: '#10b981',
              statusTag: 'Paid',
              statusColor: 'success',
              icon: <CheckCircle2 size={16} />
            });
          } else if (payStatus === 'partially paid') {
            items.push({
              id: `inv-partial-${inv._id}`,
              date: inv.updatedAt || inv.createdAt,
              type: 'invoice',
              action: 'Invoice Partially Paid',
              title: `Partial payment on Invoice #${invNum}`,
              desc: `Partial payment processed for ${amtStr}`,
              tag: 'Invoice',
              tagColor: '#10b981',
              statusTag: 'Partially Paid',
              statusColor: 'warning',
              icon: <Clock size={16} />
            });
          } else if (payStatus === 'overdue') {
            items.push({
              id: `inv-overdue-${inv._id}`,
              date: inv.dueDate || inv.updatedAt,
              type: 'invoice',
              action: 'Invoice Overdue',
              title: `Invoice #${invNum} is overdue`,
              desc: `Payment of ${amtStr} is past due date`,
              tag: 'Invoice',
              tagColor: '#10b981',
              statusTag: 'Overdue',
              statusColor: 'error',
              icon: <AlertCircle size={16} />
            });
          }
        });
      }

      // 3. Process Projects
      if (projectsRes.status === 'fulfilled') {
        const pjData = projectsRes.value;
        const projects = safeArray(pjData?.data?.data || pjData?.data?.projects || pjData?.data || pjData?.projects);

        projects.forEach(pj => {
          const pjName = pj.name || 'Project';
          const billing = pj.billingType ? ` (${pj.billingType})` : '';

          // Project Created
          if (pj.createdAt) {
            items.push({
              id: `pj-created-${pj._id}`,
              date: pj.createdAt,
              type: 'project',
              action: 'Project Created',
              title: `Project created: "${pjName}"`,
              desc: `Client project initiated${billing}`,
              tag: 'Project',
              tagColor: '#0ea5e9',
              statusTag: pj.status || 'Active',
              statusColor: 'processing',
              icon: <Briefcase size={16} />
            });
          }

          // Project Completed
          const pjStatus = (pj.status || '').toLowerCase();
          if (pjStatus === 'completed') {
            items.push({
              id: `pj-completed-${pj._id}`,
              date: pj.updatedAt || pj.createdAt,
              type: 'project',
              action: 'Project Completed',
              title: `Project completed: "${pjName}"`,
              desc: `All deliverables for "${pjName}" finished`,
              tag: 'Project',
              tagColor: '#0ea5e9',
              statusTag: 'Completed',
              statusColor: 'success',
              icon: <CheckCircle2 size={16} />
            });
          }
        });
      }

      // 4. Process Tasks
      if (tasksRes.status === 'fulfilled') {
        const tData = tasksRes.value;
        const tasks = safeArray(tData?.data?.tasks || tData?.tasks || tData?.data);

        tasks.forEach(t => {
          const tTitle = t.title || 'Task';
          const code = t.taskCode ? `[${t.taskCode}] ` : '';
          const assignee = t.assignedTo?.name ? ` · Assigned to ${t.assignedTo.name}` : '';

          // Task Created
          if (t.createdAt) {
            items.push({
              id: `task-created-${t._id}`,
              date: t.createdAt,
              type: 'task',
              action: 'Task Created',
              title: `Task created: ${code}"${tTitle}"`,
              desc: `Task added to workspace${assignee}`,
              tag: 'Task',
              tagColor: '#f59e0b',
              statusTag: 'Created',
              statusColor: 'default',
              rawTask: t,
              icon: <Clock size={16} />
            });
          }

          // Task Status specific events
          const tStatus = (t.status || '').toLowerCase();
          if (tStatus === 'approved' || tStatus === 'validated') {
            items.push({
              id: `task-approved-${t._id}`,
              date: t.updatedAt || t.createdAt,
              type: 'task',
              action: 'Task Approved',
              title: `Task approved: ${code}"${tTitle}"`,
              desc: `Task deliverable was reviewed and approved${assignee}`,
              tag: 'Task',
              tagColor: '#10b981',
              statusTag: 'Approved',
              statusColor: 'success',
              rawTask: t,
              icon: <CheckCircle2 size={16} />
            });
          } else if (tStatus === 'rejected') {
            items.push({
              id: `task-rejected-${t._id}`,
              date: t.updatedAt || t.createdAt,
              type: 'task',
              action: 'Task Rejected',
              title: `Task rejected: ${code}"${tTitle}"`,
              desc: `Task feedback required / rejected${t.holdReason ? `: ${t.holdReason}` : ''}`,
              tag: 'Task',
              tagColor: '#ef4444',
              statusTag: 'Rejected',
              statusColor: 'error',
              rawTask: t,
              icon: <XCircle size={16} />
            });
          } else if (tStatus === 'completed' || tStatus === 'complete' || tStatus === 'done') {
            items.push({
              id: `task-completed-${t._id}`,
              date: t.updatedAt || t.createdAt,
              type: 'task',
              action: 'Task Completed',
              title: `Task completed: ${code}"${tTitle}"`,
              desc: `Task completed successfully${assignee}`,
              tag: 'Task',
              tagColor: '#10b981',
              statusTag: 'Completed',
              statusColor: 'success',
              rawTask: t,
              icon: <CheckCircle2 size={16} />
            });
          } else if (tStatus === 'in_progress' || tStatus === 'in progress') {
            items.push({
              id: `task-inprogress-${t._id}`,
              date: t.updatedAt || t.createdAt,
              type: 'task',
              action: 'Task In Progress',
              title: `Task started: ${code}"${tTitle}"`,
              desc: `Work in progress${assignee}`,
              tag: 'Task',
              tagColor: '#0ea5e9',
              statusTag: 'In Progress',
              statusColor: 'processing',
              rawTask: t,
              icon: <Clock size={16} />
            });
          }
        });
      }

      // 5. Process SLA Tickets
      if (slaRes.status === 'fulfilled') {
        const sData = slaRes.value;
        const slas = safeArray(sData?.data?.slas || sData?.data || sData?.slas);

        slas.forEach(s => {
          const sTitle = s.title || 'Support Request';
          const ticketNum = s.ticketNumber ? `#${s.ticketNumber} ` : '';

          if (s.createdAt) {
            items.push({
              id: `sla-created-${s._id}`,
              date: s.createdAt,
              type: 'support',
              action: 'Support Ticket Created',
              title: `SLA Ticket ${ticketNum}opened`,
              desc: `"${sTitle}" · Priority: ${s.priority || 'Normal'}`,
              tag: 'Support',
              tagColor: '#8b5cf6',
              statusTag: s.status || 'Open',
              statusColor: 'warning',
              icon: <AlertCircle size={16} />
            });
          }

          if (s.status === 'Resolved' || s.status === 'Closed') {
            items.push({
              id: `sla-resolved-${s._id}`,
              date: s.resolvedAt || s.updatedAt || s.createdAt,
              type: 'support',
              action: 'Support Ticket Resolved',
              title: `SLA Ticket ${ticketNum}resolved`,
              desc: `Ticket "${sTitle}" closed successfully`,
              tag: 'Support',
              tagColor: '#8b5cf6',
              statusTag: 'Resolved',
              statusColor: 'success',
              icon: <CheckCircle2 size={16} />
            });
          }
        });
      }

      // 6. Client Onboarding
      if (client?.createdAt) {
        items.push({
          id: `client-onboarded-${client._id || clientId}`,
          date: client.createdAt,
          type: 'client',
          action: 'Client Onboarded',
          title: `Client workspace provisioned`,
          desc: `"${client.name || 'Client'}" registered in agency portal`,
          tag: 'Client',
          tagColor: '#3b82f6',
          statusTag: 'Active',
          statusColor: 'success',
          icon: <UserCheck size={16} />
        });
      }

      // Sort newest first
      items.sort((a, b) => new Date(b.date) - new Date(a.date));

      setActivities(items);
    } catch (error) {
      console.error('Failed to fetch client activities', error);
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    return {
      all: activities.length,
      proposal: activities.filter(a => a.type === 'proposal').length,
      invoice: activities.filter(a => a.type === 'invoice').length,
      project: activities.filter(a => a.type === 'project').length,
      task: activities.filter(a => a.type === 'task').length,
      support: activities.filter(a => a.type === 'support').length,
    };
  }, [activities]);

  const filterOptions = useMemo(() => {
    const list = [{ key: 'all', label: 'All', count: counts.all }];
    if (counts.proposal > 0) list.push({ key: 'proposal', label: 'Proposals', count: counts.proposal });
    if (counts.invoice > 0) list.push({ key: 'invoice', label: 'Invoices', count: counts.invoice });
    if (counts.project > 0) list.push({ key: 'project', label: 'Projects', count: counts.project });
    if (counts.task > 0) list.push({ key: 'task', label: 'Tasks', count: counts.task });
    if (counts.support > 0) list.push({ key: 'support', label: 'Support', count: counts.support });
    return list;
  }, [counts]);

  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      const matchType = filterType === 'all' || act.type === filterType;
      const matchSearch = !searchQuery || 
        act.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        act.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        act.action.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchSearch;
    }).slice(0, limit);
  }, [activities, filterType, searchQuery, limit]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: compact ? '24px 0' : '48px 0' }}>
        <Spin />
        <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 13 }}>
          Loading client activities...
        </Text>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div style={{ 
        padding: compact ? '24px' : '48px 24px', 
        textAlign: 'center', 
        color: 'var(--text-tertiary)', 
        background: 'var(--bg-tertiary)', 
        borderRadius: 12, 
        border: '1px dashed var(--border-color)' 
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
        <Text style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block' }}>
          No activities recorded yet
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Client activities for proposals, invoices, projects, and tasks will automatically appear here.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 12 : 18 }}>
      {/* Custom Pill Filters & Search (Full mode only) */}
      {!compact && (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {filterOptions.map(opt => {
              const active = filterType === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setFilterType(opt.key)}
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.2s ease',
                    background: active ? 'var(--accent-primary, #034EA1)' : 'var(--bg-tertiary, #f4f7fb)',
                    color: active ? '#ffffff' : 'var(--text-secondary, #536484)',
                    boxShadow: active ? '0 2px 8px rgba(3, 78, 161, 0.25)' : 'none',
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: active ? 'rgba(255, 255, 255, 0.25)' : 'var(--border-color, rgba(0,0,0,0.06))',
                    color: active ? '#ffffff' : 'var(--text-secondary, #536484)',
                    fontWeight: 800
                  }}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>

          <Input
            placeholder="Search activities..."
            prefix={<Search size={14} style={{ color: 'var(--text-tertiary)' }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="small"
            style={{ width: 220, borderRadius: 8 }}
          />
        </div>
      )}

      {/* Stream Timeline */}
      {filteredActivities.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matching activities found" />
        </div>
      ) : (
        <div style={{ 
          position: 'relative', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: compact ? 12 : 14,
          padding: compact ? '4px 0' : '4px 8px'
        }}>
          {filteredActivities.map((act, index) => {
            const isLast = index === filteredActivities.length - 1;
            const isTask = act.type === 'task' && act.rawTask;
            const formattedDate = dayjs(act.date).format('DD MMM YYYY, hh:mm A');
            const humanStatus = formatStatus(act.statusTag);

            return (
              <div 
                key={act.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'stretch', 
                  gap: 16, 
                  position: 'relative' 
                }}
              >
                {/* Left Node + Connecting Line Rail */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flexShrink: 0,
                  width: 38,
                  position: 'relative'
                }}>
                  {/* Circular Node Icon */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `${act.tagColor}18`,
                    color: act.tagColor,
                    border: `1.5px solid ${act.tagColor}40`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 2px 8px ${act.tagColor}20`,
                    zIndex: 2,
                    flexShrink: 0,
                    marginTop: 4
                  }}>
                    {act.icon}
                  </div>

                  {/* Vertical connector line */}
                  {!isLast && (
                    <div style={{
                      position: 'absolute',
                      top: 40,
                      bottom: -14,
                      width: 2,
                      background: 'var(--border-color)',
                      zIndex: 1
                    }} />
                  )}
                </div>

                {/* Right Activity Content Card */}
                <div
                  onClick={() => {
                    if (isTask && onTaskClick) {
                      onTaskClick(act.rawTask);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: compact ? '12px 14px' : '14px 18px',
                    boxShadow: 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.03))',
                    cursor: isTask && onTaskClick ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'var(--accent-primary, #034EA1)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.03))';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: 6, 
                        fontSize: 11, 
                        fontWeight: 800, 
                        background: `${act.tagColor}15`, 
                        color: act.tagColor, 
                        letterSpacing: 0.2 
                      }}>
                        {act.tag}
                      </span>

                      <span style={{ 
                        fontWeight: 750, 
                        fontSize: compact ? 13 : 14, 
                        color: 'var(--text-primary)' 
                      }}>
                        {act.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {humanStatus && (
                        <Tag 
                          color={act.statusColor} 
                          style={{ 
                            margin: 0, 
                            borderRadius: 6, 
                            fontSize: 10, 
                            fontWeight: 700,
                            textTransform: 'capitalize'
                          }}
                        >
                          {humanStatus}
                        </Tag>
                      )}
                      <Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
                        {formattedDate}
                      </Text>
                    </div>
                  </div>

                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                    {act.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientActivity;
