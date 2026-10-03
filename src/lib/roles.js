export const ROLES = {
  admin: { label: 'Penyelaras', group: 'staff' },
  counselor: { label: 'Kaunselor', group: 'staff' },
  user: { label: 'Pelajar', group: 'student' },
};

export function getRoleLabel(role) {
  return ROLES[role]?.label || 'Tidak Diketahui';
}

export function isStaff(role) {
  return ROLES[role]?.group === 'staff';
}