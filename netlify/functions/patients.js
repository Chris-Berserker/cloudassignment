import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  const { httpMethod, path, body, queryStringParameters } = event;
  
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let result;
    
    switch (httpMethod) {
      case 'GET':
        if (queryStringParameters?.id) {
          // Get single patient
          const { data, error } = await supabase
            .from('patient')
            .select('*')
            .eq('id', queryStringParameters.id)
            .single();
          
          if (error) throw error;
          result = data;
        } else {
          // Get all patients with pagination
          const page = parseInt(queryStringParameters?.page || '1');
          const limit = parseInt(queryStringParameters?.limit || '10');
          const offset = (page - 1) * limit;
          
          const { data, error, count } = await supabase
            .from('patient')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
          
          if (error) throw error;
          result = { data, total: count, page, limit };
        }
        break;
        
      case 'POST':
        const newPatient = JSON.parse(body);
        const { data: created, error: createError } = await supabase
          .from('patient')
          .insert(newPatient)
          .select()
          .single();
        
        if (createError) throw createError;
        result = created;
        break;
        
      case 'PUT':
        const { id, ...updates } = JSON.parse(body);
        const { data: updated, error: updateError } = await supabase
          .from('patient')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        result = updated;
        break;
        
      case 'DELETE':
        const deleteId = queryStringParameters?.id;
        if (!deleteId) throw new Error('ID required for deletion');
        
        const { error: deleteError } = await supabase
          .from('patient')
          .delete()
          .eq('id', deleteId);
        
        if (deleteError) throw deleteError;
        result = { message: 'Patient deleted successfully' };
        break;
        
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};