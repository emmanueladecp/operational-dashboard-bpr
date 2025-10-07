import { createClient } from 'npm:@supabase/supabase-js@2';
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
    // Get the API key from environment variables
    const IDEMPIERE_API_KEY = Deno.env.get('IDEMPIERE_API_KEY');
    if (!IDEMPIERE_API_KEY) {
      throw new Error('IDEMPIERE_API_KEY environment variable is not set');
    }
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('Starting stock synchronization...');
    // Fetch data from external API
    const externalApiUrl = 'https://ibpr.berasraja.com/api/v1/models/mvw_dashboard_storage_per_product_onlyrm';
    const response = await fetch(externalApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${IDEMPIERE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      throw new Error(`External API request failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('Invalid response format: expected records array');
    }
    console.log(`Fetched ${data.records.length} records from external API`);
    // Transform and prepare stock records
    const stockRecords = [];
    for (const record of data.records){
      // Use the external location ID directly (AD_Org_ID.id should match master_locations.id)
      const externalLocationId = record.AD_Org_ID.id;
      const locationIdentifier = record.AD_Org_ID.identifier;
      console.log(`Processing record: external ID=${externalLocationId}, identifier=${locationIdentifier}`);
      // Verify the location ID exists in master_locations
      const { data: locationData, error: locationError } = await supabase.from('master_locations').select('id, name').eq('id', externalLocationId).eq('is_active', true).single();
      if (locationError || !locationData) {
        console.warn(`Location ID not found in master_locations: ${externalLocationId} (${locationIdentifier})`);
        continue;
      }
      console.log(`Location verified: ID=${locationData.id}, name=${locationData.name}`);
      // Transform the record according to field mapping
      const stockRecord = {
        m_location_id: locationData.id,
        location: locationData.name,
        m_product_id: record.id.toString(),
        name: record.Name,
        c_uom_id: record.C_UOM_ID.id,
        uom_name: record.C_UOM_ID.identifier,
        m_product_category_id: record.M_Product_Category_ID.id,
        product_category_name: record.M_Product_Category_ID.identifier,
        weight: record.Weight || 0,
        sumqtyonhand: record.SumQtyOnHand || 0,
        product_type: record.product_type || 'RAW MATERIAL'
      };
      stockRecords.push(stockRecord);
    }
    console.log(`Processed ${stockRecords.length} valid stock records`);
    if (stockRecords.length === 0) {
      throw new Error('No valid stock records to insert');
    }
    // Delete existing stock records for both RAW MATERIAL and FINISHED_GOODS before inserting new data
    console.log('Deleting existing stock records...');
    const { error: deleteError } = await supabase
      .from('stock')
      .delete()
      .in('product_type', ['RAW MATERIAL', 'FINISHED_GOODS']);
    if (deleteError) {
      throw new Error(`Failed to delete existing stock records: ${deleteError.message}`);
    }
    console.log('Successfully deleted existing stock records');
    // Insert new stock records (since we deleted existing ones, no conflicts expected)
    const { data: insertData, error: insertError } = await supabase
      .from('stock')
      .insert(stockRecords)
      .select();
    if (insertError) {
      throw new Error(`Failed to insert stock records: ${insertError.message}`);
    }
    console.log(`Successfully synchronized ${insertData?.length || 0} stock records`);
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synchronized ${stockRecords.length} stock records`,
      records_processed: stockRecords.length,
      records_inserted: insertData?.length || 0
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error synchronizing stock:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
