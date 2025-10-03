import { createClient } from 'npm:@supabase/supabase-js@2';
import { createClerkClient } from "npm:@clerk/backend";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Initialize Clerk with secret key
    //const clerk = new Clerk(Deno.env.get('CLERK_SECRET_KEY'));
    const clerk = createClerkClient({
      secretKey: Deno.env.get("CLERK_SECRET_KEY")
    });
    // Initialize Supabase admin client
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop() // 'create-user', 'update-user', or 'delete-user'
    ;
    if (req.method === 'POST' && action === 'create-user') {
      const { username, password, role, locations } = await req.json();
      // Validate input
      if (!username || !password || !role) {
        return new Response(JSON.stringify({
          error: 'Username, password, and role are required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (password.length < 8) {
        return new Response(JSON.stringify({
          error: 'Password must be at least 8 characters long'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (![
        'SUPERADMIN_ROLE',
        'BOD_ROLE',
        'SALES_MANAGER_ROLE',
        'SALES_SUPERVISOR_ROLE',
        'AUDITOR_ROLE'
      ].includes(role)) {
        return new Response(JSON.stringify({
          error: 'Invalid role specified'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Create user in Clerk
      let clerkUser;
      try {
        clerkUser = await clerk.users.createUser({
          username: username,
          password: password,
          publicMetadata: {
            role: role,
            locations: locations || []
          }
        });
      } catch (error) {
        console.error('Clerk user creation error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to create user in Clerk: ' + error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Create user in Supabase
      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin.from('users').insert({
        clerk_id: clerkUser.id,
        name: username,
        role: role,
        locations: locations || []
      }).select().single();
      if (supabaseError) {
        console.error('Supabase user creation error:', supabaseError);
        // Rollback: delete from Clerk if Supabase insert fails
        try {
          await clerk.users.deleteUser(clerkUser.id);
        } catch (rollbackError) {
          console.error('Failed to rollback Clerk user:', rollbackError);
        }
        return new Response(JSON.stringify({
          error: 'Failed to create user in database: ' + supabaseError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: supabaseUser.id,
          clerk_id: clerkUser.id,
          name: username,
          role: role,
          locations: locations || []
        }
      }), {
        status: 201,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (req.method === 'PATCH' && action === 'update-user') {
      const { clerkId, role, locations } = await req.json();
      if (!clerkId || !role && !locations) {
        return new Response(JSON.stringify({
          error: 'Clerk ID and at least one field (role or locations) are required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (role && ![
        'SUPERADMIN_ROLE',
        'BOD_ROLE',
        'SALES_MANAGER_ROLE',
        'SALES_SUPERVISOR_ROLE',
        'AUDITOR_ROLE'
      ].includes(role)) {
        return new Response(JSON.stringify({
          error: 'Invalid role specified'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Update user in Clerk
      try {
        await clerk.users.updateUserMetadata(clerkId, {
          publicMetadata: {
            ...role && {
              role
            },
            ...locations !== undefined && {
              locations
            }
          }
        });
      } catch (error) {
        console.error('Clerk user update error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to update user in Clerk: ' + error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Update user in Supabase
      const updateData = {};
      if (role) updateData.role = role;
      if (locations !== undefined) updateData.locations = locations;
      const { error: supabaseError } = await supabaseAdmin.from('users').update(updateData).eq('clerk_id', clerkId);
      if (supabaseError) {
        console.error('Supabase user update error:', supabaseError);
        return new Response(JSON.stringify({
          error: 'Failed to update user in database: ' + supabaseError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'User updated successfully'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    if (req.method === 'DELETE' && action === 'delete-user') {
      const { clerkId } = await req.json();
      if (!clerkId) {
        return new Response(JSON.stringify({
          error: 'Clerk ID is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Delete user from Clerk
      try {
        await clerk.users.deleteUser(clerkId);
      } catch (error) {
        console.error('Clerk user deletion error:', error);
        return new Response(JSON.stringify({
          error: 'Failed to delete user from Clerk: ' + error.message
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      // Delete user from Supabase
      const { error: supabaseError } = await supabaseAdmin.from('users').delete().eq('clerk_id', clerkId);
      if (supabaseError) {
        console.error('Supabase user deletion error:', supabaseError);
        return new Response(JSON.stringify({
          error: 'Failed to delete user from database: ' + supabaseError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      return new Response(JSON.stringify({
        success: true,
        message: 'User deleted successfully'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
