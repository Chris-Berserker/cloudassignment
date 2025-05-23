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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { fileName, fileData, patientId, fileType } = JSON.parse(event.body);
    
    // Validate inputs
    if (!fileName || !fileData || !patientId) {
      throw new Error('Missing required fields: fileName, fileData, or patientId');
    }
    
    // Decode base64 file data
    const buffer = Buffer.from(fileData, 'base64');
    
    // Generate unique file path with timestamp
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `patient-documents/${patientId}/${timestamp}-${sanitizedFileName}`;
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false
      });
    
    if (error) throw error;
    
    // Get public URL (if bucket is public) or create a signed URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    // Optional: Store document metadata in database
    const { error: dbError } = await supabase
      .from('document_metadata')
      .insert({
        patient_id: patientId,
        file_name: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: buffer.length,
        uploaded_at: new Date().toISOString()
      });
    
    // Note: document_metadata table doesn't exist in our schema yet
    // This is just showing how you could track uploads
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          path: data.path,
          url: urlData?.signedUrl,
          fileName: fileName,
          size: buffer.length
        }
      })
    };
    
  } catch (error) {
    console.error('Upload error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false,
        error: error.message 
      })
    };
  }
};