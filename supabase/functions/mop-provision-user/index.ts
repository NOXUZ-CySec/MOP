import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { provision } from "./provision.mjs";

const url = Deno.env.get("SUPABASE_URL")!;
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

Deno.serve((request) => provision(
  request,
  (token: string) => createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth,
    global: { headers: { Authorization: "Bearer " + token } },
  }),
  () => createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth }).auth.admin,
));
