// =============================================================
// CHI-BEST STORE CONFIGURATION
// =============================================================
// 1. SUPABASE (live database)
//    Leave url/anonKey empty to run in DEMO MODE: everything works,
//    but data is saved only in the current browser. To go live, create
//    a Supabase project, run database/schema.sql then database/seed.sql,
//    and paste the Project URL + anon/publishable key below.
//    See SETUP.md for the full walkthrough.
//
// 2. DEFAULT SETTINGS
//    Used the first time the store starts. After that, edit them in
//    Admin > Settings (no code changes needed).
// =============================================================

window.CHIBEST_CONFIG = {
  supabase: {
    url: '',      // e.g. 'https://abcdefgh.supabase.co'
    anonKey: ''   // the "anon" / "publishable" key (safe to expose)
  },

  // Demo-mode admin passcode (only used when Supabase is not connected).
  // In live mode, admins sign in with a Supabase email + password instead.
  demoPasscode: 'chibest-admin',

  defaults: {
    storeName: 'Chi-Best',
    tagline: 'Global finds, delivered to Nigeria',
    whatsapp: '2340000000000',          // international format, no + or spaces
    phone: '+234 000 000 0000',
    email: 'info@chibest.com',
    address: 'Lagos, Nigeria',
    instagram: '',
    facebook: '',
    tiktok: '',

    delivery: {
      lagosFee: 4000,
      otherFee: 7500,
      freeThreshold: 150000,             // 0 disables free delivery
      lagosTime: '1-3 working days',
      otherTime: '3-7 working days',
      pickupEnabled: true,
      pickupNote: 'Pickup from our Lagos office. Address shared on confirmation.'
    },

    preorderLeadTime: '14-21 days',
    returnsDays: 7,

    payments: {
      bankTransfer: true,
      bankName: '',
      accountName: '',
      accountNumber: '',
      payOnDelivery: true,
      payOnDeliveryLagosOnly: true
    },

    inventory: {
      defaultLowStock: 5
    },

    announcements: [
      'Free delivery on orders over {freeThreshold}',
      'Pre-order straight from China, delivered in {preorderLeadTime}',
      'Pay on delivery available in Lagos'
    ]
  }
};
