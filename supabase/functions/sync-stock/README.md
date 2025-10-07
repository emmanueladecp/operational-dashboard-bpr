# Sync Stock Edge Function

This Supabase Edge Function synchronizes stock data from an external iDempiere API to the local stock table.

## Overview

The function fetches stock data from `https://ibpr.berasraja.com/api/v1/models/mvw_dashboard_storage_per_product_onlyrm` and transforms it according to the specified field mapping, then upserts the data into the Supabase `stock` table.

## Field Mapping

The function maps the following fields from the external API:

| External API Field | Local Field | Description |
|-------------------|-------------|-------------|
| `AD_Org_ID.id` | `m_location_id` | Location ID (foreign key to master_locations) |
| `AD_Org_ID.identifier` | `location` | Location name |
| `id` | `m_product_id` | Product ID |
| `Name` | `name` | Product name |
| `C_UOM_ID.id` | `c_uom_id` | Unit of measure ID |
| `C_UOM_ID.identifier` | `uom_name` | Unit of measure name |
| `M_Product_Category_ID.id` | `m_product_category_id` | Product category ID |
| `M_Product_Category_ID.identifier` | `product_category_name` | Product category name |
| `Weight` | `weight` | Weight per unit |
| `SumQtyOnHand` | `sumqtyonhand` | Current stock quantity |
| `product_type` | `product_type` | Type of product |

## Location Mapping

The function includes a mapping for location identifiers to location names:

```typescript
const locationMapping: { [key: string]: string } = {
  'BPR 1 Belitang_BPR1': 'BPR 1 Belitang',
  'BPR 2 Kramasan_BPR2': 'BPR 2 Kramasan',
  'BPR 3 Karawang_BPR3': 'BPR 3 Karawang',
  'Depo Cepu_BPR5': 'Depo Cepu',
  'Depo Makassar_BPR6': 'Depo Makassar',
}
```

## Environment Variables Required

The function requires the following environment variables to be set in your Supabase project:

- `IDEMPIERE_API_KEY`: Bearer token for authenticating with the external API
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database operations

## Setup Instructions

### 1. Deploy the Function

```bash
supabase functions deploy sync-stock
```

### 2. Set Environment Variables

In your Supabase dashboard:
1. Go to **Settings** > **Edge Functions**
2. Add the required environment variables:
   - `IDEMPIERE_API_KEY`: Your iDempiere API key
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

### 3. Test the Function

You can test the function by making a POST request to your function URL:

```bash
curl -X POST 'https://your-project.supabase.co/functions/v1/sync-stock' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

Or use the test script provided:

```bash
node test-sync-stock.js
```

## API Response

### Success Response (200)

```json
{
  "success": true,
  "message": "Successfully synchronized 25 stock records",
  "records_processed": 25,
  "records_inserted": 25
}
```

### Error Response (500)

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "timestamp": "2025-10-06T09:30:41.875Z"
}
```

## Error Handling

The function includes comprehensive error handling for:

- Missing environment variables
- External API failures
- Invalid response formats
- Location mapping issues
- Database operation failures

All errors are logged and returned in a structured format.

## Database Operations

The function performs a **delete-then-insert** operation on the `stock` table for `RAW MATERIAL` products:

1. **Delete Phase**: Removes all existing stock records where `product_type = 'RAW MATERIAL'`
2. **Insert Phase**: Inserts all new stock records from the external API

This ensures a complete refresh of stock data rather than incremental updates, preventing accumulation of stale data.

**Why this approach:**
- ✅ Guarantees data freshness (no outdated records)
- ✅ Handles product discontinuation automatically
- ✅ Simpler than complex upsert logic
- ✅ Clear audit trail of synchronization events

## Logging

The function logs the following information:

- Start of synchronization process
- Number of records fetched from external API
- Processing details for each record (external ID, identifier)
- Location verification results
- Deletion of existing RAW MATERIAL stock records
- Number of records successfully inserted
- Any warnings (e.g., locations not found)
- Errors with detailed messages

## Security Considerations

- The function uses the service role key for database operations to bypass RLS policies
- The external API key is stored securely as an environment variable
- CORS headers are included for web application access
- Input validation is performed on all external data

## Troubleshooting

### Common Issues

1. **"IDEMPIERE_API_KEY environment variable is not set"**
   - Ensure the environment variable is set in Supabase dashboard

2. **"External API request failed"**
   - Check that the API key is valid and has proper permissions
   - Verify the external API endpoint is accessible

3. **"Location not found" warnings**
   - Ensure location names in the mapping match entries in `master_locations` table
   - Check that locations are marked as `is_active = true`

4. **"No valid stock records to insert"**
   - Verify the external API is returning data
   - Check that the response format matches expectations

### Monitoring

Check the function logs in your Supabase dashboard under **Edge Functions** > **sync-stock** > **Logs** to monitor execution and troubleshoot issues.

## Integration

This function can be integrated into your application by:

1. Calling it from a frontend application
2. Setting up a cron job for regular synchronization
3. Triggering it from other edge functions or database triggers

Example frontend integration:

```javascript
const syncStock = async () => {
  const response = await fetch('/functions/v1/sync-stock', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
  })

  const result = await response.json()
  return result
}