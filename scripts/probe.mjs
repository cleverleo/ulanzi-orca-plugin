import { OrcaClient } from '../plugin/plugin/orca-client.js';
import { publicProject } from '../plugin/plugin/project-state.js';
const client = new OrcaClient({ environment: process.env.ORCA_PLUGIN_ENVIRONMENT || '' });
const data = await client.projects();
console.log(JSON.stringify({ projects: data.worktrees.map(publicProject), hostScope: data.hostScope }, null, 2));
