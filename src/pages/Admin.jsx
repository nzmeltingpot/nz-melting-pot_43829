import { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { generateUnsubscribeLink, generateUpdateDetailsLink, generateSubscribeLink, generateNewsletterEmail } from '../utils/emailTemplates';
import { sendBulkEmail } from '../utils/brevoClient';
import HonourPassesTab from '../components/HonourPassesTab';

/**
 * Helper: parse a stored "from" string like
 *   "NZ Melting Pot <noreply@nzmeltingpot.com>"
 * into the { email, name } object Brevo expects.
 */
function parseFromAddress(value) {
  const fallback = { email: 'noreply@nzmeltingpot.com', name: 'NZ Melting Pot' };
  if (!value || typeof value !== 'string') return fallback;
  const m = value.match(/^\s*"?([^"<]+?)"?\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  // No display name — just an email
  if (value.includes('@')) return { email: value.trim() };
  return fallback;
}

// Format date as dd/mm/yyyy — safe against mm/dd/yyyy misinterpretation
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const s = String(dateStr);
  // ISO YYYY-MM-DD or ISO datetime (e.g. "2026-05-11 10:30:00") — extract parts directly
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  // Already NZ-formatted: dd/mm/yyyy or "dd/mm/yyyy, hh:mm:ss"
  const nzMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (nzMatch) return `${nzMatch[1]}/${nzMatch[2]}/${nzMatch[3]}`;
  // Last resort — do NOT pass ambiguous strings to new Date(); return as-is
  return s;
};

/**
 * Extract the year from a stored timestamp string without using new Date(),
 * to avoid mm/dd/yyyy misinterpretation of legacy NZ-locale strings.
 */
const extractYear = (dateStr) => {
  if (!dateStr) return null;
  const s = String(dateStr);
  // YYYY-MM-DD… format
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  if (iso) return parseInt(iso[1], 10);
  // dd/mm/yyyy format
  const nz = s.match(/^\d{2}\/\d{2}\/(\d{4})/);
  if (nz) return parseInt(nz[1], 10);
  // ISO 8601 from DB (e.g. "2026-05-11T10:30:00Z")
  const db = s.match(/^(\d{4})/);
  if (db) return parseInt(db[1], 10);
  return null;
};

const SETTINGS_TABLE_ID = 79250;
const SUBMISSIONS_TABLE_ID = 78687;  // holds TSC26 registrations + HON26 honour passes
const BOOKINGS_TABLE_ID = 82471;     // audience ticket bookings
const MEMBERS_TABLE_ID = 79993;

const SETTING_LABELS = {
  thankyou_heading: 'Thank-You Page — Heading',
  thankyou_message: 'Thank-You Page — Message',
  thankyou_important_text: 'Thank-You Page — Important Notice',
  thankyou_instructions: 'Thank-You Page — Instructions',
  thankyou_closing: 'Thank-You Page — Closing Line',
  email_from: 'Email — Sender Address (e.g., Name <you@yourdomain.com>)',
  email_subject_template: 'Email — Subject (use {code} for registration code)',
  email_body: 'Email — Body Text',
  email_important_text: 'Email — Important Notice',
  email_instructions: 'Email — Instructions',
  email_closing: 'Email — Closing Line'
};

const SETTING_ORDER = [
'thankyou_heading',
'thankyou_message',
'thankyou_important_text',
'thankyou_instructions',
'thankyou_closing',
'email_from',
'email_subject_template',
'email_body',
'email_important_text',
'email_instructions',
'email_closing'];


