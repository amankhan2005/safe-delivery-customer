// Format currency — Liberian Dollar
export const fmtCurrency = (amount) => {
  if (!amount && amount !== 0) return '$0.00';
  return `$${Number(amount).toFixed(2)}`;
};

// Format date
export const fmtDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

// Format date + time
export const fmtDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Time ago
export const fmtAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return fmtDate(dateStr);
};

// Order status → human readable
export const fmtStatus = (status) => {
  const map = {
    searching:  'Finding Rider',
    assigned:   'Rider Assigned',
    picked_up:  'Picked Up',
    in_transit: 'In Transit',
    delivered:  'Delivered',
    cancelled:  'Cancelled',
  };
  return map[status] || status;
};

// Order status → color
export const statusColor = (status) => {
  const map = {
    searching:  '#F59E0B',
    assigned:   '#1B4FD8',
    picked_up:  '#06B6D4',
    in_transit: '#8B5CF6',
    delivered:  '#22C55E',
    cancelled:  '#E8212B',
  };
  return map[status] || '#9CA3AF';
};

// Liberia phone normalizer
export const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('231')) return `+${digits}`;
  if (digits.startsWith('0'))   return `+231${digits.slice(1)}`;
  if (digits.length === 8 || digits.length === 9) return `+231${digits}`;
  return `+${digits}`;
};
