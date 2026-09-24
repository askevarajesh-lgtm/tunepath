import React, { useState, useMemo } from 'react';
import { Table, Tag, Space, Button, Typography, Input, Card, Modal, Select, Form, message, Upload, Row, Col, Tabs, Descriptions, Empty, DatePicker, Radio, Tooltip, AutoComplete } from 'antd';
import { EyeOutlined, EditOutlined, DeleteOutlined, PlusOutlined, DownloadOutlined, UploadOutlined, FileTextOutlined, AudioOutlined, PictureOutlined, VideoCameraOutlined, FileOutlined, WhatsAppOutlined, FacebookOutlined, CalendarOutlined, CheckCircleOutlined, CloseCircleOutlined, UserAddOutlined, UserSwitchOutlined, ApartmentOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { 
  useCreateLeadMutation, 
  useUpdateLeadMutation, 
  useDeleteLeadMutation, 
  useAssignLeadsMutation,
  useGetAssignableBdeUsersQuery,
  useLazyExportLeadsCsvQuery,
  useImportLeadsCsvMutation,
  useBulkDeleteLeadsMutation,
  useAddLeadNoteMutation,
  useDeleteLeadNoteMutation,
  useAddLeadReminderMutation,
  useGetLeadByIdQuery
} from '../../api/leadApi';
import { useGetDepartmentsQuery } from '../../api/settingsApi';
import { useSyncWhatsAppLeadsMutation, useGetFacebookIntegrationsQuery, useLazyGetFacebookFormsQuery, useSyncFacebookLeadsMutation } from '../../api/integrationApi';
import { useGetUsersDropdownQuery } from '../../api/userApi';
import PhoneInput from '../../components/common/PhoneInput';
import { isValidPhoneNumber } from 'libphonenumber-js';
import dayjs from 'dayjs';
import { useActionPermissions } from "../../hooks/useActionPermissions";
import { useAuth } from "../../contexts/AuthContext";
import OutboundCallButton from './components/OutboundCallButton';
import CallHistoryTable from './components/CallHistoryTable';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const CustomLabel = ({ text }) => (
  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
    {text}
  </span>
);

const DEFAULT_STATUSES = ['RNR', 'COLD', 'WARM', 'HOT', 'DROP', 'OTHER LOCATIONS', 'SV DONE', 'NOT REACHABLE', 'BOOKING DONE'];

const AdminLeadsList = ({ leads = [], isLoading = false, refetch }) => {
  const { user, role } = useAuth();
  const { canAdd, canEdit, canDelete, canView } = useActionPermissions('/crm');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [viewingLead, setViewingLead] = useState(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('text');
  const [noteFile, setNoteFile] = useState(null);
  const [customStatuses, setCustomStatuses] = useState([]);
  
  const [reminderDesc, setReminderDesc] = useState('');
  const [reminderDate, setReminderDate] = useState(null);
  const [reminderTo, setReminderTo] = useState(null);

  const [leadCountryCode, setLeadCountryCode] = useState('91');
  const [leadCountryIso, setLeadCountryIso] = useState('IN');

  const [form] = Form.useForm();
  const [assignForm] = Form.useForm();
  
  const [dateRangeFilter, setDateRangeFilter] = useState(null);
  const [formNameFilter, setFormNameFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assigningLeads, setAssigningLeads] = useState([]);

  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(null);
  const [convertForm] = Form.useForm();
  const [convertCountryCode, setConvertCountryCode] = useState('91');
  const [convertCountryIso, setConvertCountryIso] = useState('IN');
  const [isConvertingLoading, setIsConvertingLoading] = useState(false);

  const handleOpenConvertModal = (lead) => {
    if (!lead) return;
    setConvertingLead(lead);
    setViewingLead(null);
    setConvertCountryCode(lead.countryCode || '91');
    setConvertCountryIso(lead.countryIso || 'IN');

    convertForm.setFieldsValue({
      name: lead.fullName || '',
      contactPersonName: lead.fullName || lead.contactPerson || '',
      groupCreated: 'Not Created',
      email: lead.email || '',
      phone: lead.phoneNumber || '',
      password: '',
      address: ''
    });

    setIsConvertModalOpen(true);
  };

  const handleConvertSubmit = async (values) => {
    try {
      setIsConvertingLoading(true);
      const payload = {
        name: values.name,
        contactPersonName: values.contactPersonName,
        groupCreated: values.groupCreated,
        email: values.email,
        password: values.password,
        phone: values.phone,
        countryCode: convertCountryCode,
        address: values.address || ''
      };

      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        if (convertingLead?._id) {
          try {
            await updateLead({ id: convertingLead._id, status: 'converted' }).unwrap();
          } catch (e) {
            console.error('Failed to update lead status:', e);
          }
        }

        message.success(`Client "${values.name}" created and lead converted successfully!`);
        setIsConvertModalOpen(false);
        setConvertingLead(null);
        convertForm.resetFields();
        refetch?.();
      } else {
        message.error(data.message || 'Failed to create client');
      }
    } catch (error) {
      console.error(error);
      message.error(error?.message || 'Error creating client');
    } finally {
      setIsConvertingLoading(false);
    }
  };

  const { data: leadDetailData, isLoading: isLeadDetailLoading } = useGetLeadByIdQuery(
    viewingLead?._id,
    { skip: !viewingLead?._id }
  );

  const currentViewingLead = leadDetailData?.data?.lead || (viewingLead ? leads.find(l => l._id === viewingLead._id) || viewingLead : null);
  
  const selectedClientId = useMemo(() => {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr);
        if (parsed?.role === 'client' || parsed?.role === 'agency_client' || parsed?.brandId || parsed?.clientId) {
          return parsed.clientId || parsed.brandId || parsed._id;
        }
      } catch (e) {}
    }
    const selectedClientStr = localStorage.getItem('selectedClient');
    if (selectedClientStr) {
      try {
        const parsed = JSON.parse(selectedClientStr);
        if (parsed?._id) return parsed._id;
      } catch (e) {}
    }
    return null;
  }, []);

  const isClientContext = useMemo(() => {
    const r = (role || user?.role || '').toLowerCase();
    const ut = (user?.userType || '').toLowerCase();
    const hasBrandOrClient = !!(user?.brandId || user?.clientId || selectedClientId);
    return r.startsWith('brand') || r === 'client' || r === 'agency_client' || ut.startsWith('brand') || ut === 'client' || hasBrandOrClient;
  }, [role, user, selectedClientId]);

  const canConvertClient = useMemo(() => {
    if (isClientContext) return false;
    if (currentViewingLead?.isClientLead || currentViewingLead?.clientId || currentViewingLead?.companyId || currentViewingLead?.brandId) return false;
    const r = (role || user?.role || '').toLowerCase();
    return ['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency'].includes(r);
  }, [isClientContext, currentViewingLead, role, user]);

  const isAgencyClient = useMemo(() => {
    const r = (role || user?.role || '').toLowerCase();
    const ut = (user?.userType || '').toLowerCase();
    const pathname = window.location.pathname;

    // Explicit agency_client role
    if (r === 'agency_client' || ut === 'agency_client') return true;

    // Under client portal route (/client/...)
    if (pathname.startsWith('/client')) return true;

    // If user has a brandId / clientId assigned and is NOT an agency/platform admin
    if ((user?.brandId || user?.clientId) && !['supreme_super_admin', 'commander_admin', 'agency_super_admin', 'agency_manager', 'agency'].includes(r)) {
      return true;
    }

    return false;
  }, [role, user]);

  const [createLead, { isLoading: isCreating }] = useCreateLeadMutation();
  const [updateLead, { isLoading: isUpdating }] = useUpdateLeadMutation();
  const [deleteLead] = useDeleteLeadMutation();
  const [assignLeadsMutation, { isLoading: isAssigning }] = useAssignLeadsMutation();
  const [addLeadNote, { isLoading: isAddingNote }] = useAddLeadNoteMutation();
  const [deleteLeadNote] = useDeleteLeadNoteMutation();
  const [addLeadReminder, { isLoading: isAddingReminder }] = useAddLeadReminderMutation();
  const { data: bdeData } = useGetAssignableBdeUsersQuery();
  const { data: usersData, isLoading: isLoadingUsers } = useGetUsersDropdownQuery(selectedClientId ? { clientId: selectedClientId } : {});
  const { data: departmentsData, isLoading: isLoadingDepts } = useGetDepartmentsQuery(
    selectedClientId ? { clientId: selectedClientId } : {},
    { skip: !isAgencyClient }
  );
  
  const bdeUsers = bdeData?.data?.users || [];
  const allUsers = usersData?.data?.users || usersData?.data?.data || (Array.isArray(usersData?.data) ? usersData.data : []);
  const departments = departmentsData?.data || [];

  const allDepartmentNames = useMemo(() => {
    if (!isAgencyClient) return [];
    const set = new Set();
    departments.forEach(d => {
      if (d?.name) set.add(d.name.trim());
    });
    leads.forEach(l => {
      if (l?.assignedDepartment) set.add(l.assignedDepartment.trim());
    });
    return Array.from(set).sort();
  }, [departments, leads, isAgencyClient]);

  const handleOpenAssignModal = (leadsList) => {
    if (!leadsList || leadsList.length === 0) return;
    setAssigningLeads(leadsList);
    if (leadsList.length === 1) {
      assignForm.setFieldsValue({
        assignedDepartment: leadsList[0].assignedDepartment || undefined,
      });
    } else {
      assignForm.resetFields();
    }
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async () => {
    try {
      const values = await assignForm.validateFields();
      const leadIds = assigningLeads.map(l => l._id);
      await assignLeadsMutation({
        leadIds,
        assignedDepartment: values.assignedDepartment || '',
      }).unwrap();

      message.success(`${leadIds.length > 1 ? `${leadIds.length} leads` : 'Lead'} assigned to department successfully`);
      setIsAssignModalOpen(false);
      setAssigningLeads([]);
      assignForm.resetFields();
      setSelectedRowKeys([]);
      refetch?.();
    } catch (error) {
      message.error(error?.data?.message || error?.message || 'Failed to assign department');
    }
  };

  const [exportCsv, { isFetching: isExporting }] = useLazyExportLeadsCsvQuery();
  const [importCsv, { isLoading: isImporting }] = useImportLeadsCsvMutation();
  const [syncWhatsApp, { isLoading: isSyncingWhatsApp }] = useSyncWhatsAppLeadsMutation();
  const [bulkDeleteLeads, { isLoading: isBulkDeleting }] = useBulkDeleteLeadsMutation();
  const [activeTab, setActiveTab] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isFbSyncModalOpen, setIsFbSyncModalOpen] = useState(false);
  const [selectedFbPageId, setSelectedFbPageId] = useState(null);
  const [selectedFbFormIds, setSelectedFbFormIds] = useState([]);

  const { data: fbIntegrationsData, isLoading: isLoadingFbIntegrations } = useGetFacebookIntegrationsQuery(selectedClientId);
  const fbPages = fbIntegrationsData?.data?.integrations || [];
  
  const [fetchFbForms, { data: fbFormsData, isFetching: isFetchingFbForms }] = useLazyGetFacebookFormsQuery();
  const fbForms = fbFormsData?.data || [];
  
  const [syncFacebookLeads, { isLoading: isSyncingFbLeads }] = useSyncFacebookLeadsMutation();

  const handleFbPageChange = async (pageId) => {
    setSelectedFbPageId(pageId);
    const selectedPage = fbPages.find(p => p.pageId === pageId);
    setSelectedFbFormIds(selectedPage?.selectedForms || []);
    if (pageId) {
      try {
        const { data, error } = await fetchFbForms({ pageId, ...(selectedClientId ? { clientId: selectedClientId } : {}) });
        if (error) throw error;
      } catch (err) {
        message.error(err?.data?.message || err?.message || 'Failed to fetch forms for this page');
      }
    }
  };

  const handleSyncFacebook = async () => {
    if (!selectedFbPageId || selectedFbFormIds.length === 0) {
      message.error("Please select a page and at least one form");
      return;
    }
    try {
      const res = await syncFacebookLeads({ 
        pageId: selectedFbPageId, 
        formIds: selectedFbFormIds,
        ...(selectedClientId ? { clientId: selectedClientId } : {})
      }).unwrap();
      message.success(`Successfully synced ${res.data?.syncedCount || 0} leads from Facebook. 1-minute auto-sync is active.`);
      setIsFbSyncModalOpen(false);
      refetch?.();
    } catch (error) {
      message.error(error?.data?.message || 'Failed to sync Facebook leads');
    }
  };

  const getFormName = (lead) => {
    return lead?.customData?.form_name || lead?.customData?.formName || lead?.formName || '';
  };

  const uniqueFormNames = useMemo(() => {
    const names = new Set();
    leads.forEach(lead => {
      const name = getFormName(lead);
      if (name) names.add(name);
    });
    return Array.from(names);
  }, [leads]);

  const uniqueStatuses = useMemo(() => {
    const statuses = new Set();
    leads.forEach(lead => {
      if (lead.status) statuses.add(lead.status);
    });
    return Array.from(statuses);
  }, [leads]);

  const getActualLeadDate = (lead) => {
    const customDate = lead?.customData?.created_time || lead?.customData?.createdTime || lead?.customData?.createdtime;
    if (customDate) {
      return dayjs(customDate);
    }
    return dayjs(lead?.createdAt);
  };

  const handleOpenViewModal = (record) => {
    setViewingLead(record);
    setReminderTo(record.assignedTo || null);
    setReminderDesc('');
    setReminderDate(null);
  };

  const columns = [
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Name</strong>, dataIndex: 'fullName', key: 'fullName', render: t => <strong style={{ color: 'var(--text-primary)' }}>{t}</strong> },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Phone Number</strong>, dataIndex: 'phoneNumber', key: 'phoneNumber' },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Email</strong>, dataIndex: 'email', key: 'email' },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Lead Date</strong>, key: 'createdAt', defaultSortOrder: 'descend', sorter: (a, b) => getActualLeadDate(a).valueOf() - getActualLeadDate(b).valueOf(), render: (_, record) => getActualLeadDate(record).format('DD-MM-YYYY HH:mm') },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Form Name</strong>, key: 'formName', render: (_, record) => getFormName(record) || '—' },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Lead Source</strong>, dataIndex: 'source', key: 'source', render: s => <Tag color="purple" style={{ borderRadius: 6, fontWeight: 600 }}>{s}</Tag> },
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Status</strong>, dataIndex: 'status', key: 'status', render: s => <Tag color="blue" style={{ borderRadius: 6, fontWeight: 700, textTransform: 'uppercase' }}>{s}</Tag> },
    ...(isAgencyClient ? [
      { 
        title: <strong style={{ color: 'var(--text-secondary)' }}>Assigned Department</strong>, 
        dataIndex: 'assignedDepartment', 
        key: 'assignedDepartment', 
        render: dept => dept ? <Tag color="cyan" style={{ borderRadius: 6, fontWeight: 600 }}>{dept}</Tag> : '—' 
      }
    ] : []),
    { title: <strong style={{ color: 'var(--text-secondary)' }}>Assigned To</strong>, dataIndex: 'assignedTo', key: 'assignedTo', render: a => a || '—' },
    { 
      title: <strong style={{ color: 'var(--text-secondary)' }}>Action</strong>, key: 'action', fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <OutboundCallButton
            leadId={record._id}
            customerPhone={record.phoneNumber || record.mobile}
            leadName={record.fullName}
            iconOnly={true}
          />
          {canView && (
            <Tooltip title="View Lead">
              <Button type="text" icon={<EyeOutlined />} style={{ color: 'var(--accent-info)' }} onClick={() => handleOpenViewModal(record)} />
            </Tooltip>
          )}
          {isAgencyClient && canEdit && (
            <Tooltip title="Assign Department">
              <Button 
                type="text" 
                icon={<ApartmentOutlined />} 
                style={{ color: '#0e4ca2', fontWeight: 600, fontSize: 16 }} 
                onClick={() => handleOpenAssignModal([record])} 
              />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Edit Lead">
              <Button type="text" icon={<EditOutlined />} style={{ color: 'var(--accent-secondary)' }} onClick={() => handleEditClick(record)} />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete Lead">
              <Button type="text" icon={<DeleteOutlined />} danger onClick={() => handleDeleteClick(record)} />
            </Tooltip>
          )}
        </Space>
      )
    }
  ];

  const filteredLeads = leads.filter(lead => {
    if (activeTab === 'reminders') {
      if (!lead.reminders || lead.reminders.length === 0) return false;
    }

    let dateMatch = true;
    if (dateRangeFilter && dateRangeFilter.length === 2) {
      const start = dateRangeFilter[0].startOf('day');
      const end = dateRangeFilter[1].endOf('day');
      const leadDate = getActualLeadDate(lead);
      dateMatch = leadDate.isAfter(start) && leadDate.isBefore(end);
    }
    
    let formMatch = true;
    if (formNameFilter && formNameFilter.length > 0) {
      const formName = getFormName(lead).toLowerCase();
      formMatch = formNameFilter.some(filterItem => formName.includes(filterItem.toLowerCase()));
    }

    let departmentMatch = true;
    if (isAgencyClient && departmentFilter && departmentFilter.length > 0) {
      departmentMatch = departmentFilter.includes(lead.assignedDepartment);
    }

    let searchMatch = true;
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const name = (lead.fullName || '').toLowerCase();
      const email = (lead.email || '').toLowerCase();
      const phone = (lead.phoneNumber || '').toLowerCase();
      const formName = getFormName(lead).toLowerCase();
      const source = (lead.source || '').toLowerCase();
      const status = (lead.status || '').toLowerCase();
      const assignedTo = (lead.assignedTo || '').toLowerCase();
      const assignedDepartment = (lead.assignedDepartment || '').toLowerCase();

      searchMatch = name.includes(q) ||
                    email.includes(q) ||
                    phone.includes(q) ||
                    formName.includes(q) ||
                    source.includes(q) ||
                    status.includes(q) ||
                    assignedTo.includes(q) ||
                    assignedDepartment.includes(q);
    }
    let statusMatch = true;
    if (statusFilter && statusFilter.length > 0) {
      statusMatch = statusFilter.includes(lead.status);
    }
    
    return dateMatch && formMatch && searchMatch && statusMatch && departmentMatch;
  }).sort((a, b) => getActualLeadDate(b).valueOf() - getActualLeadDate(a).valueOf());

  const handleEditClick = (record) => {
    setEditingLead(record);
    setLeadCountryCode(record.countryCode || '91');
    setLeadCountryIso(record.countryIso || '');
    form.setFieldsValue({
      fullName: record.fullName,
      phoneNumber: record.phoneNumber,
      email: record.email,
      source: record.source,
      status: record.status?.toUpperCase(),
      assignedTo: record.assignedTo,
      notes: record.notes
    });
    setIsModalOpen(true);
  };

  const handleDeleteClick = (record) => {
    Modal.confirm({
      title: 'Delete Lead',
      content: `Are you sure you want to delete ${record.fullName}?`,
      okText: 'Yes',
      okType: 'danger',
      cancelText: 'No',
      onOk: async () => {
        try {
          await deleteLead(record._id).unwrap();
          message.success('Lead deleted successfully');
          refetch?.();
        } catch (error) {
          message.error('Failed to delete lead');
        }
      }
    });
  };

  const handleAddSubmit = () => {
    form.validateFields().then(async (values) => {
      try {
        if (editingLead) {
          await updateLead({ id: editingLead._id, ...values, countryCode: leadCountryCode, status: (values.status || '').toLowerCase() }).unwrap();
          message.success('Lead updated successfully');
        } else {
          await createLead({ ...values, countryCode: leadCountryCode, status: (values.status || '').toLowerCase() }).unwrap();
          message.success('Lead created successfully');
        }
        refetch?.();
        setIsModalOpen(false);
        setEditingLead(null);
        form.resetFields();
        setLeadCountryCode('91');
        setLeadCountryIso('IN');
      } catch (error) {
        message.error(error?.data?.message || error.message || 'Failed to save lead');
      }
    });
  };

  const handleExport = async () => {
    try {
      let activeFilter = activeTab;
      if (activeTab === 'all' && dateRangeFilter) activeFilter = 'all';
      if (activeTab === 'all' && formNameFilter && formNameFilter.length > 0) activeFilter = 'all';
      
      const payload = { 
        filter: activeFilter, 
        companyId: selectedClientId 
      };
      
      if (dateRangeFilter) {
        payload.startDate = dateRangeFilter[0].toISOString();
        payload.endDate = dateRangeFilter[1].toISOString();
      }
      if (formNameFilter && formNameFilter.length > 0) {
        payload.formName = formNameFilter[0];
      }

      if (selectedRowKeys.length > 0) {
        payload.selectedIds = selectedRowKeys;
      }

      const { data, error } = await exportCsv(payload);
      if (error) throw error;
      
      const blob = new Blob([data.blob], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      message.error(err.data?.message || err.message || 'Export failed');
    }
  };

  const handleBulkDelete = () => {
    Modal.confirm({
      title: 'Delete Selected Leads',
      content: `Are you sure you want to delete ${selectedRowKeys.length} selected lead(s)? This action cannot be undone.`,
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const res = await bulkDeleteLeads(selectedRowKeys).unwrap();
          message.success(res.message || 'Leads deleted successfully');
          setSelectedRowKeys([]);
          refetch?.();
        } catch (err) {
          message.error(err.data?.message || err.message || 'Failed to delete leads');
        }
      }
    });
  };

  const handleAddNote = async () => {
    if ((!noteContent.trim() && !noteFile) || !currentViewingLead) return;
    try {
      await addLeadNote({ leadId: currentViewingLead._id, noteType, content: noteContent, file: noteFile }).unwrap();
      message.success('Note added successfully');
      setNoteContent('');
      setNoteFile(null);
      refetch?.();
    } catch (error) {
      message.error('Failed to add note');
    }
  };

  const handleAddReminder = async () => {
    if (!reminderDesc.trim() || !reminderDate) {
      message.error("Please provide description and date/time for the reminder");
      return;
    }
    try {
      await addLeadReminder({
        leadId: currentViewingLead._id,
        description: reminderDesc,
        remindAt: reminderDate.toISOString(),
        remindTo: reminderTo || currentViewingLead?.assignedTo || user?.name || user?.username || 'Self'
      }).unwrap();
      message.success('Reminder added successfully');
      setReminderDesc('');
      setReminderDate(null);
      setReminderTo(currentViewingLead?.assignedTo || null);
      refetch?.();
    } catch (error) {
      message.error('Failed to add reminder');
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await deleteLeadNote({ leadId: currentViewingLead._id, noteId }).unwrap();
      message.success('Note deleted successfully');
      refetch?.();
    } catch (error) {
      message.error('Failed to delete note');
    }
  };

  const handleImport = async (file) => {
    try {
      await importCsv(file).unwrap();
      message.success('Leads imported successfully');
      refetch?.();
    } catch (error) {
      message.error(error?.data?.message || 'Failed to import leads');
    }
    return false; // Prevent default upload behavior
  };

  const handleSyncWhatsApp = async () => {
    try {
      await syncWhatsApp().unwrap();
      message.success('WhatsApp leads synchronized successfully');
      refetch?.();
    } catch (error) {
      message.error(error?.data?.message || 'Failed to sync WhatsApp leads');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card 
        bodyStyle={{ padding: 0 }} 
        style={{ borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden' }}
      >
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 16 }}>
          <Space>
            <Button 
              type="text" 
              onClick={() => setActiveTab('all')}
              style={{ 
                fontWeight: 600, 
                color: activeTab === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                borderBottom: activeTab === 'all' ? '2px solid var(--accent-primary)' : '2px solid transparent', 
                borderRadius: 0, 
                paddingBottom: 8 
              }}
            >
              All leads
            </Button>
            <Button 
              type="text" 
              onClick={() => setActiveTab('reminders')}
              style={{ 
                fontWeight: 600, 
                color: activeTab === 'reminders' ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                borderBottom: activeTab === 'reminders' ? '2px solid var(--accent-primary)' : '2px solid transparent', 
                borderRadius: 0, 
                paddingBottom: 8 
              }}
            >
              Reminder leads
            </Button>
          </Space>
          
          <Space wrap>
            <RangePicker onChange={val => setDateRangeFilter(val)} style={{ borderRadius: 8 }} />
            <Select
              mode="multiple"
              placeholder="Filter by Form Name"
              value={formNameFilter}
              onChange={val => setFormNameFilter(val || [])}
              style={{ minWidth: 200, borderRadius: 8 }}
              allowClear
              showSearch
            >
              {uniqueFormNames.map(name => (
                <Option key={name} value={name}>{name}</Option>
              ))}
            </Select>
            <Select
              mode="multiple"
              placeholder="Filter by Status"
              value={statusFilter}
              onChange={val => setStatusFilter(val || [])}
              style={{ minWidth: 160, borderRadius: 8 }}
              allowClear
              showSearch
            >
              {uniqueStatuses.map(status => (
                <Option key={status} value={status}>{status.replace(/_/g, ' ')}</Option>
              ))}
            </Select>
            {isAgencyClient && (
              <Select
                mode="multiple"
                placeholder="Filter by Department"
                value={departmentFilter}
                onChange={val => setDepartmentFilter(val || [])}
                style={{ minWidth: 180, borderRadius: 8 }}
                allowClear
                showSearch
              >
                {allDepartmentNames.map(name => (
                  <Option key={name} value={name}>{name}</Option>
                ))}
              </Select>
            )}
            {canView && (
              <>
                <Button 
                  icon={<WhatsAppOutlined />} 
                  loading={isSyncingWhatsApp} 
                  onClick={handleSyncWhatsApp} 
                  style={{ borderRadius: 8, fontWeight: 600, borderColor: '#25D366', color: '#25D366' }}
                >
                  Fetch WhatsApp Leads
                </Button>
                <Button 
                  icon={<FacebookOutlined />} 
                  onClick={() => setIsFbSyncModalOpen(true)} 
                  style={{ borderRadius: 8, fontWeight: 600, borderColor: '#1877F2', color: '#1877F2' }}
                >
                  Fetch Facebook Leads
                </Button>
                <Upload accept=".csv" showUploadList={false} customRequest={({ file }) => handleImport(file)}>
                  <Button icon={<UploadOutlined />} loading={isImporting} style={{ borderRadius: 8, fontWeight: 600, borderColor: 'var(--border-color)' }}>Import</Button>
                </Upload>
                <Button icon={<DownloadOutlined />} loading={isExporting} onClick={handleExport} style={{ borderRadius: 8, fontWeight: 600, borderColor: 'var(--border-color)' }}>Export</Button>
                {isAgencyClient && selectedRowKeys.length > 0 && canEdit && (
                  <Button 
                    icon={<ApartmentOutlined />} 
                    onClick={() => {
                      const selectedLeads = leads.filter(l => selectedRowKeys.includes(l._id));
                      handleOpenAssignModal(selectedLeads);
                    }}
                    style={{ borderRadius: 8, fontWeight: 600, borderColor: '#0e4ca2', color: '#0e4ca2' }}
                  >
                    Assign Department ({selectedRowKeys.length})
                  </Button>
                )}
                {selectedRowKeys.length > 0 && canView && (
                  <Button danger icon={<DeleteOutlined />} loading={isBulkDeleting} onClick={handleBulkDelete} style={{ borderRadius: 8, fontWeight: 600 }}>Bulk Delete ({selectedRowKeys.length})</Button>
                )}
              </>
            )}
            {canAdd && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingLead(null); form.resetFields(); setLeadCountryCode('91'); setLeadCountryIso('IN'); setIsModalOpen(true); }} style={{ borderRadius: 8, fontWeight: 600, background: '#0e4ca2', border: 'none' }}>Add Lead</Button>
            )}
            <Input
              allowClear
              placeholder="Search lead"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: 220, borderRadius: 8 }}
            />
          </Space>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={filteredLeads} 
          rowKey="_id"
          loading={isLoading}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'] }}
          rowSelection={{ 
            type: 'checkbox',
            selectedRowKeys,
            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys)
          }}
          style={{ padding: 24 }}
          scroll={{ x: 'max-content' }}
          rowClassName={() => 'hover-bg'}
        />
      </Card>

      {/* Add / Edit Lead Modal */}
      <Modal
        title={<Title level={4} style={{ margin: 0, color: 'var(--text-primary)' }}>{editingLead ? 'Edit lead' : 'Add new lead'}</Title>}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); setEditingLead(null); }}
        onOk={handleAddSubmit}
        width={700}
        confirmLoading={isCreating || isUpdating}
        okText={editingLead ? "Update Lead" : "Create Lead"}
        cancelText="Cancel"
        className="glassmorphism-modal"
        okButtonProps={{ style: { background: '#0e4ca2', border: 'none', borderRadius: 6, fontWeight: 600, padding: '0 24px' } }}
        cancelButtonProps={{ style: { borderRadius: 6, fontWeight: 600, padding: '0 24px' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 24, paddingRight: 12 }}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="fullName" label={<CustomLabel text="Name" />} rules={[{ required: true, message: 'Name is required' }]}>
                <Input size="large" placeholder="Name" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item 
                name="phoneNumber" 
                label={<CustomLabel text="Phone Number" />} 
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) return Promise.resolve();
                      if (isValidPhoneNumber(value, leadCountryIso)) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                    }
                  }
                ]}
              >
                <PhoneInput 
                  size="large" 
                  style={{ borderRadius: 6 }} 
                  countryCodeValue={leadCountryCode}
                  onCountryCodeChange={setLeadCountryCode}
                  isoCountryValue={leadCountryIso}
                  onCountryIsoChange={setLeadCountryIso}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="email" label={<CustomLabel text="Email" />}>
                <Input size="large" placeholder="Email (optional)" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="source" label={<CustomLabel text="Lead Source" />} rules={[{ required: true, message: 'Source is required' }]} initialValue="Website">
                <Select size="large">
                  <Option value="Website">Website</Option>
                  <Option value="Referral">Referral</Option>
                  <Option value="Social Media">Social Media</Option>
                  <Option value="Cold Call">Cold Call</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="status" label={<CustomLabel text="Status" />}>
                <AutoComplete
                  size="large"
                  options={[
                    ...DEFAULT_STATUSES.map(s => ({ value: s })),
                    ...customStatuses.map(s => ({
                      value: s,
                      label: (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{s}</span>
                          <DeleteOutlined 
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomStatuses(prev => prev.filter(custom => custom !== s));
                              if (form.getFieldValue('status') === s) {
                                form.setFieldsValue({ status: '' });
                              }
                            }}
                            style={{ color: 'var(--accent-danger)' }}
                          />
                        </div>
                      )
                    }))
                  ]}
                  filterOption={(inputValue, option) =>
                    option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                  onBlur={() => {
                    const val = form.getFieldValue('status');
                    if (val && !DEFAULT_STATUSES.includes(val) && !customStatuses.includes(val)) {
                      setCustomStatuses(prev => [...prev, val]);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = e.target.value || form.getFieldValue('status');
                      if (val && !DEFAULT_STATUSES.includes(val) && !customStatuses.includes(val)) {
                        setCustomStatuses(prev => [...prev, val]);
                      }
                    }
                  }}
                  placeholder="Select or Type the status"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedTo" label={<CustomLabel text="Assigned To" />}>
                <Select size="large" placeholder="Select User" allowClear loading={isLoadingUsers} showSearch>
                  {allUsers.map(u => (
                    <Option key={u._id} value={u.name || u.username}>{u.name || u.username}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={24}>
              <Form.Item name="notes" label={<CustomLabel text="Notes" />}>
                <TextArea rows={4} placeholder="Internal notes (optional)" style={{ borderRadius: 6 }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* View Lead Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 28 }}>
            <Title level={4} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
              Lead — {currentViewingLead?.fullName}
            </Title>
            <Space>
              {currentViewingLead && (
                <OutboundCallButton
                  leadId={currentViewingLead._id}
                  customerPhone={currentViewingLead.phoneNumber || currentViewingLead.mobile}
                  leadName={currentViewingLead.fullName}
                  buttonType="primary"
                />
              )}
              {canConvertClient && currentViewingLead && (
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={() => handleOpenConvertModal(currentViewingLead)}
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#10b981',
                    borderRadius: 8,
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  Convert to Client
                </Button>
              )}
            </Space>
          </div>
        }
        open={!!viewingLead}
        onCancel={() => {
          setViewingLead(null);
          setReminderTo(null);
          setReminderDesc('');
          setReminderDate(null);
        }}
        footer={null}
        width={900}
        className="glassmorphism-modal"
        styles={{ body: { paddingTop: 0 } }}
      >
        <Tabs 
          defaultActiveKey="details"
          items={[
            {
              key: 'reminders',
              label: <strong style={{ fontWeight: 600 }}>Reminders</strong>,
              children: (
                <div style={{ padding: '12px 0', minHeight: 400 }}>
                  <Title level={5} style={{ marginBottom: 16 }}>Set New Reminder</Title>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={24}>
                      <span style={{ color: 'red' }}>*</span> <span style={{ fontWeight: 600, fontSize: 13 }}>Description</span>
                      <TextArea rows={3} value={reminderDesc} onChange={e => setReminderDesc(e.target.value)} placeholder="Enter reminder description or select from quick replies" style={{ borderRadius: 6, marginTop: 4 }} />
                    </Col>
                  </Row>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={12}>
                      <span style={{ color: 'red' }}>*</span> <span style={{ fontWeight: 600, fontSize: 13 }}>Date & Time to be notified</span>
                      <DatePicker showTime style={{ width: '100%', borderRadius: 6, marginTop: 4 }} value={reminderDate} onChange={setReminderDate} placeholder="Select date" />
                    </Col>
                    <Col span={12}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Set reminder to</span>
                      <Select style={{ width: '100%', marginTop: 4 }} placeholder="Select User (optional)" allowClear value={reminderTo} onChange={setReminderTo} loading={isLoadingUsers} showSearch>
                        {allUsers.map(u => (
                          <Option key={u._id} value={u.name || u.username}>{u.name || u.username}</Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
                    <Button type="primary" loading={isAddingReminder} onClick={handleAddReminder} style={{ borderRadius: 6, fontWeight: 600, background: '#0e4ca2' }}>Add Reminder</Button>
                  </div>

                  <Table 
                    dataSource={currentViewingLead?.reminders || []}
                    rowKey="_id"
                    columns={[
                      { title: 'S.No', render: (t,r,i) => i+1 },
                      { title: 'Date', dataIndex: 'remindAt', render: d => dayjs(d).format('YYYY-MM-DD HH:mm') },
                      { title: 'Description', dataIndex: 'description' },
                      { title: 'Remind', dataIndex: 'remindTo' },
                      { title: 'Status', dataIndex: 'status', render: s => <Tag color={s === 'completed' ? 'green' : 'orange'}>{s?.toUpperCase()}</Tag> }
                    ]}
                    pagination={false}
                    locale={{ emptyText: <Empty description="No data" /> }}
                    size="small"
                  />
                </div>
              )
            },
            {
              key: 'details',
              label: <strong style={{ fontWeight: 600 }}>Lead Details</strong>,
              children: (
                <div style={{ padding: '12px 0' }}>
                  <Descriptions bordered column={3} size="middle" labelStyle={{ fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent' }} contentStyle={{ color: 'var(--text-primary)' }}>
                    <Descriptions.Item label="Name">{currentViewingLead?.fullName || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Phone Number">{currentViewingLead?.phoneNumber || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Email">{currentViewingLead?.email || '—'}</Descriptions.Item>
                    
                    <Descriptions.Item label="Lead Date">{getActualLeadDate(currentViewingLead).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
                    <Descriptions.Item label="Form Name">{getFormName(currentViewingLead) || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Lead Source"><Tag color="purple" style={{borderRadius: 4}}>{currentViewingLead?.source || '—'}</Tag></Descriptions.Item>
                    
                    <Descriptions.Item label="Status"><Tag color="blue" style={{borderRadius: 4}}>{currentViewingLead?.status || 'NEW'}</Tag></Descriptions.Item>
                    {isAgencyClient && (
                      <Descriptions.Item label="Assigned Department">{currentViewingLead?.assignedDepartment ? <Tag color="cyan" style={{borderRadius: 4}}>{currentViewingLead.assignedDepartment}</Tag> : '—'}</Descriptions.Item>
                    )}
                    <Descriptions.Item label="Assigned To">{currentViewingLead?.assignedTo || '—'}</Descriptions.Item>
                    <Descriptions.Item label="Last Interaction" span={3}>{currentViewingLead?.updatedAt ? dayjs(currentViewingLead.updatedAt).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
                    
                    <Descriptions.Item label="Notes" span={3}>{currentViewingLead?.notes || '—'}</Descriptions.Item>
                  </Descriptions>

                  {currentViewingLead?.customData && typeof currentViewingLead.customData === 'object' && Object.keys(currentViewingLead.customData).filter(key => !['form_name', 'formname', 'formid', 'form_id', 'pageid', 'page_id', 'leadgenid', 'leadgen_id', 'adid', 'ad_id', 'adsetid', 'adset_id', 'campaignid', 'campaign_id', 'createdtime', 'created_time', 'id', 'is_organic', 'platform'].includes(key.toLowerCase())).length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <Title level={5} style={{ marginBottom: 16 }}>Form Responses & Custom Data</Title>
                      <Descriptions bordered column={1} size="middle" labelStyle={{ width: '40%', fontWeight: 600, color: 'var(--text-secondary)', background: 'transparent' }} contentStyle={{ color: 'var(--text-primary)' }}>
                        {Object.entries(currentViewingLead.customData).map(([key, value]) => {
                          const ignoredKeys = ['form_name', 'formname', 'formid', 'form_id', 'pageid', 'page_id', 'leadgenid', 'leadgen_id', 'adid', 'ad_id', 'adsetid', 'adset_id', 'campaignid', 'campaign_id', 'createdtime', 'created_time', 'id', 'is_organic', 'platform'];
                          if (ignoredKeys.includes(key.toLowerCase())) return null;
                          const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                          const formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value || '—').replace(/_/g, ' ');
                          return (
                            <Descriptions.Item label={formattedKey} key={key}>
                              {formattedValue}
                            </Descriptions.Item>
                          );
                        })}
                      </Descriptions>
                    </div>
                  )}

                  {canConvertClient && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                      <Button
                        type="primary"
                        size="large"
                        icon={<UserAddOutlined />}
                        onClick={() => handleOpenConvertModal(currentViewingLead)}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          borderColor: '#10b981',
                          borderRadius: 8,
                          fontWeight: 700,
                          boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        Convert to Client
                      </Button>
                    </div>
                  )}
                </div>
              )
            },
            {
              key: 'notes',
              label: <strong style={{ fontWeight: 600 }}>Notes</strong>,
              children: (
                <div style={{ padding: '12px 0', minHeight: 400 }}>
                  <Title level={5} style={{ marginBottom: 16 }}>Add New Note</Title>
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ display: 'block', marginBottom: 8, fontWeight: 600, fontSize: 13 }}>Select Note Type:</span>
                    <Space size="middle">
                      <Button type={noteType === 'text' ? 'primary' : 'default'} icon={<FileTextOutlined />} onClick={() => setNoteType('text')} style={{ borderRadius: 6, fontWeight: 600, ...(noteType === 'text' ? {background: '#0e4ca2'} : {}) }}>Text</Button>
                      <Button type={noteType === 'audio' ? 'primary' : 'default'} icon={<AudioOutlined />} onClick={() => setNoteType('audio')} style={{ borderRadius: 6, fontWeight: 500, ...(noteType === 'audio' ? {background: '#0e4ca2'} : {}) }}>Audio</Button>
                      <Button type={noteType === 'image' ? 'primary' : 'default'} icon={<PictureOutlined />} onClick={() => setNoteType('image')} style={{ borderRadius: 6, fontWeight: 500, ...(noteType === 'image' ? {background: '#0e4ca2'} : {}) }}>Image</Button>
                      <Button type={noteType === 'video' ? 'primary' : 'default'} icon={<VideoCameraOutlined />} onClick={() => setNoteType('video')} style={{ borderRadius: 6, fontWeight: 500, ...(noteType === 'video' ? {background: '#0e4ca2'} : {}) }}>Video</Button>
                      <Button type={noteType === 'document' ? 'primary' : 'default'} icon={<FileOutlined />} onClick={() => setNoteType('document')} style={{ borderRadius: 6, fontWeight: 500, ...(noteType === 'document' ? {background: '#0e4ca2'} : {}) }}>Document</Button>
                    </Space>
                  </div>
                  
                  {noteType !== 'text' && (
                    <div style={{ marginBottom: 16 }}>
                      <Upload 
                        beforeUpload={(file) => {
                          setNoteFile(file);
                          return false; // Prevent automatic upload
                        }}
                        onRemove={() => setNoteFile(null)}
                        maxCount={1}
                        fileList={noteFile ? [noteFile] : []}
                      >
                        <Button icon={<UploadOutlined />}>Select File to Upload</Button>
                      </Upload>
                    </div>
                  )}

                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={24}>
                      <TextArea rows={3} value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Enter note details..." style={{ borderRadius: 6 }} />
                    </Col>
                  </Row>
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
                    <Button type="primary" loading={isAddingNote} onClick={handleAddNote} style={{ borderRadius: 6, fontWeight: 600, background: '#0e4ca2' }}>Add Note</Button>
                  </div>
                  
                  <div>
                    <Title level={5} style={{ marginBottom: 16 }}>Existing Notes</Title>
                    <Table 
                      dataSource={currentViewingLead?.leadNotes || []} 
                      rowKey="_id"
                      columns={[
                        { title: 'Date', dataIndex: 'createdAt', render: d => dayjs(d).format('YYYY-MM-DD HH:mm') },
                        { title: 'Type', dataIndex: 'noteType', render: t => <Tag color="blue">{t?.toUpperCase()}</Tag> },
                        { 
                          title: 'Content', 
                          render: (_, record) => (
                            <Space direction="vertical" size="small">
                              {record.content && <span>{record.content}</span>}
                              {record.fileUrl && (
                                <a href={record.fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <FileOutlined /> View Attachment
                                </a>
                              )}
                            </Space>
                          )
                        },
                        { title: 'Action', key: 'action', render: (_, record) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteNote(record._id)} /> },
                      ]}
                      pagination={false}
                      locale={{ emptyText: <Empty description="No notes found" /> }}
                      size="small"
                    />
                  </div>
                </div>
              )
            },
            {
              key: 'calls',
              label: <strong style={{ fontWeight: 600 }}>Call History</strong>,
              children: (
                <CallHistoryTable leadId={currentViewingLead?._id} />
              )
            },
            {
              key: 'logs',
              label: <strong style={{ fontWeight: 600 }}>Activity Logs</strong>,
              children: (currentViewingLead?.activityLogs?.length > 0 ? (
                <Table 
                  dataSource={currentViewingLead.activityLogs}
                  rowKey="_id"
                  columns={[
                    { title: 'Date', dataIndex: 'createdAt', render: d => dayjs(d).format('YYYY-MM-DD HH:mm:ss') },
                    { title: 'Message', dataIndex: 'message' },
                  ]}
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="No activity logs found" style={{ margin: '40px 0' }} />
              ))
            }
          ]}
        />
      </Modal>

      {/* Convert Lead to Client Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <UserAddOutlined style={{ fontSize: 20 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 800 }}>Create New Client</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>Provision a new workspace and admin account</Text>
            </div>
          </div>
        }
        open={isConvertModalOpen}
        onCancel={() => { setIsConvertModalOpen(false); setConvertingLead(null); }}
        footer={null}
        width={520}
        closeIcon={<span style={{ color: 'var(--text-tertiary)', fontSize: 20 }}>×</span>}
        className="glassmorphism-modal"
        styles={{
          header: { padding: '24px 24px 16px 24px', borderBottom: '1px solid var(--border-color)' },
          body: { padding: '24px', maxHeight: '550px', overflowY: 'auto' },
          content: { borderRadius: 16, overflow: 'hidden' }
        }}
      >
        <Form
          form={convertForm}
          layout="vertical"
          onFinish={handleConvertSubmit}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <Text style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                COMPANY DETAILS
              </Text>
              <Form.Item
                name="name"
                label={<span style={{ fontWeight: 600 }}>Client Company Name</span>}
                rules={[{ required: true, message: 'Please enter client name' }]}
              >
                <Input placeholder="e.g. Acme Corp" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
              <Form.Item
                name="contactPersonName"
                label={<span style={{ fontWeight: 600 }}>Contact Person Name</span>}
                rules={[{ required: true, message: 'Please enter Contact Person Name' }]}
                style={{ marginBottom: 0 }}
              >
                <Input placeholder="e.g. John Doe" size="large" style={{ borderRadius: 8 }} />
              </Form.Item>
            </div>

            <div>
              <Text style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                ADMIN ACCOUNT
              </Text>
              <Row gutter={16}>
                <Col span={24}>
                  <Form.Item
                    name="email"
                    label={<span style={{ fontWeight: 600 }}>Admin Email</span>}
                    rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}
                  >
                    <Input type="email" placeholder="manager@client.com" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="password"
                    label={<span style={{ fontWeight: 600 }}>Initial Password</span>}
                    rules={[{ required: true, message: 'Please enter initial password' }]}
                  >
                    <Input.Password placeholder="Enter a secure password" size="large" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="phone"
                    label={<span style={{ fontWeight: 600 }}>Phone Number</span>}
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) return Promise.resolve();
                          if (isValidPhoneNumber(value, convertCountryIso)) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Please enter a valid phone number for the selected country'));
                        }
                      }
                    ]}
                  >
                    <PhoneInput
                      size="large"
                      style={{ borderRadius: 8 }}
                      countryCodeValue={convertCountryCode}
                      onCountryCodeChange={setConvertCountryCode}
                      isoCountryValue={convertCountryIso}
                      onCountryIsoChange={setConvertCountryIso}
                    />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="address"
                    label={<span style={{ fontWeight: 600 }}>Address</span>}
                  >
                    <TextArea rows={2} placeholder="e.g. 123 Main St, City, Country" style={{ borderRadius: 8 }} />
                  </Form.Item>
                </Col>
              </Row>
            </div>

            <div>
              <Text style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                GROUP STATUS
              </Text>
              <Form.Item
                name="groupCreated"
                label={<span style={{ fontWeight: 600 }}>Group Created</span>}
                rules={[{ required: true, message: 'Please select Group Created status' }]}
                initialValue="Not Created"
                style={{ marginBottom: 0 }}
              >
                <Radio.Group buttonStyle="solid" size="large" style={{ width: '100%', display: 'flex' }}>
                  <Radio.Button value="Not Created" style={{ flex: 1, textAlign: 'center' }}>Not Created</Radio.Button>
                  <Radio.Button value="Created" style={{ flex: 1, textAlign: 'center' }}>Created</Radio.Button>
                </Radio.Group>
              </Form.Item>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <Button
                onClick={() => { setIsConvertModalOpen(false); setConvertingLead(null); }}
                style={{ borderRadius: 8, fontWeight: 600 }}
                size="large"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isConvertingLoading}
                style={{ borderRadius: 8, background: '#10b981', borderColor: '#10b981', fontWeight: 700, padding: '0 24px' }}
                size="large"
              >
                Convert to Client
              </Button>
            </div>
          </div>
        </Form>
      </Modal>

      <Modal
        title="Fetch Facebook Leads"
        open={isFbSyncModalOpen}
        onCancel={() => setIsFbSyncModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setIsFbSyncModalOpen(false)}>Cancel</Button>,
          <Button 
            key="sync" 
            type="primary" 
            loading={isSyncingFbLeads} 
            onClick={handleSyncFacebook}
            disabled={!selectedFbPageId || selectedFbFormIds.length === 0}
            style={{ background: '#1877F2', borderColor: '#1877F2' }}
          >
            Sync Leads
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Select Facebook Page:</Text>
          <Select 
            style={{ width: '100%', marginTop: 8 }} 
            placeholder="Select Page" 
            value={selectedFbPageId}
            onChange={handleFbPageChange}
            loading={isLoadingFbIntegrations}
          >
            {fbPages.map(page => (
              <Option key={page.pageId} value={page.pageId}>{page.pageName}</Option>
            ))}
          </Select>
          {fbPages.length === 0 && !isLoadingFbIntegrations && (
            <Text type="danger" style={{ display: 'block', marginTop: 4 }}>No Facebook pages integrated. Please configure it in settings.</Text>
          )}
        </div>

        {selectedFbPageId && (
          <div>
            <Text strong>Select Forms to Sync:</Text>
            <Select 
              mode="multiple"
              style={{ width: '100%', marginTop: 8 }} 
              placeholder="Select Forms" 
              value={selectedFbFormIds}
              onChange={val => setSelectedFbFormIds(val)}
              loading={isFetchingFbForms}
            >
              {fbForms.map(form => (
                <Option key={form.id} value={form.id}>{form.name}</Option>
              ))}
            </Select>
            {fbForms.length === 0 && !isFetchingFbForms && (
              <Text type="warning" style={{ display: 'block', marginTop: 4 }}>No forms found for this page.</Text>
            )}
          </div>
        )}
      </Modal>

      {/* Assign Department Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0e4ca2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ApartmentOutlined style={{ fontSize: 18 }} />
            </div>
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                {assigningLeads.length > 1 ? `Assign Department (${assigningLeads.length} Leads)` : 'Assign Department'}
              </Title>
              {assigningLeads.length === 1 && (
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Lead: {assigningLeads[0]?.fullName || assigningLeads[0]?.companyName}
                </Text>
              )}
            </div>
          </div>
        }
        open={isAssignModalOpen}
        onCancel={() => {
          setIsAssignModalOpen(false);
          setAssigningLeads([]);
          assignForm.resetFields();
        }}
        onOk={handleAssignSubmit}
        confirmLoading={isAssigning}
        okText={assigningLeads.length > 1 ? `Assign ${assigningLeads.length} Leads` : 'Assign Department'}
        cancelText="Cancel"
        className="glassmorphism-modal"
        okButtonProps={{ style: { background: '#0e4ca2', border: 'none', borderRadius: 6, fontWeight: 600, padding: '0 24px' } }}
        cancelButtonProps={{ style: { borderRadius: 6, fontWeight: 600, padding: '0 24px' } }}
        width={500}
      >
        <div style={{ margin: '16px 0 20px 0' }}>
          <Text type="secondary" style={{ fontSize: 13, lineHeight: '1.5', display: 'block' }}>
            Assign this lead to a department. The lead will be visible to all users who belong to the selected department.
          </Text>
        </div>

        <Form form={assignForm} layout="vertical">
          <Form.Item 
            name="assignedDepartment" 
            label={<CustomLabel text="Assigned Department" />}
            rules={[{ required: true, message: 'Please select a department' }]}
            extra="All team members in this department will see this lead."
          >
            <Select 
              size="large" 
              placeholder="Select Department" 
              allowClear 
              loading={isLoadingDepts} 
              showSearch
              style={{ borderRadius: 6 }}
            >
              {allDepartmentNames.map(dept => (
                <Option key={dept} value={dept}>{dept}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

    </motion.div>
  );
};

export default AdminLeadsList;
