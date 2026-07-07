import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rtemlpaeyjpbktpqqtwv.supabase.co';
const supabaseKey = 'sb_publishable_4WfCIDmYkPBrxVU6AtsJlA_wx-KRhwj';

export const supabase = createClient(supabaseUrl, supabaseKey);