export default function Admin() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [settings, setSettings] = useState([]);
  const [editValues, setEditValues] = useState({});
  const [saving, setSaving] = useState({});
  const [saveSuccess, setSaveSuccess] = useState({});
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingAudience, setExportingAudience] = useState(false);
  const [subsLive, setSubsLive] = useState([]);
  const [loadingSubsLive, setLoadingSubsLive] = useState(false);
  const [audLive, setAudLive] = useState([]);
  const [loadingAudLive, setLoadingAudLive] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);

  const [activeTab, setActiveTab] = useState('dashboard');

  // API Keys tab state
  const [envStatus, setEnvStatus] = useState(null);
  const [envLoading, setEnvLoading] = useState(false);
  const [envSaving, setEnvSaving] = useState({});
  const [envValues, setEnvValues] = useState({ STRIPE_SECRET_KEY: '', BREVO_API_KEY: '' });
  const [envMessages, setEnvMessages] = useState({});
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPageSize] = useState(50);
  const [membersSearch, setMembersSearch] = useState('');
  const [membersSearchInput, setMembersSearchInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState(null);
  const [sendProgress, setSendProgress] = useState(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [pendingRecipients, setPendingRecipients] = useState([]);
  const isSendingRef = useRef(false); // idempotency guard — blocks re-entrant sends

  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberName, setAddMemberName] = useState('');
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberStatus, setAddMemberStatus] = useState('active');
  const [addMemberGroup, setAddMemberGroup] = useState('A');
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState('');
  const [membersGroupFilter, setMembersGroupFilter] = useState('all');

  // Delivery status modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryEmail, setDeliveryEmail] = useState('');
  const [deliveryEvents, setDeliveryEvents] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  // Group diagnostics modal state
  const [showDiagModal, setShowDiagModal] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState(null);
  const [diagError, setDiagError] = useState('');
  const [diagGroup, setDiagGroup] = useState('A');

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState({
    totalSubmissions: 0,
    totalMembers: 0,
    activeSubscribers: 0,
    thisYearSubmissions: 0
  });
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [recentMembers, setRecentMembers] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // DEV_PREVIEW: set to true to bypass login locally (remove before going live)
  const DEV_PREVIEW = import.meta.env.DEV;

  const checkAuth = useCallback(async () => {
    if (DEV_PREVIEW) {
      setUser({ Email: 'dev-preview@localhost' });
      setAuthLoading(false);
      return;
    }
    try {
      const { data, error } = await window.ezsite.apis.getUserInfo();
      if (!error && data) {
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setAuthLoading(false);
  }, [DEV_PREVIEW]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const { error } = await window.ezsite.apis.login({
        email: loginEmail,
        password: loginPassword
      });
      if (error) {
        setLoginError(error);
        setLoginLoading(false);
        return;
      }
      await checkAuth();
    } catch (err) {
      setLoginError('Login failed. Please try again.');
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    try {
      await window.ezsite.apis.logout();
    } catch {}
    setUser(null);
  };

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { data, error } = await window.ezsite.apis.tablePage(SETTINGS_TABLE_ID, {
        PageNo: 1,
        PageSize: 50,
        OrderByField: 'id',
        IsAsc: true
      });
      if (!error && data?.List) {
        setSettings(data.List);
        const vals = {};
        data.List.forEach((s) => {
          vals[s.setting_key] = s.setting_value;
        });
        setEditValues(vals);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
    setLoadingSettings(false);
  }, []);

  useEffect(() => {
    if (user) loadSettings();
  }, [user, loadSettings]);

  const loadEnvStatus = useCallback(async () => {
    setEnvLoading(true);
    try {
      const { data, error } = await window.ezsite.apis.run({
        path: 'config/envVars',
        methodName: 'getEnvStatus',
        param: []
      });
      if (!error && data) setEnvStatus(data);
    } catch (err) {
      console.error('Failed to load env status:', err);
    }
    setEnvLoading(false);
  }, []);

  useEffect(() => {
    if (user && activeTab === 'apikeys') loadEnvStatus();
  }, [user, activeTab, loadEnvStatus]);

  const loadSubmissionsLive = useCallback(async () => {
    if (!window.ezsite?.apis?.tablePage) return;
    setLoadingSubsLive(true);
    try {
      const { data } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1, PageSize: 1000, OrderByField: 'id', IsAsc: false
      });
      setSubsLive((data?.List || []).filter(r => !String(r.unique_code || '').startsWith('HON26')));
    } catch {}
    setLoadingSubsLive(false);
    setLoadingAudLive(true);
    try {
      const { data } = await window.ezsite.apis.tablePage(BOOKINGS_TABLE_ID, {
        PageNo: 1, PageSize: 1000, OrderByField: 'id', IsAsc: false
      });
      setAudLive(data?.List || []);
    } catch {}
    setLoadingAudLive(false);
  }, []);

  useEffect(() => {
    if (user && activeTab === 'submissions') loadSubmissionsLive();
  }, [user, activeTab, loadSubmissionsLive]);

  const handleSaveEnvVar = async (key) => {
    const value = envValues[key]?.trim();
    if (!value) {
      setEnvMessages((p) => ({ ...p, [key]: { ok: false, text: 'Value cannot be empty.' } }));
      return;
    }
    setEnvSaving((p) => ({ ...p, [key]: true }));
    setEnvMessages((p) => ({ ...p, [key]: null }));
    try {
      const { error } = await window.ezsite.apis.run({
        path: 'config/envVars',
        methodName: 'setEnvVar',
        param: [key, value]
      });
      if (error) throw new Error(error);
      setEnvMessages((p) => ({ ...p, [key]: { ok: true, text: 'Saved successfully.' } }));
      setEnvValues((p) => ({ ...p, [key]: '' }));
      await loadEnvStatus();
    } catch (err) {
      setEnvMessages((p) => ({ ...p, [key]: { ok: false, text: err.message || 'Save failed.' } }));
    }
    setEnvSaving((p) => ({ ...p, [key]: false }));
  };

  const loadMembers = useCallback(async (page = 1, search = '', groupFilter = 'all') => {
    setLoadingMembers(true);
    try {
      const query = {
        PageNo: page,
        PageSize: membersPageSize,
        OrderByField: 'email',
        IsAsc: true,
        Filters: []
      };
      const term = (search || '').trim();
      if (term) {
        query.Filters.push({ Name: 'email', Op: 'StringContains', Value: term });
      }
      if (groupFilter === 'A' || groupFilter === 'B') {
        query.Filters.push({ Name: 'member_group', Op: 'Equal', Value: groupFilter });
      }
      if (query.Filters.length === 0) delete query.Filters;
      const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, query);
      if (!error && data?.List) {
        setMembers(data.List);
        setMembersTotal(data.VirtualCount || data.TotalCount || 0);
        setMembersPage(page);
      }
    } catch (err) {
      console.error('Failed to load members:', err);
    }
    setLoadingMembers(false);
  }, [membersPageSize]);

  useEffect(() => {
    if (user && activeTab === 'members') {
      loadMembers(1, membersSearch, membersGroupFilter);
    }
  }, [user, activeTab, loadMembers, membersSearch, membersGroupFilter]);

  // Dashboard data loader
  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      // Fetch submissions (recent 5 + total count)
      const subRes = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1,
        PageSize: 5,
        OrderByField: 'id',
        IsAsc: false
      });

      // Fetch all members (recent 5 + counts)
      const memRes = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
        PageNo: 1,
        PageSize: 500,
        OrderByField: 'id',
        IsAsc: false
      });

      if (!subRes.error && subRes.data?.List) {
        setRecentSubmissions(subRes.data.List.slice(0, 5));
        const totalSubs = subRes.data.VirtualCount || subRes.data.TotalCount || 0;
        const currentYear = new Date().getFullYear();
        const thisYearCount = subRes.data.List.filter((s) => {
          try {
            return extractYear(s.submission_timestamp || s.CreatedAt) === currentYear;
          } catch {return false;}
        }).length;

        setDashboardStats((prev) => ({
          ...prev,
          totalSubmissions: totalSubs,
          thisYearSubmissions: thisYearCount
        }));
      }

      if (!memRes.error && memRes.data?.List) {
        setRecentMembers(memRes.data.List.slice(0, 5));
        const allMembers = memRes.data.List;
        const totalMems = memRes.data.VirtualCount || memRes.data.TotalCount || allMembers.length;
        const activeSubs = allMembers.filter((m) => m.status === 'active').length;

        setDashboardStats((prev) => ({
          ...prev,
          totalMembers: totalMems,
          activeSubscribers: activeSubs
        }));
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
    setLoadingDashboard(false);
  }, []);

  useEffect(() => {
    if (user && activeTab === 'dashboard') {
      loadDashboard();
    }
  }, [user, activeTab, loadDashboard]);


  const handleUnsubscribe = async (member) => {
    if (!confirm(`Unsubscribe ${member.email}?`)) return;
    try {
      const { error } = await window.ezsite.apis.tableUpdate(MEMBERS_TABLE_ID, {
        ID: member.id || member.ID,
        status: 'unsubscribed',
        unsubscribed_date: new Date().toISOString()
      });
      if (error) throw new Error(error);
      loadMembers(membersPage, membersSearch, membersGroupFilter);
    } catch (err) {
      alert('Failed to update: ' + (err.message || 'Unknown error'));
    }
  };

  const handleResubscribe = async (member) => {
    try {
      const { error } = await window.ezsite.apis.tableUpdate(MEMBERS_TABLE_ID, {
        ID: member.id || member.ID,
        status: 'active',
        unsubscribed_date: ''
      });
      if (error) throw new Error(error);
      loadMembers(membersPage, membersSearch, membersGroupFilter);
    } catch (err) {
      alert('Failed to update: ' + (err.message || 'Unknown error'));
    }
  };

  const handleDeleteMember = async (member) => {
    if (!confirm(`Permanently delete ${member.email}? This cannot be undone.`)) return;
    try {
      const { error } = await window.ezsite.apis.tableDelete(MEMBERS_TABLE_ID, {
        ID: member.id || member.ID
      });
      if (error) throw new Error(error);
      loadMembers(membersPage, membersSearch, membersGroupFilter);
    } catch (err) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCheckDelivery = async (member) => {
    setDeliveryEmail(member.email);
    setDeliveryEvents([]);
    setDeliveryError('');
    setDeliveryLoading(true);
    setShowDeliveryModal(true);
    const { data, error } = await window.ezsite.apis.run({
      path: 'email/getEmailEvents',
      methodName: 'getEmailEvents',
      param: [{ email: member.email, days: 90 }]
    });
    setDeliveryLoading(false);
    if (error) {setDeliveryError(typeof error === 'string' ? error : JSON.stringify(error));return;}
    setDeliveryEvents(data?.events || []);
  };

  const handleRunDiagnostics = async (group) => {
    setDiagGroup(group);
    setDiagError('');
    setDiagResults(null);
    setDiagLoading(true);
    setShowDiagModal(true);

    try {
      // Fetch up to 30 active members from the chosen group
      const filters = [{ Name: 'status', Op: 'NotEqual', Value: 'unsubscribed' }];
      if (group === 'A' || group === 'B') {
        filters.push({ Name: 'member_group', Op: 'Equal', Value: group });
      }
      const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
        PageNo: 1,
        PageSize: 30,
        OrderByField: 'ID',
        IsAsc: true,
        Filters: filters
      });
      if (error || !data?.List?.length) {
        setDiagError('Could not fetch members from database.');
        setDiagLoading(false);
        return;
      }
      const emails = data.List.map((m) => m.email).filter(Boolean);
      const { data: diagData, error: diagErr } = await window.ezsite.apis.run({
        path: 'email/checkContactBlocklist',
        methodName: 'checkContactBlocklist',
        param: [{ emails, days: 90 }]
      });
      if (diagErr) {
        const msg = typeof diagErr === 'string' ? diagErr : diagErr.message || JSON.stringify(diagErr);
        setDiagError(msg);
      } else {
        setDiagResults(diagData);
      }
    } catch (err) {
      setDiagError(err?.message || 'Unexpected error running diagnostics.');
    }
    setDiagLoading(false);
  };

  const exportMembers = async () => {
    try {
      const exportQuery = {
        PageNo: 1,
        PageSize: 10000,
        OrderByField: 'subscribed_date',
        IsAsc: false,
        Filters: []
      };
      if (membersGroupFilter === 'A' || membersGroupFilter === 'B') {
        exportQuery.Filters.push({ Name: 'member_group', Op: 'Equal', Value: membersGroupFilter });
      }
      if (exportQuery.Filters.length === 0) delete exportQuery.Filters;
      const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, exportQuery);
      if (error || !data?.List) {
        alert('Failed to fetch members');
        return;
      }
      const columns = [
      { header: 'Full Name', key: 'full_name' },
      { header: 'Email', key: 'email' },
      { header: 'Group', key: 'member_group' },
      { header: 'Status', key: 'status' },
      { header: 'Subscribed Date', key: 'subscribed_date' },
      { header: 'Unsubscribed Date', key: 'unsubscribed_date' }];

      const escapeCSV = (val, isDate = false) => {
        if (val === null || val === undefined) return '';
        if (isDate && val) {
          const formatted = formatDate(val);
          if (formatted !== '—') return formatted;
        }
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };
      const headerRow = columns.map((c) => escapeCSV(c.header)).join(',');
      const dataRows = data.List.map((row) => columns.map((c) => escapeCSV(row[c.key], c.key.includes('date'))).join(','));
      const csvContent = [headerRow, ...dataRows].join('\n');
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `members_${dateStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    }
  };

  const bulkUpdateAllNames = async () => {
    if (!window.confirm('This will update ALL member names to "Member". Continue?')) {
      return;
    }
    setBulkUpdating(true);
    try {
      const { data, error } = await window.ezsite.apis.sqlExecute({
        Sql: "UPDATE members SET full_name = @name",
        Parameters: [
        { name: 'name', value: 'Member', valueType: 'String' }]

      });
      if (error) {
        alert('Bulk update failed: ' + error);
      } else {
        alert(`Successfully updated ${data} records to "Member"`);
        loadMembers(1, membersSearch, membersGroupFilter);
      }
    } catch (err) {
      alert('Bulk update error: ' + (err.message || 'Unknown error'));
    }
    setBulkUpdating(false);
  };

  const handleAddMember = async () => {
    if (!addMemberEmail.trim()) {
      setAddMemberError('Email is required.');
      return;
    }
    setAddingMember(true);
    setAddMemberError('');
    try {
      const { error } = await window.ezsite.apis.tableCreate(MEMBERS_TABLE_ID, {
        full_name: addMemberName.trim() || 'Member',
        email: addMemberEmail.trim().toLowerCase(),
        status: addMemberStatus,
        member_group: addMemberGroup,
        subscribed_date: new Date().toISOString()
      });
      if (error) throw new Error(error);
      setShowAddMemberModal(false);
      setAddMemberName('');
      setAddMemberEmail('');
      setAddMemberStatus('active');
      setAddMemberGroup('A');
      loadMembers(membersPage, membersSearch, membersGroupFilter);
    } catch (err) {
      setAddMemberError(err.message || 'Failed to add member.');
    }
    setAddingMember(false);
  };

  const toggleMemberSelection = (memberId) => {
    setSelectedMembers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const toggleAllMembers = async () => {
    if (selectedMembers.size > 0) {
      setSelectedMembers(new Set());
      return;
    }

    setLoadingMembers(true);
    try {
      let allActiveIds = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const filters = [{ Name: 'status', Op: 'NotEqual', Value: 'unsubscribed' }];
        if (membersGroupFilter === 'A' || membersGroupFilter === 'B') {
          filters.push({ Name: 'member_group', Op: 'Equal', Value: membersGroupFilter });
        }
        const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
          PageNo: page,
          PageSize: 100,
          OrderByField: 'ID',
          IsAsc: true,
          Filters: filters
        });

        if (error || !data?.List?.length) {
          hasMore = false;
        } else {
          allActiveIds = allActiveIds.concat(data.List.map((m) => m.id || m.ID));
          page++;
          hasMore = data.List.length === 100;
        }
      }

      setSelectedMembers(new Set(allActiveIds));
    } catch (err) {
      console.error('Failed to select all members:', err);
    }
    setLoadingMembers(false);
  };

  const getSelectedActiveMembers = () => {
    return members.filter((m) =>
    m.status !== 'unsubscribed' &&
    selectedMembers.has(m.id || m.ID) &&
    m.email
    );
  };

  // Step 1: validate, load recipients, show confirmation dialog
  const handleSendEmail = async () => {
    // Block if a confirm dialog is already open or a send is in-flight
    if (showSendConfirm || isSendingRef.current || sendingEmail) return;
    if (selectedMembers.size === 0) {
      setEmailResult({ success: false, message: 'No members selected' });
      return;
    }
    if (!emailSubject.trim()) {
      setEmailResult({ success: false, message: 'Please enter a subject' });
      return;
    }
    if (!emailBody.trim()) {
      setEmailResult({ success: false, message: 'Please enter a message' });
      return;
    }

    // Fetch ALL active members across all pages, then filter to only the
    // ones the user selected (by ID set). We do client-side filtering
    // because Ezsite's tablePage `Filters: InList` operator isn't reliable —
    // an earlier attempt to use it silently returned the first page of
    // members instead of the requested IDs, causing emails to go to the
    // wrong recipients. This approach is safer: we know exactly who's
    // getting the email because we explicitly check each ID locally.
    let recipients = [];
    try {
      const selectedIdsSet = new Set(Array.from(selectedMembers).map(String));
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await window.ezsite.apis.tablePage(MEMBERS_TABLE_ID, {
          PageNo: page,
          PageSize: 100,
          OrderByField: 'ID',
          IsAsc: true
        });
        if (error || !data?.List?.length) {
          hasMore = false;
        } else {
          // Filter this page to only members whose IDs are in selectedIdsSet
          const matches = data.List.filter((m) => {
            const id = String(m.id ?? m.ID ?? '');
            return selectedIdsSet.has(id);
          });
          recipients = recipients.concat(matches);
          page++;
          hasMore = data.List.length === 100;
          // Stop early if we've found everyone we were looking for
          if (recipients.length >= selectedIdsSet.size) hasMore = false;
        }
      }
      console.log(`📨 [Members] Selected ${selectedIdsSet.size} ID(s), matched ${recipients.length} member row(s)`);

      // Filter to only active members with valid emails
      recipients = recipients.filter((m) => m.status !== 'unsubscribed' && m.email);

      // Deduplicate by ID
      const seenMemberIds = new Set();
      recipients = recipients.filter((m) => {
        const id = m.id || m.ID;
        if (seenMemberIds.has(id)) return false;
        seenMemberIds.add(id);
        return true;
      });

      // Deduplicate by email address
      const seenEmails = new Set();
      recipients = recipients.filter((m) => {
        const key = m.email.toLowerCase();
        if (seenEmails.has(key)) return false;
        seenEmails.add(key);
        return true;
      });
    } catch (err) {
      console.error('Failed to load selected members:', err);
      setEmailResult({ success: false, message: 'Failed to load member data' });
      return;
    }

    if (recipients.length === 0) {
      setEmailResult({ success: false, message: 'No active recipients with valid email addresses' });
      return;
    }

    // Show confirmation dialog with exact count before sending
    setPendingRecipients(recipients);
    setShowSendConfirm(true);
  };

  // Step 2: user confirmed — actually send (idempotency guard prevents re-entrant calls)
  const executeSend = async () => {
    if (isSendingRef.current) {
      console.warn('[sendBulkEmail] executeSend called while already in-flight — ignored');
      return;
    }
    isSendingRef.current = true;
    setShowSendConfirm(false);
    setSendingEmail(true);
    setEmailResult(null);

    const recipients = pendingRecipients;
    const fromSetting = settings.find((s) => s.setting_key === 'email_from');
    const fromAddress = fromSetting?.setting_value || 'NZ Melting Pot <noreply@nzmeltingpot.com>';
    const fromObj = parseFromAddress(fromAddress);
    const replyToObj = { email: 'info@nzmeltingpot.com', name: 'NZ Melting Pot' };

    const subscribeLink = generateSubscribeLink();
    const brevoRecipients = recipients.map((member) => {
      const unsubscribeLink = generateUnsubscribeLink(member.email);
      const updateDetailsLink = generateUpdateDetailsLink(member.email);
      const personalizedBody = emailBody.
      replace(/\{name\}/gi, member.full_name || 'Member').
      replace(/\{email\}/gi, member.email);
      const { html, text } = generateNewsletterEmail({
        fullName: member.full_name || 'Member',
        newsletterContent: /<[a-z][\s\S]*>/i.test(personalizedBody) ?
        personalizedBody :
        personalizedBody.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean).map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`).join(''),
        unsubscribeLink,
        updateDetailsLink,
        subscribeLink,
        newsletterName: 'NZ Melting Pot',
        siteName: 'NZ Melting Pot'
      });
      return { email: member.email, name: member.full_name || undefined, html, text };
    });

    console.log(`📨 [Brevo] Bulk newsletter to ${brevoRecipients.length} recipients from: ${fromAddress}`);

    // Log campaign start to DB (audit trail)
    let campaignLogId = null;
    try {
      const { data: logData } = await window.ezsite.apis.tableCreate(82960, {
        subject: emailSubject,
        recipient_count: recipients.length,
        sent_count: 0,
        failed_count: 0,
        status: 'sending',
        error_summary: '',
        sent_at: new Date().toISOString()
      });
      campaignLogId = logData?.ID || logData?.id || null;
      console.log(`📨 [Brevo] Campaign log created, ID=${campaignLogId}`);
    } catch (logErr) {
      console.warn('[sendBulkEmail] Failed to create campaign log:', logErr);
    }

    setSendProgress(null);
    const result = await sendBulkEmail({
      from: fromObj,
      replyTo: replyToObj,
      subject: emailSubject,
      recipients: brevoRecipients,
      onProgress: (p) => setSendProgress(p)
    });

    console.log('📨 [Brevo] Result:', result);

    const successCount = result.sent;
    const failCount = result.failed;
    const lastError = result.error || result.failures?.[0]?.error || null;

    // Update campaign log with final counts
    if (campaignLogId) {
      try {
        await window.ezsite.apis.tableUpdate(82960, {
          ID: campaignLogId,
          sent_count: successCount,
          failed_count: failCount,
          status: failCount === 0 ? 'completed' : successCount === 0 ? 'failed' : 'partial',
          error_summary: result.failures?.slice(0, 5).map((f) => `${f.email}: ${f.error}`).join('; ') || ''
        });
        console.log(`📨 [Brevo] Campaign log updated — sent: ${successCount}, failed: ${failCount}`);
      } catch (logErr) {
        console.warn('[sendBulkEmail] Failed to update campaign log:', logErr);
      }
    }

    setSendProgress(null);
    setSendingEmail(false);
    isSendingRef.current = false;

    if (successCount > 0 && failCount === 0) {
      setEmailResult({ success: true, message: `Email sent to ${successCount} member${successCount !== 1 ? 's' : ''} via Brevo` });
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailSubject('');
        setEmailBody('');
        setSelectedMembers(new Set());
        setEmailResult(null);
      }, 2000);
    } else if (successCount > 0) {
      setEmailResult({ success: true, message: `Sent to ${successCount}, failed for ${failCount}${lastError ? ` — ${lastError}` : ''}` });
    } else {
      const errorMsg = lastError ? `Error: ${lastError}` : 'Failed to send emails. Please try again.';
      setEmailResult({ success: false, message: errorMsg });
    }
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length === 0) {
        setImportResult({ success: false, message: 'CSV file is empty' });
        setImporting(false);
        return;
      }

      // Parse CSV - handle both with and without headers
      const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      // Check if first row looks like a header
      const firstRow = parseCSVLine(lines[0]);
      const looksLikeHeader = firstRow.some((cell) =>
      /^(name|full_name|fullname|email|status|group|member_group)$/i.test(cell)
      );

      const dataStartIndex = looksLikeHeader ? 1 : 0;
      let headerMap = { name: 0, email: 1, group: -1 }; // Default: name col 0, email col 1

      if (looksLikeHeader) {
        firstRow.forEach((header, idx) => {
          const h = header.toLowerCase().replace(/[_\s]/g, '');
          if (h === 'name' || h === 'fullname') headerMap.name = idx;
          if (h === 'email') headerMap.email = idx;
          if (h === 'group' || h === 'membergroup') headerMap.group = idx;
        });
      }

      const names = [];
      for (let i = dataStartIndex; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        const name = row[headerMap.name]?.trim();
        const email = row[headerMap.email]?.trim();
        let group = headerMap.group >= 0 ? row[headerMap.group]?.trim().toUpperCase() : '';
        if (group !== 'A' && group !== 'B') group = membersGroupFilter === 'A' || membersGroupFilter === 'B' ? membersGroupFilter : 'A';
        if (name) {
          names.push({ full_name: name, email: email || '', member_group: group });
        }
      }

      if (names.length === 0) {
        setImportResult({ success: false, message: 'No valid names found in CSV' });
        setImporting(false);
        return;
      }

      // Insert members into database
      let successCount = 0;
      let skipCount = 0;

      for (const member of names) {
        try {
          const { error } = await window.ezsite.apis.tableCreate(MEMBERS_TABLE_ID, {
            full_name: member.full_name,
            email: member.email,
            status: 'active',
            member_group: member.member_group || 'A',
            subscribed_date: new Date().toISOString()
          });
          if (error) {
            skipCount++;
          } else {
            successCount++;
          }
        } catch {
          skipCount++;
        }
      }

      setImportResult({
        success: true,
        message: `Imported ${successCount} member${successCount !== 1 ? 's' : ''}${skipCount > 0 ? ` (${skipCount} skipped)` : ''}`
      });

      loadMembers(1, membersSearch, membersGroupFilter);

    } catch (err) {
      setImportResult({ success: false, message: 'Failed to parse CSV: ' + (err.message || 'Unknown error') });
    }

    setImporting(false);
    // Reset the file input
    e.target.value = '';
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      // Fetch all submissions
      const { data, error } = await window.ezsite.apis.tablePage(SUBMISSIONS_TABLE_ID, {
        PageNo: 1,
        PageSize: 10000,
        OrderByField: 'id',
        IsAsc: false
      });

      if (error || !data?.List) {
        alert('Failed to fetch submissions: ' + (error || 'Unknown error'));
        setExporting(false);
        return;
      }

      // Filter to participation registrations only — exclude HON26 honour passes
      const submissions = data.List.filter(r => !String(r.unique_code || '').startsWith('HON26'));
      if (submissions.length === 0) {
        alert('No participation registrations found.');
        setExporting(false);
        return;
      }

      // Define column headers and their corresponding data keys
      const columns = [
      { header: 'Registration Code', key: 'unique_code' },
      { header: 'Leader Name', key: 'participant_name' },
      { header: 'Date of Birth', key: 'date_of_birth' },
      { header: 'Email', key: 'email' },
      { header: 'Phone', key: 'phone' },
      { header: 'Category', key: 'category' },
      { header: 'Performance Type', key: 'performance_type' },
      { header: 'Song Title', key: 'song_title' },
      { header: 'Participant 2', key: 'participant_2_name' },
      { header: 'Participant 3', key: 'participant_3_name' },
      { header: 'Participant 4', key: 'participant_4_name' },
      { header: 'Num Performers', key: 'num_performers' },
      { header: 'Total Fee', key: 'total_fee' },
      { header: 'Heard About', key: 'heard_about' },
      { header: 'Submission Time', key: 'submission_timestamp' },
      { header: 'Year', key: 'year' },
      { header: 'Checked In', key: 'checked_in' },
      { header: 'Checked In At', key: 'checked_in_at' }];


      // Helper to escape CSV values
      const escapeCSV = (val, isDate = false) => {
        if (val === null || val === undefined) return '';
        if (isDate && val) {
          const formatted = formatDate(val);
          if (formatted !== '—') return formatted;
        }
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      // Build CSV content
      const headerRow = columns.map((c) => escapeCSV(c.header)).join(',');
      const dataRows = submissions.map((row) =>
      columns.map((c) => escapeCSV(row[c.key], c.key.includes('date') || c.key.includes('timestamp'))).join(',')
      );
      const csvContent = [headerRow, ...dataRows].join('\n');

      // Add BOM for Excel UTF-8 compatibility
      const bom = '\uFEFF';
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });

      // Generate filename with date (dd-mm-yyyy)
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}-${month}-${year}`;
      const filename = `participation_registrations_${dateStr}.csv`;

      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed: ' + (err.message || 'Unknown error'));
    }
    setExporting(false);
  };

  // 2. Audience ticket bookings — table 82471
  const exportAudienceTickets = async () => {
    setExportingAudience(true);
    try {
      const { data, error } = await window.ezsite.apis.tablePage(BOOKINGS_TABLE_ID, {
        PageNo: 1, PageSize: 10000, OrderByField: 'id', IsAsc: false
      });
      if (error || !data?.List) {
        alert('Failed to fetch audience bookings: ' + (error || 'Unknown error'));
        setExportingAudience(false);
        return;
      }
      const bookings = data.List;
      if (bookings.length === 0) {
        alert('No audience ticket bookings found.');
        setExportingAudience(false);
        return;
      }

      const columns = [
        { header: 'Booking Reference', key: 'booking_ref' },
        { header: 'Buyer Name', key: 'buyer_name' },
        { header: 'Email', key: 'buyer_email' },
        { header: 'Phone', key: 'buyer_phone' },
        { header: 'Tickets', key: 'ticket_count' },
        { header: 'Total Paid ($)', key: 'total_amount' },
        { header: 'Attendee Names', key: 'attendee_names' },
        { header: 'Booking Time', key: 'booking_timestamp' },
        { header: 'Year', key: 'year' },
        { header: 'Checked In', key: 'checked_in' },
        { header: 'Checked In At', key: 'checked_in_at' }
      ];

      const escapeCSV = (val, isDate = false) => {
        if (val === null || val === undefined) return '';
        if (isDate && val) { const f = formatDate(val); if (f !== '—') return f; }
        const str = String(val);
        return (str.includes(',') || str.includes('"') || str.includes('\n'))
          ? '"' + str.replace(/"/g, '""') + '"'
          : str;
      };
      const headerRow = columns.map(c => escapeCSV(c.header)).join(',');
      const dataRows = bookings.map(row =>
        columns.map(c => escapeCSV(row[c.key], c.key.includes('timestamp'))).join(',')
      );
      const bom = '﻿';
      const blob = new Blob([bom + [headerRow, ...dataRows].join('\n')], { type: 'text/csv;charset=utf-8;' });
      const now = new Date();
      const ds = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audience_ticket_bookings_${ds}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + (err.message || 'Unknown error'));
    }
    setExportingAudience(false);
  };

  /* ── Core Files Backup & Restore ──────────────────────────────── */

  const handleUploadRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm(
      '⚠️ This will overwrite source files in the project root.\n\n' +
      '.env files, node_modules, .git, dist and binary files are skipped automatically.\n\n' +
      'Are you sure you want to proceed?'
    )) { e.target.value = ''; return; }

    setRestoring(true);
    setRestoreResult(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const files = [];
      const skipped = [];

      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue;
        // Safety guards — skip sensitive / generated folders
        if (/^\.env/.test(path) ||
            path.includes('node_modules/') ||
            path.includes('.git/') ||
            path.startsWith('dist/') ||
            path.startsWith('build/')) {
          skipped.push(path);
          continue;
        }
        try {
          const content = await entry.async('string');
          files.push({ path, content });
        } catch {
          skipped.push(path); // binary — skip silently
        }
      }

      if (files.length === 0) {
        setRestoreResult({ ok: false, msg: 'No restorable text files found in the ZIP.' });
        setRestoring(false);
        e.target.value = '';
        return;
      }

      const { data, error } = await window.ezsite.apis.run({
        path: 'backup/restoreProject',
        methodName: 'restoreProject',
        param: [files]
      });
      if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error));

      const written = data?.written ?? files.length;
      setRestoreResult({
        ok: true,
        msg: `✅ Restored ${written} file${written !== 1 ? 's' : ''} to project root.` +
             (skipped.length > 0 ? ` (${skipped.length} skipped)` : '') +
             ' The site will use the restored files on the next deploy.'
      });
    } catch (err) {
      setRestoreResult({ ok: false, msg: '❌ Restore failed: ' + (err.message || 'Unknown error') });
    }
    setRestoring(false);
    e.target.value = '';
  };

  const handleSave = async (key) => {
    const record = settings.find((s) => s.setting_key === key);
    if (!record) return;

    setSaving((p) => ({ ...p, [key]: true }));
    setSaveSuccess((p) => ({ ...p, [key]: false }));

    try {
      const { error } = await window.ezsite.apis.tableUpdate(SETTINGS_TABLE_ID, {
        ID: record.id || record.ID,
        setting_value: editValues[key]
      });
      if (error) throw new Error(error);
      setSaveSuccess((p) => ({ ...p, [key]: true }));
      setTimeout(() => setSaveSuccess((p) => ({ ...p, [key]: false })), 2500);
      // Update local settings array
      setSettings((prev) =>
      prev.map((s) => s.setting_key === key ? { ...s, setting_value: editValues[key] } : s)
      );
    } catch (err) {
      alert('Failed to save: ' + (err.message || 'Unknown error'));
    }
    setSaving((p) => ({ ...p, [key]: false }));
  };

  const hasChanged = (key) => {
    const record = settings.find((s) => s.setting_key === key);
    return record && editValues[key] !== record.setting_value;
  };

  // --- Loading state ---
  if (authLoading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ textAlign: 'center', color: '#666' }}>Checking authentication...</p>
        </div>
      </div>);

  }

  // --- Login form ---
  if (!user) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 420 }}>
          <h2 style={styles.heading}>Admin Login</h2>
          <p style={{ color: '#666', marginBottom: 24, textAlign: 'center', fontSize: '0.9rem' }}>
            Sign in to manage form content and email notifications.
          </p>
          {loginError && <div style={styles.error}>{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                style={styles.input}
                placeholder="admin@example.com" />

            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  style={styles.input}
                  placeholder="Enter password" />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>

                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              style={{
                ...styles.primaryBtn,
                opacity: loginLoading ? 0.6 : 1
              }} data-auth-id="a-a3gmqudpt">

              {loginLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>);

  }

  // --- Admin panel ---
  const totalMembersPages = Math.ceil(membersTotal / membersPageSize);

  return (
    <div style={styles.page}>
      <div style={{ ...styles.card, maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ ...styles.heading, marginBottom: 4 }}>Admin Panel</h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>
              Logged in as {user.Email}
            </p>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>
            Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={activeTab === 'dashboard' ? styles.tabActive : styles.tab}>

            📊 Dashboard
          </button>
          <button
            onClick={() => setActiveTab('content')}
            style={activeTab === 'content' ? styles.tabActive : styles.tab}>

            📋 Content
          </button>
          <button
            onClick={() => setActiveTab('submissions')}
            style={activeTab === 'submissions' ? styles.tabActive : styles.tab}>

            📥 Submissions
          </button>
          <button
            onClick={() => setActiveTab('members')}
            style={activeTab === 'members' ? styles.tabActive : styles.tab}>

            👥 Members
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            style={activeTab === 'apikeys' ? styles.tabActive : styles.tab}>

            🔑 API Keys
          </button>
          <button
            onClick={() => setActiveTab('passes')}
            style={activeTab === 'passes' ? styles.tabActive : styles.tab}>

            🎟️ Passes
          </button>
          <button
            onClick={() => setActiveTab('files')}
            style={activeTab === 'files' ? styles.tabActive : styles.tab}>

            🗂️ Files
          </button>
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' &&
        <div>
          {loadingDashboard ?
          <p style={{ textAlign: 'center', color: '#666', padding: 40 }}>Loading dashboard...</p> :

          <>
              {/* Stats Cards */}
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <div style={styles.statIcon}>📥</div>
                  <div style={styles.statNumber}>{dashboardStats.totalSubmissions}</div>
                  <div style={styles.statLabel}>Total Registrations</div>
                </div>
                <div style={{ ...styles.statCard, borderTopColor: '#16a34a' }}>
                  <div style={styles.statIcon}>👥</div>
                  <div style={styles.statNumber}>{dashboardStats.totalMembers}</div>
                  <div style={styles.statLabel}>Total Members</div>
                </div>
                <div style={{ ...styles.statCard, borderTopColor: '#2563eb' }}>
                  <div style={styles.statIcon}>✅</div>
                  <div style={styles.statNumber}>{dashboardStats.activeSubscribers}</div>
                  <div style={styles.statLabel}>Active Subscribers</div>
                </div>
                <div style={{ ...styles.statCard, borderTopColor: '#d97706' }}>
                  <div style={styles.statIcon}>🎵</div>
                  <div style={styles.statNumber}>{dashboardStats.thisYearSubmissions}</div>
                  <div style={styles.statLabel}>{new Date().getFullYear()} Registrations</div>
                </div>
              </div>

              {/* Recent Registrations */}
              <div style={styles.dashSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={styles.dashSectionTitle}>Recent Registrations</h3>
                  <button onClick={() => setActiveTab('submissions')} style={styles.dashLink}>View All →</button>
                </div>
                {recentSubmissions.length > 0 ?
              <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Email</th>
                          <th style={styles.th}>Category</th>
                          <th style={styles.th}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentSubmissions.map((s, i) =>
                    <tr key={i}>
                            <td style={styles.td}>{s.participant_name || '—'}</td>
                            <td style={styles.td}>{s.email || '—'}</td>
                            <td style={styles.td}>
                              <span style={styles.badge}>{s.category || '—'}</span>
                            </td>
                            <td style={styles.td}>{formatDate(s.submission_timestamp || s.CreatedAt)}</td>
                          </tr>
                    )}
                      </tbody>
                    </table>
                  </div> :

              <p style={{ color: '#999', fontSize: '0.85rem' }}>No registrations yet.</p>
              }
              </div>

              {/* Recent Members */}
              <div style={styles.dashSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={styles.dashSectionTitle}>Recent Members</h3>
                  <button onClick={() => setActiveTab('members')} style={styles.dashLink}>View All →</button>
                </div>
                {recentMembers.length > 0 ?
              <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Name</th>
                          <th style={styles.th}>Email</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentMembers.map((m, i) =>
                    <tr key={i}>
                            <td style={styles.td}>{m.full_name || '—'}</td>
                            <td style={styles.td}>{m.email || '—'}</td>
                            <td style={styles.td}>
                              <span style={{
                          ...styles.badge,
                          background: m.status === 'active' ? '#dcfce7' : '#fef2f2',
                          color: m.status === 'active' ? '#166534' : '#991b1b'
                        }}>
                                {m.status || '—'}
                              </span>
                            </td>
                            <td style={styles.td}>{formatDate(m.subscribed_date || m.CreatedAt)}</td>
                          </tr>
                    )}
                      </tbody>
                    </table>
                  </div> :

              <p style={{ color: '#999', fontSize: '0.85rem' }}>No members yet.</p>
              }
              </div>

              {/* Quick Actions */}
              <div style={styles.dashSection}>
                <h3 style={styles.dashSectionTitle}>Quick Actions</h3>
                <div style={styles.quickActions}>
                  <button onClick={() => {setActiveTab('submissions');setTimeout(() => exportToExcel(), 300);}} style={styles.quickActionBtn}>
                    <span style={{ fontSize: '1.3rem' }}>📥</span>
                    <span>Export Submissions</span>
                  </button>
                  <button onClick={() => setActiveTab('members')} style={styles.quickActionBtn}>
                    <span style={{ fontSize: '1.3rem' }}>✉️</span>
                    <span>Send Newsletter</span>
                  </button>
                  <a href="/" target="_blank" rel="noopener noreferrer" style={{ ...styles.quickActionBtn, textDecoration: 'none' }}>
                    <span style={{ fontSize: '1.3rem' }}>🌐</span>
                    <span>View Website</span>
                  </a>
                  <button onClick={() => loadDashboard()} style={styles.quickActionBtn}>
                    <span style={{ fontSize: '1.3rem' }}>🔄</span>
                    <span>Refresh Data</span>
                  </button>
                </div>
              </div>
            </>
          }
        </div>
        }

        {/* Submissions Tab */}
        {activeTab === 'submissions' &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── 1. Participation Registrations ── */}
          <div style={{ padding: '20px 24px', background: '#f8f6f3', borderRadius: 12, border: '1px solid #e6ddd3' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>🎤</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>Participation Registrations</h3>
              <span style={{ marginLeft: 'auto', background: '#7B1E2D', color: '#fff', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>Table 78687</span>
            </div>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 12 }}>
              Performer registrations submitted via the participation form (codes TSC26xxx). Honour passes are excluded.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={exportToExcel} disabled={exporting} style={{ ...styles.primaryBtn, width: 'auto', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'not-allowed' : 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {exporting ? 'Exporting…' : 'Download Participation CSV'}
              </button>
              <button onClick={loadSubmissionsLive} disabled={loadingSubsLive} style={{ background: 'none', border: 'none', color: '#7B1E2D', fontWeight: 600, fontSize: '0.85rem', cursor: loadingSubsLive ? 'default' : 'pointer', padding: 0 }}>
                {loadingSubsLive ? 'Loading…' : 'Refresh ↺'}
              </button>
            </div>
            {subsLive.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                  <strong style={{ color: subsLive.filter(r => r.checked_in).length > 0 ? '#16a34a' : '#1E1915' }}>
                    {subsLive.filter(r => r.checked_in).length}
                  </strong> of {subsLive.length} checked in
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      {['Code', 'Name', 'Category', 'Checked In'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e6ddd3', color: '#3D342E', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subsLive.map(r => (
                      <tr key={r.ID || r.id}>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8', fontFamily: 'monospace', color: '#7B1E2D', fontWeight: 700 }}>{r.unique_code}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8' }}>{r.participant_name}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8', color: '#666' }}>{r.category}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8' }}>
                          {(r.checked_in === true || r.checked_in === 'true' || r.checked_in === 1)
                            ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✅ {r.checked_in_at ? formatDate(r.checked_in_at) : ''}</span>
                            : <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── 2. Audience Ticket Bookings ── */}
          <div style={{ padding: '20px 24px', background: '#f8f6f3', borderRadius: 12, border: '1px solid #e6ddd3' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>🎟️</span>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>Audience Ticket Bookings</h3>
              <span style={{ marginLeft: 'auto', background: '#0B5E4F', color: '#fff', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '1px', padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase' }}>Table 82471</span>
            </div>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 12 }}>
              Audience ticket purchases made via the Book Tickets form (codes AUD26xxx). Separate from performer registrations.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
              <button onClick={exportAudienceTickets} disabled={exportingAudience} style={{ ...styles.primaryBtn, width: 'auto', padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#0B5E4F,#0d7a66)', opacity: exportingAudience ? 0.6 : 1, cursor: exportingAudience ? 'not-allowed' : 'pointer' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                {exportingAudience ? 'Exporting…' : 'Download Audience Tickets CSV'}
              </button>
              <button onClick={loadSubmissionsLive} disabled={loadingAudLive} style={{ background: 'none', border: 'none', color: '#0B5E4F', fontWeight: 600, fontSize: '0.85rem', cursor: loadingAudLive ? 'default' : 'pointer', padding: 0 }}>
                {loadingAudLive ? 'Loading…' : 'Refresh ↺'}
              </button>
            </div>
            {audLive.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                  <strong style={{ color: audLive.filter(r => r.checked_in).length > 0 ? '#16a34a' : '#1E1915' }}>
                    {audLive.filter(r => r.checked_in).length}
                  </strong> of {audLive.length} bookings checked in
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      {['Ref', 'Buyer', 'Tickets', 'Checked In'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #e6ddd3', color: '#3D342E', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {audLive.map(r => (
                      <tr key={r.ID || r.id}>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8', fontFamily: 'monospace', color: '#0B5E4F', fontWeight: 700 }}>{r.booking_ref}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8' }}>{r.buyer_name}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8', textAlign: 'center' }}>{r.ticket_count}</td>
                        <td style={{ padding: '7px 8px', borderBottom: '1px solid #f0ece8' }}>
                          {(r.checked_in === true || r.checked_in === 'true' || r.checked_in === 1)
                            ? <span style={{ color: '#16a34a', fontWeight: 700 }}>✅</span>
                            : <span style={{ color: '#9ca3af' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
        }

        {/* Members Tab */}
        {activeTab === 'members' &&
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>
                  👥 Mailing List Members
                </h3>
                <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.85rem' }}>
                  {membersTotal} {membersGroupFilter !== 'all' ? `Group ${membersGroupFilter} ` : ''}member{membersTotal !== 1 ? 's' : ''}
                  {' • '}<span style={{ color: '#166534' }}>{members.filter((m) => m.status !== 'unsubscribed').length} active (this page)</span>
                  {selectedMembers.size > 0 && ` • ${selectedMembers.size} selected`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedMembers.size > 0 &&
              <button
                onClick={() => setShowEmailModal(true)}
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)'
                }}>

                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    Send Email ({selectedMembers.size})
                  </button>
              }
                <button
                onClick={() => {setAddMemberError('');setShowAddMemberModal(true);}}
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #0f6a3a, #16a34a)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Member
                </button>
                <button
                onClick={() => handleRunDiagnostics(membersGroupFilter === 'B' ? 'B' : 'A')}
                title="Check why Group members aren't receiving emails — detects Brevo blocklist issues"
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #7B1E2D, #a83248)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Diagnose Delivery
                </button>
                <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                style={{ display: 'none' }}
                id="csv-import-input" />

                <button
                onClick={() => document.getElementById('csv-import-input').click()}
                disabled={importing}
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: importing ? '#999' : 'linear-gradient(135deg, #2d5a27, #3d7a35)',
                  opacity: importing ? 0.7 : 1
                }}>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  {importing ? 'Importing...' : 'Import CSV'}
                </button>
                <button
                onClick={exportMembers}
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
                <button
                onClick={bulkUpdateAllNames}
                disabled={bulkUpdating}
                style={{
                  ...styles.primaryBtn,
                  width: 'auto',
                  padding: '8px 16px',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: bulkUpdating ? '#999' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  opacity: bulkUpdating ? 0.7 : 1
                }}>

                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {bulkUpdating ? 'Updating...' : 'Set All Names to "Member"'}
                </button>
              </div>
            </div>

            {/* Search box */}
            <div style={{ marginBottom: 16, position: 'relative' }}>
              <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
              type="text"
              value={membersSearchInput}
              onChange={(e) => {
                setMembersSearchInput(e.target.value);
                // Debounce: only fire the actual search 350ms after the user stops typing
                clearTimeout(window.__membersSearchDebounce);
                window.__membersSearchDebounce = setTimeout(() => {
                  setMembersSearch(e.target.value.trim());
                }, 350);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  clearTimeout(window.__membersSearchDebounce);
                  setMembersSearch(membersSearchInput.trim());
                } else if (e.key === 'Escape') {
                  setMembersSearchInput('');
                  setMembersSearch('');
                }
              }}
              placeholder="Search by email…"
              style={{
                width: '100%',
                padding: '10px 38px 10px 38px',
                border: '1.5px solid #E6DDD3',
                borderRadius: 8,
                fontSize: '0.9rem',
                background: '#FFFCF8',
                outline: 'none',
                boxSizing: 'border-box'
              }} />
              {membersSearchInput &&
            <button
              type="button"
              onClick={() => {
                setMembersSearchInput('');
                setMembersSearch('');
              }}
              aria-label="Clear search"
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '1.1rem',
                lineHeight: 1,
                padding: 4
              }}>
                  ×
                </button>
            }
              {membersSearch &&
            <p style={{ margin: '8px 0 0 4px', fontSize: '0.78rem', color: '#7B1E2D' }}>
                  Showing results matching <strong>"{membersSearch}"</strong>
                  {' · '}
                  <button
                type="button"
                onClick={() => {
                  setMembersSearchInput('');
                  setMembersSearch('');
                }}
                style={{ background: 'none', border: 'none', color: '#7B1E2D', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.78rem', padding: 0 }}>
                    clear
                  </button>
                </p>
            }
            </div>

            {/* Group filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: '#666', fontWeight: 600 }}>Show:</span>
              {[['all', 'All Members'], ['A', 'Group A (250)'], ['B', 'Group B (62)']].map(([val, label]) =>
            <button
              key={val}
              onClick={() => {setMembersGroupFilter(val);setSelectedMembers(new Set());}}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: '1.5px solid',
                borderColor: membersGroupFilter === val ? '#7B1E2D' : '#E6DDD3',
                background: membersGroupFilter === val ? '#7B1E2D' : 'transparent',
                color: membersGroupFilter === val ? '#fff' : '#555',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                {label}
              </button>
            )}
            </div>

            {importResult &&
          <div style={{
            padding: '12px 16px',
            marginBottom: 16,
            borderRadius: 8,
            background: importResult.success ? '#dcfce7' : '#fef2f2',
            border: `1px solid ${importResult.success ? '#86efac' : '#fecaca'}`,
            color: importResult.success ? '#166534' : '#991b1b',
            fontSize: '0.9rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
                <span>{importResult.message}</span>
                <button
              onClick={() => setImportResult(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>

                  x
                </button>
              </div>
          }

            {loadingMembers ?
          <p style={{ textAlign: 'center', color: '#666', padding: 40 }}>Loading members...</p> :
          members.length === 0 ?
          <p style={{ textAlign: 'center', color: '#666', padding: 40, background: '#f8f6f3', borderRadius: 12 }}>
                No members yet. Members will appear here when they subscribe.
              </p> :

          <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: 40 }}>
                          <input
                        type="checkbox"
                        checked={selectedMembers.size > 0}
                        onChange={toggleAllMembers}
                        style={{ cursor: 'pointer', width: 16, height: 16 }}
                        title={selectedMembers.size > 0 ? `Deselect all (${selectedMembers.size} selected)` : "Select all active members"} />

                        </th>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Group</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Subscribed</th>
                        <th style={styles.th}>Unsubscribed</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) =>
                  <tr key={m.id || m.ID} style={{ background: selectedMembers.has(m.id || m.ID) ? '#f0f7ff' : 'transparent' }}>
                          <td style={styles.td}>
                            <input
                        type="checkbox"
                        checked={selectedMembers.has(m.id || m.ID)}
                        onChange={() => toggleMemberSelection(m.id || m.ID)}
                        disabled={m.status === 'unsubscribed'}
                        style={{ cursor: m.status !== 'unsubscribed' ? 'pointer' : 'not-allowed', width: 16, height: 16, opacity: m.status !== 'unsubscribed' ? 1 : 0.4 }} />

                          </td>
                          <td style={styles.td}>{m.full_name || '—'}</td>
                          <td style={styles.td}>{m.email || '—'}</td>
                          <td style={styles.td}>
                            <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: m.member_group === 'B' ? '#eff6ff' : '#fef9ee',
                        color: m.member_group === 'B' ? '#1d4ed8' : '#92400e'
                      }}>
                              Group {m.member_group || 'A'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <span style={{
                        display: 'inline-block',
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: m.status !== 'unsubscribed' ? '#dcfce7' : '#fef2f2',
                        color: m.status !== 'unsubscribed' ? '#166534' : '#991b1b'
                      }}>
                              {m.status !== 'unsubscribed' ? 'Active' : 'Unsubscribed'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            {formatDate(m.subscribed_date)}
                          </td>
                          <td style={styles.td}>
                            {m.status === 'unsubscribed' && m.unsubscribed_date && m.unsubscribed_date !== '1970-01-01T00:00:00' ?
                      formatDate(m.unsubscribed_date) :
                      '—'}
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {m.status !== 'unsubscribed' ?
                        <button
                          onClick={() => handleUnsubscribe(m)}
                          style={styles.actionBtn}
                          title="Unsubscribe">

                                  ❌
                                </button> :

                        <button
                          onClick={() => handleResubscribe(m)}
                          style={styles.actionBtn}
                          title="Resubscribe">

                                  ✅
                                </button>
                        }
                              <button
                          onClick={() => handleCheckDelivery(m)}
                          style={styles.actionBtn}
                          title="Check email delivery status">
                                📬
                              </button>
                              <button
                          onClick={() => handleDeleteMember(m)}
                          style={{ ...styles.actionBtn, color: '#991b1b' }}
                          title="Delete permanently">

                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                  )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalMembersPages > 1 &&
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                  onClick={() => loadMembers(1, membersSearch, membersGroupFilter)}
                  disabled={membersPage <= 1}
                  style={{
                    ...styles.paginationBtn,
                    opacity: membersPage <= 1 ? 0.4 : 1
                  }}>

                        ⏮ First
                      </button>
                      <button
                  onClick={() => loadMembers(membersPage - 1, membersSearch, membersGroupFilter)}
                  disabled={membersPage <= 1}
                  style={{
                    ...styles.paginationBtn,
                    opacity: membersPage <= 1 ? 0.4 : 1
                  }}>

                        ← Prev
                      </button>

                      {/* Page numbers */}
                      {(() => {
                  const pages = [];
                  const maxVisible = 7;
                  let start = Math.max(1, membersPage - 3);
                  let end = Math.min(totalMembersPages, start + maxVisible - 1);
                  if (end - start < maxVisible - 1) {
                    start = Math.max(1, end - maxVisible + 1);
                  }

                  if (start > 1) {
                    pages.push(
                      <button key={1} onClick={() => loadMembers(1, membersSearch, membersGroupFilter)} style={styles.pageNumBtn}>1</button>
                    );
                    if (start > 2) pages.push(<span key="dots1" style={{ color: '#666' }}>...</span>);
                  }

                  for (let i = start; i <= end; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => loadMembers(i, membersSearch, membersGroupFilter)}
                        style={{
                          ...styles.pageNumBtn,
                          background: i === membersPage ? '#c9a227' : 'transparent',
                          color: i === membersPage ? '#fff' : '#666',
                          fontWeight: i === membersPage ? 700 : 400
                        }}>

                              {i}
                            </button>
                    );
                  }

                  if (end < totalMembersPages) {
                    if (end < totalMembersPages - 1) pages.push(<span key="dots2" style={{ color: '#666' }}>...</span>);
                    pages.push(
                      <button key={totalMembersPages} onClick={() => loadMembers(totalMembersPages, membersSearch, membersGroupFilter)} style={styles.pageNumBtn}>{totalMembersPages}</button>
                    );
                  }

                  return pages;
                })()}

                      <button
                  onClick={() => loadMembers(membersPage + 1, membersSearch, membersGroupFilter)}
                  disabled={membersPage >= totalMembersPages}
                  style={{
                    ...styles.paginationBtn,
                    opacity: membersPage >= totalMembersPages ? 0.4 : 1
                  }}>

                        Next →
                      </button>
                      <button
                  onClick={() => loadMembers(totalMembersPages, membersSearch, membersGroupFilter)}
                  disabled={membersPage >= totalMembersPages}
                  style={{
                    ...styles.paginationBtn,
                    opacity: membersPage >= totalMembersPages ? 0.4 : 1
                  }}>

                        Last ⏭
                      </button>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#666' }}>
                      Page {membersPage} of {totalMembersPages} • {membersTotal} total members
                    </span>
                  </div>
            }
              </>
          }

            {/* Add Member Modal */}
            {showAddMemberModal &&
          <div style={styles.modalOverlay}>
                <div style={{ ...styles.modal, maxWidth: 440 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1E1915' }}>
                      ➕ Add Member
                    </h3>
                    <button
                  onClick={() => setShowAddMemberModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>
                      ×
                    </button>
                  </div>

                  {addMemberError &&
              <div style={{ padding: '10px 14px', marginBottom: 16, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.875rem' }}>
                      {addMemberError}
                    </div>
              }

                  <div style={{ marginBottom: 14 }}>
                    <label style={styles.label}>Full Name</label>
                    <input
                  type="text"
                  value={addMemberName}
                  onChange={(e) => setAddMemberName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  style={styles.input} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={styles.label}>Email <span style={{ color: '#991b1b' }}>*</span></label>
                    <input
                  type="email"
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="e.g. jane@example.com"
                  style={styles.input} />
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <label style={styles.label}>Status</label>
                    <select
                  value={addMemberStatus}
                  onChange={(e) => setAddMemberStatus(e.target.value)}
                  style={{ ...styles.input, cursor: 'pointer' }}>
                      <option value="active">Active</option>
                      <option value="unsubscribed">Unsubscribed</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <label style={styles.label}>Group</label>
                    <select
                  value={addMemberGroup}
                  onChange={(e) => setAddMemberGroup(e.target.value)}
                  style={{ ...styles.input, cursor: 'pointer' }}>
                      <option value="A">Group A</option>
                      <option value="B">Group B</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                  onClick={() => setShowAddMemberModal(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1.5px solid #E6DDD3',
                    borderRadius: 8,
                    color: '#666',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                      Cancel
                    </button>
                    <button
                  onClick={handleAddMember}
                  disabled={addingMember || !addMemberEmail.trim()}
                  style={{
                    ...styles.primaryBtn,
                    width: 'auto',
                    padding: '10px 24px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #0f6a3a, #16a34a)',
                    opacity: addingMember || !addMemberEmail.trim() ? 0.6 : 1
                  }}>
                      {addingMember ? 'Adding...' : 'Add Member'}
                    </button>
                  </div>
                </div>
              </div>
          }

            {/* Email Modal */}
            {showEmailModal &&
          <div style={styles.modalOverlay}>
                <div style={styles.modal}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1E1915' }}>
                      ✉️ Send Email to Members
                    </h3>
                    <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailResult(null);
                  }}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#666' }}>

                      ×
                    </button>
                  </div>

                  {/* Resend Setup Info */}
                  <div style={{
                padding: '12px 14px',
                marginBottom: 16,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                border: '1px solid #bae6fd',
                fontSize: '0.8rem',
                color: '#0369a1'
              }}>
                    <strong style={{ display: 'block', marginBottom: 4 }}>📨 Email Service (Brevo — bulk newsletters)</strong>
                    Newsletters are sent via Brevo. Configure <code>BREVO_API_KEY</code> in your Ezsite Env Vars panel.
                    Free tier: 300 emails/day. Single transactional emails (form submissions, payment confirmations) still use Resend.
                  </div>

                  <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 16 }}>
                    <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: '#dcfce7',
                  color: '#166534',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  marginRight: 6
                }}>{selectedMembers.size} selected</span>
                    {membersGroupFilter !== 'all' &&
                <span style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: membersGroupFilter === 'B' ? '#eff6ff' : '#fef9ee',
                  color: membersGroupFilter === 'B' ? '#1d4ed8' : '#92400e',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  marginRight: 6
                }}>Group {membersGroupFilter} only</span>
                }
                    Will send to all selected active members across all pages (unsubscribed members are automatically excluded).
                    <br />
                    <span style={{ color: '#888', fontSize: '0.8rem' }}>Tip: Use {'{name}'} to personalize. Unsubscribe link is auto-added to all emails.</span>
                  </p>

                  {emailResult &&
              <div style={{
                padding: '12px 16px',
                marginBottom: 16,
                borderRadius: 8,
                background: emailResult.success ? '#dcfce7' : '#fef2f2',
                border: `1px solid ${emailResult.success ? '#86efac' : '#fecaca'}`,
                color: emailResult.success ? '#166534' : '#991b1b',
                fontSize: '0.9rem'
              }}>
                      {emailResult.message}
                    </div>
              }

                  {sendingEmail && sendProgress &&
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#555', marginBottom: 6 }}>
                  <span>Sending batch {sendProgress.batch} of {sendProgress.batches}…</span>
                  <span>{sendProgress.sent} sent{sendProgress.failed > 0 ? `, ${sendProgress.failed} failed` : ''} / {sendProgress.total} total</span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 4,
                    background: 'linear-gradient(90deg, #1d4ed8, #3b82f6)',
                    width: `${Math.round((sendProgress.sent + sendProgress.failed) / sendProgress.total * 100)}%`,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </div>
              }

                  <div style={{ marginBottom: 16 }}>
                    <label style={styles.label}>Subject</label>
                    <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  style={styles.input} />

                  </div>

                  <div style={{ marginBottom: 20 }}>
                    <label style={styles.label}>Message</label>
                    <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Enter your message here...&#10;&#10;Use {name} to insert the member's name."
                  style={{ ...styles.input, minHeight: 180, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />

                  </div>

                  <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                    <button
                  onClick={() => {
                    setShowEmailModal(false);
                    setEmailResult(null);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1.5px solid #E6DDD3',
                    borderRadius: 8,
                    color: '#666',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>

                      Cancel
                    </button>
                    <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                  style={{
                    ...styles.primaryBtn,
                    width: 'auto',
                    padding: '10px 24px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                    opacity: sendingEmail || !emailSubject.trim() || !emailBody.trim() ? 0.6 : 1
                  }}>

                      {sendingEmail ?
                  <>Sending...</> :

                  <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          Send Email
                        </>
                  }
                    </button>
                  </div>
                </div>
              </div>
          }
          </div>
        }

        {/* API Keys Tab */}
        {activeTab === 'apikeys' &&
        <div>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>🔑</span> API Keys &amp; Integrations
            </div>
            <p style={{ color: '#666', fontSize: '0.85rem', marginBottom: 20, lineHeight: 1.6 }}>
              Configure third-party API keys. Keys are stored securely in the database and never exposed to the browser.
              Enter a new value and click Save to update.
            </p>

            {envLoading ?
          <p style={{ textAlign: 'center', color: '#666', padding: 32 }}>Loading key status…</p> :

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

                {/* Stripe */}
                <ApiKeyField
              label="Stripe Secret Key"
              keyName="STRIPE_SECRET_KEY"
              description="Used by the registration form to create Stripe Checkout sessions for participant payments. Get your key from stripe.com → Developers → API Keys."
              statusInfo={envStatus?.STRIPE_SECRET_KEY}
              value={envValues.STRIPE_SECRET_KEY}
              onChange={(v) => setEnvValues((p) => ({ ...p, STRIPE_SECRET_KEY: v }))}
              onSave={() => handleSaveEnvVar('STRIPE_SECRET_KEY')}
              saving={envSaving.STRIPE_SECRET_KEY}
              message={envMessages.STRIPE_SECRET_KEY}
              placeholder="sk_live_… or sk_test_…" />


                {/* Brevo */}
                <ApiKeyField
              label="Brevo API Key"
              keyName="BREVO_API_KEY"
              description="Used for bulk newsletter emails to members. Get your key from brevo.com → Settings → SMTP & API → API Keys."
              statusInfo={envStatus?.BREVO_API_KEY}
              value={envValues.BREVO_API_KEY}
              onChange={(v) => setEnvValues((p) => ({ ...p, BREVO_API_KEY: v }))}
              onSave={() => handleSaveEnvVar('BREVO_API_KEY')}
              saving={envSaving.BREVO_API_KEY}
              message={envMessages.BREVO_API_KEY}
              placeholder="xkeysib-…" />


                <div style={{ padding: '14px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.82rem', color: '#15803d', lineHeight: 1.6 }}>
                  <strong>Resend (transactional email):</strong> Used automatically by EzSite for payment confirmation and booking emails — no key needed here.
                </div>

              </div>
          }
          </div>
        }

        {/* Passes Tab */}
        {activeTab === 'passes' && <HonourPassesTab />}

        {/* Files Tab */}
        {activeTab === 'files' &&
        <div>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionIcon}>📥</span> Data Downloads
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Gate Check-In */}
            <div style={{ padding: 20, background: '#f0f9f0', border: '1px solid #a7d7a7', borderRadius: 10 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#1E1915', fontWeight: 700 }}>
                🎟️ Gate Check-In — Staff Access
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: '#555', lineHeight: 1.6 }}>
                Print this card and place it at the gate table. Volunteers scan the QR with their phone camera to open the check-in scanner. They enter the PIN once per session.
              </p>

              {/* Printable card */}
              <div id="gate-qr-card" style={{
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                background: '#fff', border: '2px solid #7B1E2D', borderRadius: 12,
                padding: '24px 32px', gap: 10, textAlign: 'center',
                fontFamily: 'Arial, sans-serif'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', letterSpacing: '2px', textTransform: 'uppercase' }}>
                  Musical Talent Showcase 2026
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7B1E2D' }}>
                  🎟️ Gate Check-In
                </div>
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https%3A%2F%2Fwww.nzmeltingpot.com%2Fcheck-in&format=png&margin=6"
                  alt="Staff check-in QR code"
                  width="180" height="180"
                  style={{ display: 'block', border: '1px solid #e5e7eb', borderRadius: 6 }}
                />
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  Scan with phone camera to open scanner
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 2 }}>
                  www.nzmeltingpot.com/check-in
                </div>
                <div style={{
                  background: '#7B1E2D', color: '#fff', borderRadius: 8,
                  padding: '8px 20px', marginTop: 4
                }}>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '2px', textTransform: 'uppercase', opacity: 0.8 }}>
                    Gate PIN
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '6px', fontFamily: 'monospace' }}>
                    2026
                  </div>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#9ca3af', maxWidth: 180, lineHeight: 1.5 }}>
                  Keep this PIN confidential — share only with gate volunteers
                </div>
              </div>

              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    const card = document.getElementById('gate-qr-card');
                    const win = window.open('', '_blank');
                    win.document.write(`
                      <html><head><title>Gate Check-In Card</title>
                      <style>body{margin:40px;display:flex;justify-content:center;align-items:flex-start;}
                      @media print{body{margin:0;}}</style></head>
                      <body>${card.outerHTML}</body></html>`);
                    win.document.close();
                    win.focus();
                    setTimeout(() => win.print(), 400);
                  }}
                  style={{
                    padding: '10px 18px', background: '#7B1E2D', color: '#fff',
                    border: 'none', borderRadius: 7, fontSize: '0.9rem',
                    fontWeight: 600, cursor: 'pointer'
                  }}>
                  🖨️ Print Card
                </button>
                <a
                  href="https://www.nzmeltingpot.com/check-in"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-block', padding: '10px 18px',
                    background: '#374151', color: '#fff',
                    borderRadius: 7, fontSize: '0.9rem', fontWeight: 600,
                    textDecoration: 'none'
                  }}>
                  🔗 Open Check-In Page
                </a>
              </div>
            </div>

            {/* Data Exports */}
            <div style={{ padding: 20, background: '#f8f4ef', border: '1px solid #E6DDD3', borderRadius: 10 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#1E1915', fontWeight: 700 }}>
                📥 Data Exports
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>
                Download your site data as CSV files for backup, reporting, or offline use.
              </p>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={exportToExcel}
                  disabled={exporting}
                  style={{
                    padding: '10px 18px',
                    background: '#2E7D32',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: exporting ? 'not-allowed' : 'pointer',
                    opacity: exporting ? 0.7 : 1
                  }}>
                  {exporting ? 'Exporting…' : '⬇ Submissions CSV'}
                </button>
                <button
                  onClick={exportMembers}
                  style={{
                    padding: '10px 18px',
                    background: '#1565C0',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 7,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}>
                  ⬇ Members CSV
                </button>
              </div>
            </div>

            {/* Core Files Backup & Restore */}
            <div style={{ padding: 20, background: '#f0f4fa', border: '1px solid #b8cef0', borderRadius: 10 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1rem', color: '#1E1915', fontWeight: 700 }}>
                🗂️ Core Files Backup &amp; Restore
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.85rem', color: '#555', lineHeight: 1.6 }}>
                Download a ZIP of all source code files (<code>src/</code>, <code>public/</code>, <code>__easysite_nodejs__/</code>,
                root config files), or upload a previously saved ZIP to restore them back to the project root.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleUploadRestore}
                  style={{ display: 'none' }}
                  id="restore-zip-input"
                />
                <button
                  onClick={() => { setRestoreResult(null); document.getElementById('restore-zip-input').click(); }}
                  disabled={restoring}
                  style={{
                    padding: '10px 18px',
                    background: restoring ? '#999' : '#7B1E2D',
                    color: '#fff', border: 'none', borderRadius: 7,
                    fontSize: '0.9rem', fontWeight: 600,
                    cursor: restoring ? 'not-allowed' : 'pointer',
                    opacity: restoring ? 0.7 : 1
                  }}>
                  {restoring ? 'Restoring…' : '⬆ Upload & Restore Core Files ZIP'}
                </button>
              </div>

              {restoreResult &&
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 10,
                  background: restoreResult.ok ? '#dcfce7' : '#fef2f2',
                  border: `1px solid ${restoreResult.ok ? '#86efac' : '#fecaca'}`,
                  color: restoreResult.ok ? '#166534' : '#991b1b',
                  fontSize: '0.85rem', lineHeight: 1.6
                }}>
                  {restoreResult.msg}
                </div>
              }

              <p style={{ margin: 0, fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.6 }}>
                ⚠️ Upload restores files directly to the project root. <code>.env</code> and binary files are skipped automatically.
                Changes take effect on the next site rebuild/deploy.
              </p>
            </div>

          </div>
        </div>
        }

        {/* Content Tab */}
        {activeTab === 'content' && (loadingSettings ?
        <p style={{ textAlign: 'center', color: '#666', padding: 40 }}>Loading settings...</p> :

        <div>
            {/* Thank-you section header */}
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>📋</span> Thank-You Page Content
            </div>

            {SETTING_ORDER.filter((k) => k.startsWith('thankyou_')).map((key) =>
          <SettingField
            key={key}
            settingKey={key}
            label={SETTING_LABELS[key]}
            value={editValues[key] || ''}
            onChange={(val) => setEditValues((p) => ({ ...p, [key]: val }))}
            onSave={() => handleSave(key)}
            saving={saving[key]}
            saved={saveSuccess[key]}
            changed={hasChanged(key)}
            isLong={key.includes('instructions') || key.includes('body')} />

          )}

            {/* Email section header */}
            <div style={{ ...styles.sectionHeader, marginTop: 32 }}>
              <span style={styles.sectionIcon}>✉️</span> Email Notification Content
            </div>

            {SETTING_ORDER.filter((k) => k.startsWith('email_')).map((key) =>
          <SettingField
            key={key}
            settingKey={key}
            label={SETTING_LABELS[key]}
            value={editValues[key] || ''}
            onChange={(val) => setEditValues((p) => ({ ...p, [key]: val }))}
            onSave={() => handleSave(key)}
            saving={saving[key]}
            saved={saveSuccess[key]}
            changed={hasChanged(key)}
            isLong={key.includes('instructions') || key.includes('body')} />

          )}
          </div>)
        }
      </div>

      {/* Send confirmation modal */}
      {showSendConfirm &&
      <div style={styles.modalOverlay}>
          <div style={{ ...styles.modal, maxWidth: 420 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>
              Confirm Bulk Send
            </h3>
            <p style={{ margin: '0 0 20px', color: '#555', fontSize: '0.95rem', lineHeight: 1.6 }}>
              You are about to send <strong>"{emailSubject}"</strong> to{' '}
              <strong>{pendingRecipients.length} recipient{pendingRecipients.length !== 1 ? 's' : ''}</strong>.
              <br />
              <span style={{ fontSize: '0.83rem', color: '#888' }}>
                This action cannot be undone. Each recipient will receive exactly one email.
              </span>
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
              onClick={() => {setShowSendConfirm(false);setPendingRecipients([]);}}
              style={{
                padding: '10px 20px',
                background: 'transparent',
                border: '1.5px solid #E6DDD3',
                borderRadius: 8,
                color: '#666',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}>
                Cancel
              </button>
              <button
              onClick={executeSend}
              disabled={isSendingRef.current || sendingEmail}
              style={{
                padding: '10px 24px',
                background: isSendingRef.current || sendingEmail ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: isSendingRef.current || sendingEmail ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Yes, send to {pendingRecipients.length}
              </button>
            </div>
          </div>
        </div>
      }

      {/* Group Delivery Diagnostics modal */}
      {showDiagModal &&
      <div style={styles.modalOverlay} onClick={() => setShowDiagModal(false)}>
          <div style={{ ...styles.modal, maxWidth: 680, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>Delivery Diagnostics — Group {diagGroup}</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#666' }}>Checking first 30 active members against Brevo's blocklist &amp; event history (last 90 days)</p>
              </div>
              <button onClick={() => setShowDiagModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#888', padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {diagLoading &&
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888', fontSize: '0.95rem' }}>
                <div style={{ marginBottom: 12, fontSize: '1.5rem' }}>🔍</div>
                Checking Brevo contact status and events… this may take 30–60 s for 30 contacts.
              </div>
          }

            {!diagLoading && diagError &&
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '14px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
                <strong>Error:</strong> {diagError}
              </div>
          }

            {!diagLoading && diagResults &&
          <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  {[
              { label: 'Checked', value: diagResults.summary.total, bg: '#f3f4f6', text: '#374151' },
              { label: 'Blocklisted', value: diagResults.summary.blocked, bg: diagResults.summary.blocked > 0 ? '#fef2f2' : '#f0fdf4', text: diagResults.summary.blocked > 0 ? '#991b1b' : '#166534' },
              { label: 'Active', value: diagResults.summary.active, bg: '#f0fdf4', text: '#166534' },
              { label: 'No Events', value: diagResults.summary.noEvents, bg: '#fef9c3', text: '#854d0e' }].
              map((card) =>
              <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: card.text }}>{card.value}</div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: card.text, opacity: 0.8, marginTop: 2 }}>{card.label}</div>
                    </div>
              )}
                </div>

                {diagResults.summary.blocked > 0 &&
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem', color: '#991b1b', lineHeight: 1.5 }}>
                    <strong>Root cause found:</strong> {diagResults.summary.blocked} of {diagResults.summary.total} checked contacts are on Brevo's blocklist.
                    Brevo still consumes your daily quota for these sends, but silently drops delivery.
                    To fix: go to <strong>Brevo → Contacts → Blocklist</strong> and remove these addresses, or investigate why they were blocked (prior hard bounce / spam report).
                  </div>
            }

                {diagResults.summary.blocked === 0 && diagResults.summary.noEvents === diagResults.summary.total &&
            <div style={{ background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: '0.85rem', color: '#854d0e', lineHeight: 1.5 }}>
                    <strong>No events recorded for any checked contact.</strong> Emails may be going to spam, or the sender domain may not be verified in Brevo.
                    Check: Brevo → Senders → verify your sending domain has correct SPF/DKIM records.
                  </div>
            }

                {/* Per-contact table */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: '#f9f5f0', borderBottom: '2px solid #E6DDD3' }}>
                        <th style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 600, color: '#555' }}>Email</th>
                        <th style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 600, color: '#555' }}>Blocklisted</th>
                        <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 600, color: '#555' }}>Last Event</th>
                        <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 600, color: '#555' }}>Date</th>
                        <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 600, color: '#555' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagResults.contacts.map((c, i) => {
                    const isBlocked = c.emailBlacklisted === true;
                    const isGoodEvent = ['delivered', 'opened', 'clicks'].includes(c.lastEvent);
                    const isBadEvent = ['hardBounce', 'softBounce', 'blocked', 'spam', 'error'].includes(c.lastEvent);
                    const eventColor = isGoodEvent ? { bg: '#dcfce7', text: '#166534' } : isBadEvent ? { bg: '#fef2f2', text: '#991b1b' } : c.lastEvent ? { bg: '#fef9c3', text: '#854d0e' } : { bg: '#f3f4f6', text: '#6b7280' };
                    const eventLabel = { delivered: 'Delivered', hardBounce: 'Hard Bounce', softBounce: 'Soft Bounce', blocked: 'Blocked', spam: 'Spam', deferred: 'Deferred', error: 'Error', opened: 'Opened', clicks: 'Clicked', unsubscribed: 'Unsubscribed' }[c.lastEvent] || c.lastEvent || '—';
                    const dateStr = c.lastEventDate ? new Date(c.lastEventDate).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: '2-digit' }) : '—';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f0ebe4', background: isBlocked ? '#fff5f5' : 'transparent' }}>
                            <td style={{ padding: '7px 10px', color: '#333', fontFamily: 'monospace', fontSize: '0.78rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</td>
                            <td style={{ padding: '7px 8px', textAlign: 'center' }}>
                              {isBlocked ?
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, background: '#fef2f2', color: '#991b1b' }}>YES</span> :
                          c.emailBlacklisted === false ?
                          <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>No</span> :
                          <span style={{ color: '#aaa', fontSize: '0.75rem' }}>—</span>}
                            </td>
                            <td style={{ padding: '7px 8px' }}>
                              <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700, background: eventColor.bg, color: eventColor.text }}>{eventLabel}</span>
                            </td>
                            <td style={{ padding: '7px 8px', color: '#666', whiteSpace: 'nowrap' }}>{dateStr}</td>
                            <td style={{ padding: '7px 8px', color: '#888', fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.reason || '—'}</td>
                          </tr>);

                  })}
                    </tbody>
                  </table>
                </div>
              </>
          }

            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
              onClick={() => handleRunDiagnostics(diagGroup === 'A' ? 'B' : 'A')}
              disabled={diagLoading}
              style={{ padding: '8px 16px', background: '#f3f4f6', border: '1.5px solid #E6DDD3', borderRadius: 8, color: '#555', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', opacity: diagLoading ? 0.5 : 1 }}>
                Check Group {diagGroup === 'A' ? 'B' : 'A'} instead
              </button>
              <button onClick={() => setShowDiagModal(false)} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1.5px solid #E6DDD3', borderRadius: 8, color: '#555', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      }

      {/* Email delivery status modal */}
      {showDeliveryModal &&
      <div style={styles.modalOverlay} onClick={() => setShowDeliveryModal(false)}>
          <div style={{ ...styles.modal, maxWidth: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1E1915' }}>Email Delivery Status</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#666' }}>{deliveryEmail} — last 90 days</p>
              </div>
              <button onClick={() => setShowDeliveryModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#888', padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {deliveryLoading &&
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: '0.95rem' }}>
                Looking up Brevo events…
              </div>
          }

            {!deliveryLoading && deliveryError &&
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', color: '#991b1b', fontSize: '0.9rem' }}>
                <strong>Error:</strong> {deliveryError}
              </div>
          }

            {!deliveryLoading && !deliveryError && deliveryEvents.length === 0 &&
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#888', fontSize: '0.95rem' }}>
                No delivery events found for this address in the last 90 days.
                <br /><span style={{ fontSize: '0.8rem' }}>Events appear after a newsletter has been sent to this member.</span>
              </div>
          }

            {!deliveryLoading && deliveryEvents.length > 0 &&
          <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f9f5f0', borderBottom: '2px solid #E6DDD3' }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555' }}>Subject</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600, color: '#555' }}>Reason / Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveryEvents.map((ev, i) => {
                  const isGood = ['delivered', 'opened', 'clicks'].includes(ev.event);
                  const isBad = ['hardBounce', 'softBounce', 'blocked', 'spam', 'error'].includes(ev.event);
                  const badgeColor = isGood ? { bg: '#dcfce7', text: '#166534' } : isBad ? { bg: '#fef2f2', text: '#991b1b' } : { bg: '#fef9c3', text: '#854d0e' };
                  const eventLabel = {
                    delivered: 'Delivered',
                    hardBounce: 'Hard Bounce',
                    softBounce: 'Soft Bounce',
                    blocked: 'Blocked',
                    spam: 'Spam',
                    deferred: 'Deferred',
                    error: 'Error',
                    opened: 'Opened',
                    clicks: 'Clicked',
                    unsubscribed: 'Unsubscribed'
                  }[ev.event] || ev.event;
                  const dateStr = ev.date ? new Date(ev.date).toLocaleString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f0ebe4' }}>
                          <td style={{ padding: '8px 10px', color: '#555', whiteSpace: 'nowrap' }}>{dateStr}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 700, background: badgeColor.bg, color: badgeColor.text }}>
                              {eventLabel}
                            </span>
                          </td>
                          <td style={{ padding: '8px 10px', color: '#333', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.subject || '—'}</td>
                          <td style={{ padding: '8px 10px', color: '#666', fontSize: '0.8rem' }}>{ev.reason || (ev.ip ? `IP: ${ev.ip}` : '—')}</td>
                        </tr>);

                })}
                  </tbody>
                </table>
              </div>
          }

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setShowDeliveryModal(false)} style={{ padding: '8px 20px', background: '#f3f4f6', border: '1.5px solid #E6DDD3', borderRadius: 8, color: '#555', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      }
    </div>);

}

function ApiKeyField({ label, keyName, description, statusInfo, value, onChange, onSave, saving, message, placeholder }) {
  const [showInput, setShowInput] = useState(false);
  const isSet = statusInfo?.set;
  const source = statusInfo?.source;
  const preview = statusInfo?.preview;

  return (
    <div style={{ padding: '20px 22px', background: '#FFFCF8', border: '1.5px solid #E6DDD3', borderRadius: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1E1915' }}>{label}</span>
        <span style={{
          display: 'inline-block',
          padding: '2px 10px',
          borderRadius: 10,
          fontSize: '0.72rem',
          fontWeight: 700,
          background: isSet ? '#dcfce7' : '#fef2f2',
          color: isSet ? '#166534' : '#991b1b'
        }}>
          {isSet ? `Configured (${source})` : 'Not configured'}
        </span>
        {isSet && preview &&
        <span style={{ fontSize: '0.78rem', color: '#9ca3af', fontFamily: 'monospace' }}>{preview}</span>
        }
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.55 }}>{description}</p>

      {!showInput ?
      <button
        onClick={() => setShowInput(true)}
        style={{
          padding: '8px 18px',
          background: isSet ? 'transparent' : '#7B1E2D',
          color: isSet ? '#7B1E2D' : '#fff',
          border: isSet ? '1.5px solid #7B1E2D' : 'none',
          borderRadius: 8,
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          {isSet ? 'Update Key' : 'Set Key'}
        </button> :

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          style={{
            flex: 1,
            minWidth: 220,
            padding: '9px 13px',
            border: '1.5px solid #E6DDD3',
            borderRadius: 8,
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            background: '#fff',
            outline: 'none'
          }} />

          <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          style={{
            padding: '9px 20px',
            background: saving || !value.trim() ? '#ccc' : '#7B1E2D',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.88rem',
            fontWeight: 600,
            cursor: saving || !value.trim() ? 'default' : 'pointer'
          }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
          onClick={() => {setShowInput(false);onChange('');}}
          style={{
            padding: '9px 14px',
            background: 'transparent',
            border: '1.5px solid #E6DDD3',
            borderRadius: 8,
            fontSize: '0.85rem',
            color: '#666',
            cursor: 'pointer'
          }}>
            Cancel
          </button>
        </div>
      }

      {message &&
      <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: message.ok ? '#16a34a' : '#991b1b' }}>
          {message.ok ? '✓' : '✗'} {message.text}
        </p>
      }
    </div>);

}

function SettingField({ label, value, onChange, onSave, saving, saved, changed, isLong }) {
  return (
    <div style={styles.settingRow}>
      <label style={styles.settingLabel}>{label}</label>
      {isLong ?
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...styles.input, minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }} /> :


      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={styles.input} />

      }
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <button
          onClick={onSave}
          disabled={saving || !changed}
          style={{
            ...styles.saveBtn,
            opacity: saving || !changed ? 0.5 : 1,
            cursor: saving || !changed ? 'default' : 'pointer'
          }}>

          {saving ? 'Saving...' : 'Save'}
        </button>
        {saved && <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>Saved!</span>}
      </div>
    </div>);

}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '60px 16px 80px',
    background: 'linear-gradient(135deg, #FBF5ED 0%, #F5EDDF 100%)'
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 800,
    boxShadow: '0 4px 30px rgba(30, 25, 21, 0.08)'
  },
  heading: {
    fontFamily: "'Cormorant', Georgia, serif",
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#1E1915',
    margin: '0 0 16px',
    textAlign: 'center'
  },
  field: {
    marginBottom: 18
  },
  label: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#3D342E',
    marginBottom: 6
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #E6DDD3',
    borderRadius: 8,
    fontSize: '0.95rem',
    color: '#1E1915',
    background: '#FFFCF8',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: 4
  },
  primaryBtn: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #7B1E2D, #A83832)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8
  },
  error: {
    padding: '10px 14px',
    marginBottom: 16,
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    color: '#991b1b',
    fontSize: '0.9rem'
  },
  logoutBtn: {
    padding: '8px 20px',
    background: 'transparent',
    border: '1.5px solid #E6DDD3',
    borderRadius: 8,
    color: '#7B1E2D',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer'
  },
  sectionHeader: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#7B1E2D',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '2px solid #F0D0C8',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  sectionIcon: {
    fontSize: '1.2rem'
  },
  settingRow: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottom: '1px solid #f3ede6'
  },
  settingLabel: {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#3D342E',
    marginBottom: 6
  },
  saveBtn: {
    padding: '6px 18px',
    background: '#7B1E2D',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: '0.82rem',
    fontWeight: 600
  },
  tabContainer: {
    display: 'flex',
    gap: 8,
    marginBottom: 24,
    borderBottom: '2px solid #E6DDD3',
    paddingBottom: 0
  },
  tab: {
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    color: '#666',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: -2,
    transition: 'color 0.2s, border-color 0.2s'
  },
  tabActive: {
    padding: '10px 20px',
    background: 'transparent',
    border: 'none',
    borderBottom: '3px solid #7B1E2D',
    color: '#7B1E2D',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: -2
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.85rem'
  },
  th: {
    textAlign: 'left',
    padding: '12px 10px',
    borderBottom: '2px solid #E6DDD3',
    fontWeight: 700,
    color: '#3D342E',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  td: {
    padding: '12px 10px',
    borderBottom: '1px solid #f3ede6',
    color: '#1E1915'
  },
  actionBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: 4
  },
  paginationBtn: {
    padding: '6px 14px',
    background: '#f8f6f3',
    border: '1px solid #E6DDD3',
    borderRadius: 6,
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#3D342E',
    cursor: 'pointer'
  },
  pageNumBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #E6DDD3',
    borderRadius: 6,
    fontSize: '0.82rem',
    color: '#666',
    cursor: 'pointer',
    minWidth: 36,
    textAlign: 'center'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    padding: '28px 32px',
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  },
  // Dashboard styles
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 16,
    marginBottom: 32
  },
  statCard: {
    background: '#FFFCF8',
    borderRadius: 12,
    padding: '20px 16px',
    textAlign: 'center',
    border: '1px solid #E6DDD3',
    borderTop: '4px solid #7B1E2D',
    transition: 'box-shadow 0.2s'
  },
  statIcon: {
    fontSize: '1.5rem',
    marginBottom: 8
  },
  statNumber: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#1E1915',
    fontFamily: "'Cormorant', Georgia, serif",
    lineHeight: 1
  },
  statLabel: {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: '#888',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  dashSection: {
    background: '#f8f6f3',
    borderRadius: 12,
    padding: '20px 24px',
    border: '1px solid #e6ddd3',
    marginBottom: 20
  },
  dashSectionTitle: {
    margin: 0,
    fontSize: '1.05rem',
    fontWeight: 700,
    color: '#1E1915'
  },
  dashLink: {
    background: 'none',
    border: 'none',
    color: '#7B1E2D',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: 0
  },
  badge: {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: '0.78rem',
    fontWeight: 600,
    background: '#FBF5ED',
    color: '#7B1E2D'
  },
  quickActions: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginTop: 12
  },
  quickActionBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '16px 12px',
    background: '#fff',
    border: '1.5px solid #E6DDD3',
    borderRadius: 10,
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#3D342E',
    transition: 'border-color 0.2s, box-shadow 0.2s'
  }
};