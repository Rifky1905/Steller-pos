import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://buswbtzqwfphxutqhrhr.supabase.co'
const supabaseKey = 'sb_publishable_UKByLDxfG0C9PBYBJYCEqg_F1GY3Fo-'

export const supabase = createClient(supabaseUrl, supabaseKey)
