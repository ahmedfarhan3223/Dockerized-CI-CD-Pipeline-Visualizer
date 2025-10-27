import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const stages = await sql`
      SELECT * FROM pipeline_stages
      WHERE run_id = ${id}
      ORDER BY stage_order ASC
    `;
    
    return Response.json({ stages });
  } catch (error) {
    console.error('Error fetching pipeline stages:', error);
    return Response.json({ error: 'Failed to fetch pipeline stages' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { stage_name, status, logs, error_message } = await request.json();
    
    if (!stage_name || !status) {
      return Response.json({ error: 'Stage name and status are required' }, { status: 400 });
    }
    
    const updateData = { status };
    const updateFields = ['status = $2'];
    const updateParams = [stage_name, status];
    let paramCount = 2;
    
    if (status === 'running' && !updateData.started_at) {
      updateFields.push(`started_at = CURRENT_TIMESTAMP`);
    }
    
    if (status === 'success' || status === 'failed') {
      updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
      updateFields.push(`duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))`);
    }
    
    if (logs) {
      paramCount++;
      updateFields.push(`logs = $${paramCount}`);
      updateParams.push(logs);
    }
    
    if (error_message) {
      paramCount++;
      updateFields.push(`error_message = $${paramCount}`);
      updateParams.push(error_message);
    }
    
    const query = `
      UPDATE pipeline_stages 
      SET ${updateFields.join(', ')}
      WHERE run_id = $1 AND stage_name = $2
      RETURNING *
    `;
    
    updateParams[0] = id; // run_id should be first parameter
    
    const [updatedStage] = await sql(query, updateParams);
    
    if (!updatedStage) {
      return Response.json({ error: 'Stage not found' }, { status: 404 });
    }
    
    // Check if this was the last stage and update run status
    if (status === 'success' || status === 'failed') {
      const [runStatus] = await sql`
        SELECT 
          COUNT(*) as total_stages,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as completed_stages,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_stages
        FROM pipeline_stages
        WHERE run_id = ${id}
      `;
      
      let newRunStatus = 'running';
      if (runStatus.failed_stages > 0) {
        newRunStatus = 'failed';
      } else if (runStatus.completed_stages === runStatus.total_stages) {
        newRunStatus = 'success';
      }
      
      if (newRunStatus !== 'running') {
        await sql`
          UPDATE pipeline_runs 
          SET status = ${newRunStatus}, completed_at = CURRENT_TIMESTAMP,
              duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - started_at))
          WHERE id = ${id}
        `;
        
        // Update pipeline status
        const [pipelineId] = await sql`
          SELECT pipeline_id FROM pipeline_runs WHERE id = ${id}
        `;
        
        await sql`
          UPDATE pipelines 
          SET status = ${newRunStatus}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ${pipelineId.pipeline_id}
        `;
      }
    }
    
    return Response.json({ stage: updatedStage });
  } catch (error) {
    console.error('Error updating pipeline stage:', error);
    return Response.json({ error: 'Failed to update pipeline stage' }, { status: 500 });
  }
}