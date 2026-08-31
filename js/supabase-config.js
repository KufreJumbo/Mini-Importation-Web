// =============================================
// CHI BEST - SUPABASE CONFIGURATION
// =============================================
// Replace these values with your Supabase credentials
// Get them from: https://app.supabase.com/project/_/settings/api
// =============================================

const SUPABASE_CONFIG = {
    // Your Supabase project URL
    url: 'YOUR_SUPABASE_PROJECT_URL',
    
    // Your Supabase anon/public key
    anonKey: 'YOUR_SUPABASE_ANON_KEY',
    
    // Enable debug mode to see console logs
    debug: false
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SUPABASE_CONFIG };
}