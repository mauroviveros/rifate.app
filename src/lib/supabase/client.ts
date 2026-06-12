import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';

import type { Database } from '@/types';

export const createBrowserClient = () => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

  return createSSRBrowserClient<Database>(url, anonKey);
};
