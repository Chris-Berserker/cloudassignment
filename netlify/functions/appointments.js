import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  const { httpMethod, body, queryStringParameters } = event;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let result;
    
    switch (httpMethod) {
      case 'GET':
        // Get appointments with patient details
        const { data, error } = await supabase
          .from('appointment')
          .select(`
            *,
            patient:patient_id (
              full_name,
              email,
              phone
            )
          `)
          .order('appointment_date', { ascending: true });
        
        if (error) throw error;
        result = data;
        break;
        
      case 'POST':
        const newAppointment = JSON.parse(body);
        
        // Check for scheduling conflicts
        const { data: conflicts } = await supabase
          .from('appointment')
          .select('id')
          .eq('doctor_id', newAppointment.doctor_id)
          .gte('appointment_date', newAppointment.appointment_date)
          .lt('appointment_date', new Date(new Date(newAppointment.appointment_date).getTime() + 30 * 60000).toISOString());
        
        if (conflicts?.length > 0) {
          throw new Error('Time slot already booked');
        }
        
        const { data: created, error: createError } = await supabase
          .from('appointment')
          .insert(newAppointment)
          .select()
          .single();
        
        if (createError) throw createError;
        result = created;
        break;
        
      case 'PUT':
        const { id, ...updates } = JSON.parse(body);
        const { data: updated, error: updateError } = await supabase
          .from('appointment')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        
        if (updateError) throw updateError;
        result = updated;
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