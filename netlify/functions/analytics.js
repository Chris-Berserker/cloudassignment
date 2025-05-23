import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get analytics data
    const [patientsResult, appointmentsResult, diagnosisResult] = await Promise.all([
      supabase.from('patient').select('*', { count: 'exact', head: true }),
      supabase.from('appointment').select('status', { count: 'exact' }),
      supabase.from('diagnosis').select('severity', { count: 'exact' })
    ]);

    // Calculate appointment statistics
    const appointmentStats = appointmentsResult.data?.reduce((acc, apt) => {
      acc[apt.status] = (acc[apt.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Calculate diagnosis severity distribution
    const severityStats = diagnosisResult.data?.reduce((acc, diag) => {
      acc[diag.severity] = (acc[diag.severity] || 0) + 1;
      return acc;
    }, {}) || {};

    const analytics = {
      totalPatients: patientsResult.count || 0,
      totalAppointments: appointmentsResult.data?.length || 0,
      appointmentsByStatus: appointmentStats,
      totalDiagnoses: diagnosisResult.data?.length || 0,
      diagnosisBySeverity: severityStats,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analytics)
    };
    
  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};