type Bank = { code: string; name: string };

/**
 * Nigerian banks and their payout codes (the codes Paystack uses).
 * TODO: the server should serve this list from Paystack so new banks appear without an app update.
 */
export const banks: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '050', name: 'Ecobank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank' },
  { code: '214', name: 'FCMB' },
  { code: '058', name: 'GTBank' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '50211', name: 'Kuda' },
  { code: '50515', name: 'Moniepoint' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '076', name: 'Polaris Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC' },
  { code: '232', name: 'Sterling Bank' },
  { code: '032', name: 'Union Bank' },
  { code: '033', name: 'UBA' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
];
export const bankName = (code: string) => banks.find((b) => b.code === code)?.name ?? 'Bank';
