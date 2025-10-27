import sql from "@/app/api/utils/sql";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query = `
      SELECT p.*, 
             pr.id as current_run_id,
             pr.run_number,
             pr.status as run_status,
             pr.started_at as run_started_at,
             pr.triggered_by
      FROM pipelines p
      LEFT JOIN pipeline_runs pr ON p.id = pr.pipeline_id 
      AND pr.id = (
        SELECT id FROM pipeline_runs 
        WHERE pipeline_id = p.id 
        ORDER BY run_number DESC 
        LIMIT 1
      )
    `;
    
    const params = [];
    if (status) {
      query += ` WHERE p.status = $1`;
      params.push(status);
    }
    
    query += ` ORDER BY p.updated_at DESC`;
    
    const pipelines = await sql(query, params);
    
    return Response.json({ pipelines });
  } catch (error) {
    console.error('Error fetching pipelines:', error);
    return Response.json({ error: 'Failed to fetch pipelines' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, repository, branch = 'main' } = await request.json();
    
    if (!name || !repository) {
      return Response.json({ error: 'Name and repository are required' }, { status: 400 });
    }
    
    const [pipeline] = await sql`
      INSERT INTO pipelines (name, repository, branch)
      VALUES (${name}, ${repository}, ${branch})
      RETURNING *
    `;
    
    return Response.json({ pipeline });
  } catch (error) {
    console.error('Error creating pipeline:', error);
    return Response.json({ error: 'Failed to create pipeline' }, { status: 500 });
  }
}