import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'svix';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
// Raw body for webhook verification
app.use('/api/webhooks', express.raw({ type: 'application/json' }));
// JSON parsing for other routes
app.use(express.json());

// Initialize Clerk client
const clerkClient = createClerkClient({ 
  secretKey: process.env.CLERK_SECRET_KEY 
});

// Initialize Supabase client (admin client with service role key)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Create new user endpoint
app.post('/api/users/create', async (req, res) => {
  try {
    const { username, password, role, locations } = req.body;

    // Validate required fields
    if (!username || !password || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: username, password, and role are required' 
      });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Step 1: Create user in Clerk with metadata (following Clerk + Supabase integration pattern)
    console.log('Creating user in Clerk:', { username, role, locations });
    const clerkUser = await clerkClient.users.createUser({
      username: username,
      password: password,
      publicMetadata: {
        role: role,
        locations: locations || []
      }
    });

    console.log('Clerk user created:', clerkUser.id);

    // Step 2: Create user record in Supabase
    // This follows the Clerk + Supabase integration pattern where the JWT token
    // will contain the publicMetadata, and RLS policies can use it
    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
      .from('users')
      .insert({
        clerk_id: clerkUser.id,
        name: username,
        role: role,
        locations: locations || []
      })
      .select()
      .single();

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
      
      // Rollback: Delete the Clerk user if Supabase insert fails
      try {
        await clerkClient.users.deleteUser(clerkUser.id);
        console.log('Rolled back Clerk user creation');
      } catch (rollbackError) {
        console.error('Failed to rollback Clerk user:', rollbackError);
      }

      return res.status(500).json({ 
        error: 'Failed to create user in database', 
        details: supabaseError.message 
      });
    }

    console.log('User created successfully:', supabaseUser);

    // Step 3: Send invitation email (optional)
    // await clerkClient.users.sendInvitation(clerkUser.id);

    res.status(201).json({
      success: true,
      user: {
        id: supabaseUser.id,
        clerk_id: clerkUser.id,
        name: supabaseUser.name,
        username: username,
        role: supabaseUser.role,
        locations: supabaseUser.locations
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
    
    // Handle Clerk-specific errors
    if (error.errors && Array.isArray(error.errors)) {
      return res.status(400).json({ 
        error: 'Clerk validation error', 
        details: error.errors 
      });
    }

    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});

// Update user endpoint (for role and location changes)
app.patch('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, locations } = req.body;

    // Step 1: Get user's clerk_id from Supabase
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_id')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 2: Update Clerk metadata (following Clerk + Supabase integration pattern)
    if (user.clerk_id) {
      try {
        await clerkClient.users.updateUserMetadata(user.clerk_id, {
          publicMetadata: {
            role: role,
            locations: locations || []
          }
        });
        console.log('Updated Clerk metadata for user:', user.clerk_id);
      } catch (clerkError) {
        console.error('Failed to update Clerk metadata:', clerkError);
        return res.status(500).json({ 
          error: 'Failed to update user metadata in Clerk',
          details: clerkError.message 
        });
      }
    }

    // Step 3: Update Supabase record
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role, locations })
      .eq('id', userId);

    if (updateError) {
      return res.status(500).json({ 
        error: 'Failed to update user in database',
        details: updateError.message 
      });
    }

    res.json({ success: true, message: 'User updated successfully' });

  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Delete user endpoint
app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Step 1: Get user's clerk_id from Supabase
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_id')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 2: Delete from Clerk
    if (user.clerk_id) {
      try {
        await clerkClient.users.deleteUser(user.clerk_id);
        console.log('Deleted user from Clerk:', user.clerk_id);
      } catch (clerkError) {
        console.error('Failed to delete from Clerk:', clerkError);
        // Continue with Supabase deletion even if Clerk fails
      }
    }

    // Step 3: Delete from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId);

    if (deleteError) {
      return res.status(500).json({ 
        error: 'Failed to delete user from database',
        details: deleteError.message 
      });
    }

    res.json({ success: true, message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Clerk Webhook endpoint for syncing users to Supabase
app.post('/api/webhooks/clerk', async (req, res) => {
  try {
    // Get webhook signing secret from environment
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!WEBHOOK_SECRET) {
      console.error('CLERK_WEBHOOK_SECRET is not set');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get headers for verification
    const svix_id = req.headers['svix-id'];
    const svix_timestamp = req.headers['svix-timestamp'];
    const svix_signature = req.headers['svix-signature'];

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    // Get raw body (we need raw body for signature verification)
    const payload = req.body;
    const body = payload.toString();

    // Verify webhook signature using Svix
    const wh = new Webhook(WEBHOOK_SECRET);
    let evt;

    try {
      evt = wh.verify(body, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Extract event data
    const eventType = evt.type;
    const { id, username, public_metadata, first_name, last_name } = evt.data;

    console.log(`Webhook received: ${eventType} for user ${id}`);

    // Handle different event types
    switch (eventType) {
      case 'user.created': {
        // Get role and locations from public_metadata
        const role = public_metadata?.role || 'NO_ROLE';
        const locations = public_metadata?.locations || [];
        
        // Determine name: prefer username, fallback to first/last name, fallback to 'User'
        const name = username || 
                     (first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name) ||
                     'User';

        // Create user in Supabase
        const { error } = await supabaseAdmin
          .from('users')
          .insert({
            clerk_id: id,
            name: name,
            role: role,
            locations: locations
          });

        if (error) {
          console.error('Error creating user in Supabase:', error);
          // Don't return error to Clerk, just log it
          // Webhook will retry automatically
        } else {
          console.log(`✅ User created in Supabase: ${name} (${id})`);
        }
        break;
      }

      case 'user.updated': {
        // Get role and locations from public_metadata
        const role = public_metadata?.role || 'NO_ROLE';
        const locations = public_metadata?.locations || [];
        
        // Determine name
        const name = username || 
                     (first_name && last_name ? `${first_name} ${last_name}` : first_name || last_name) ||
                     'User';

        // Update user in Supabase
        const { error } = await supabaseAdmin
          .from('users')
          .update({
            name: name,
            role: role,
            locations: locations
          })
          .eq('clerk_id', id);

        if (error) {
          console.error('Error updating user in Supabase:', error);
        } else {
          console.log(`✅ User updated in Supabase: ${name} (${id})`);
        }
        break;
      }

      case 'user.deleted': {
        // Delete user from Supabase
        const { error } = await supabaseAdmin
          .from('users')
          .delete()
          .eq('clerk_id', id);

        if (error) {
          console.error('Error deleting user from Supabase:', error);
        } else {
          console.log(`✅ User deleted from Supabase: ${id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Return 200 to acknowledge receipt
    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/api/webhooks/clerk`);
});
