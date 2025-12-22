// Config loader for Supabase settings
(function(){
  const DEFAULTS = {
    supabaseUrl: 'https://kqjcorjjvunmyrnzvqgr.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxamNvcmpqdnVubXlybnp2cWdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTc4ODgsImV4cCI6MjA3MTI5Mzg4OH0.l-ZdPOYMNi8x3lBqlemwQ2elDyvoPy-2ZUWuODVviWk'
  };

  async function loadConfig() {
    try {
      const { supabaseUrl, supabaseAnonKey } = await chrome.storage.local.get(['supabaseUrl', 'supabaseAnonKey']);
      return {
        supabaseUrl: supabaseUrl || DEFAULTS.supabaseUrl,
        supabaseAnonKey: supabaseAnonKey || DEFAULTS.supabaseAnonKey,
      };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  window.urlNotesConfig = {
    loadConfig
  };
})();
