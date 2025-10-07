// Test script for sync-stock edge function
// This script tests the deployed function directly

const testSyncStock = async () => {
  try {
    // You'll need to get these values from your Supabase project
    const supabaseUrl = 'https://idniillfrvnppeerzxol.supabase.co'
    const functionUrl = `${supabaseUrl}/functions/v1/sync-stock`

    // Get your anon key from Supabase dashboard
    const anonKey = 'your-anon-key-here'

    console.log('Testing sync-stock function...')
    console.log('Function URL:', functionUrl)

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
    })

    const result = await response.text()
    console.log('Response status:', response.status)
    console.log('Response body:', result)

    if (response.ok) {
      console.log('✅ Function executed successfully!')
    } else {
      console.log('❌ Function failed with status:', response.status)
    }

  } catch (error) {
    console.error('❌ Error testing function:', error.message)
  }
}

// Run the test
testSyncStock()