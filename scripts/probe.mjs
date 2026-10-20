import { OrcaFleet } from '../plugin/plugin/orca-fleet.js';
import { publicProject } from '../plugin/plugin/project-state.js';
const client = new OrcaFleet();
const data = await client.projects();
console.log(JSON.stringify({ projects: data.worktrees.map(publicProject), warnings: data.warnings, environmentCount: data.environmentCount }, null, 2));
