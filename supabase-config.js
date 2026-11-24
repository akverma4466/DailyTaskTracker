const SUPABASE_URL = "https://fisjmtmorvddknwmcnvp.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_48WvvEPaGHMZnEpQjEIXtA_G7Cn9mQT";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);