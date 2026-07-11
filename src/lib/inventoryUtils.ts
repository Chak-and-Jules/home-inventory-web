export type ExpiryStatus = 'expired' | 'expiring-soon' | 'good';

export const getExpiryStatus = (dateStr: string | undefined): ExpiryStatus => {
  if (!dateStr) return 'good';
  const expiryDate = new Date(dateStr);
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  if (expiryDate <= now) return 'expired';
  if (expiryDate <= sevenDaysFromNow) return 'expiring-soon';
  return 'good';
};
