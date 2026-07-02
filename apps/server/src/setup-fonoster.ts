import SDK from '@fonoster/sdk';

async function main() {
  console.log('Connecting to Fonoster API Server...');
  // Connect internally inside the Docker network
  const endpoint = process.env.FONOSTER_API_ENDPOINT || 'apiserver:50051';
  
  const client = new SDK.Client({
    accessKeyId: '',
    endpoint,
    allowInsecure: true
  });

  console.log('Logging in as admin@fonoster.local...');
  try {
    await client.login('admin@fonoster.local', 'changeme');
  } catch (err: any) {
    console.error('Login failed:', err.message);
    process.exit(1);
  }

  // 1. Get or create Workspace "voxPilot"
  console.log('Checking workspaces...');
  const workspacesClient = new SDK.Workspaces(client);
  const list = await workspacesClient.listWorkspaces() as any;
  let workspace = list.workspaces?.find((w: any) => w.name === 'voxPilot');

  if (!workspace) {
    console.log('Creating workspace "voxPilot"...');
    const result = await workspacesClient.createWorkspace({ name: 'voxPilot' });
    workspace = await workspacesClient.getWorkspace(result.ref);
  }

  const workspaceRef = workspace.ref;
  console.log(`Using Workspace: ${workspace.name} (${workspaceRef})`);

  // 2. Set Access Key ID to Workspace Ref
  client.setAccessKeyId(workspaceRef);

  // Re-authenticate to scope the session token to the workspace
  console.log('Scoping session to Workspace...');
  await client.login('admin@fonoster.local', 'changeme');

  // 3. Generate API Key
  console.log('Generating API Key for Workspace...');
  const apiKeysClient = new SDK.ApiKeys(client);
  const keyResult = await apiKeysClient.createApiKey({ role: 'WORKSPACE_ADMIN' as any });

  // 4. Create Voice Application
  console.log('Creating Voice Application...');
  const appsClient = new SDK.Applications(client);
  
  // List first to check if it already exists
  const appList = await appsClient.listApplications({ pageSize: 50 }) as any;
  let app = appList.applications?.find((a: any) => a.name === 'voxPilot');

  if (!app) {
    const appResult = await appsClient.createApplication({
      name: 'voxPilot',
      type: 'EXTERNAL' as any,
      endpoint: 'http://server:3002'
    });
    app = await appsClient.getApplication(appResult.ref);
  }

  console.log('\n======================================================');
  console.log('🎉 FONOSTER CONFIGURATION COMPLETED SUCCESSFULLY!');
  console.log('======================================================\n');
  console.log('Copy and paste these values into your VPS `.env` file:\n');
  console.log(`FONOSTER_ACCESS_KEY_ID=${workspaceRef}`);
  console.log(`FONOSTER_API_KEY=${keyResult.accessKeyId}`);
  console.log(`FONOSTER_API_SECRET=${keyResult.accessKeySecret}`);
  console.log(`FONOSTER_APP_REF=${app.ref}`);
  console.log('\n======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during setup:', err);
});
