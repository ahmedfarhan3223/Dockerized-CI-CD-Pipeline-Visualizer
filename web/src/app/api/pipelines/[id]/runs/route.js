import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    const runs = await sql`
      SELECT pr.*, 
             COUNT(ps.id) as total_stages,
             COUNT(CASE WHEN ps.status = 'success' THEN 1 END) as completed_stages,
             COUNT(CASE WHEN ps.status = 'failed' THEN 1 END) as failed_stages
      FROM pipeline_runs pr
      LEFT JOIN pipeline_stages ps ON pr.id = ps.run_id
      WHERE pr.pipeline_id = ${id}
      GROUP BY pr.id
      ORDER BY pr.run_number DESC
      LIMIT 10
    `;
    
    return Response.json({ runs });
  } catch (error) {
    console.error('Error fetching pipeline runs:', error);
    return Response.json({ error: 'Failed to fetch pipeline runs' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { triggered_by } = await request.json();
    
    // Get the next run number
    const [lastRun] = await sql`
      SELECT COALESCE(MAX(run_number), 0) as last_run_number
      FROM pipeline_runs
      WHERE pipeline_id = ${id}
    `;
    
    const nextRunNumber = (lastRun?.last_run_number || 0) + 1;
    
    // Create new pipeline run
    const [newRun] = await sql`
      INSERT INTO pipeline_runs (pipeline_id, run_number, status, triggered_by)
      VALUES (${id}, ${nextRunNumber}, 'running', ${triggered_by || 'manual'})
      RETURNING *
    `;
    
    // Create stages for this run
    const stages = ['build', 'test', 'deploy', 'monitor'];
    for (let i = 0; i < stages.length; i++) {
      await sql`
        INSERT INTO pipeline_stages (run_id, stage_name, stage_order, status)
        VALUES (${newRun.id}, ${stages[i]}, ${i + 1}, ${i === 0 ? 'running' : 'pending'})
      `;
    }
    
    // Update pipeline status
    await sql`
      UPDATE pipelines 
      SET status = 'running', updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
    `;
    
    return Response.json({ run: newRun });
  } catch (error) {
    console.error('Error creating pipeline run:', error);
    return Response.json({ error: 'Failed to create pipeline run' }, { status: 500 });
  }
}