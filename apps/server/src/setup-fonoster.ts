import SDK from '@fonoster/sdk';

async function main() {
  console.log('Connecting to Fonoster API Server...');
  const endpoint = process.env.FONOSTER_API_ENDPOINT || 'apiserver:50051';

  // The default admin user's accessKeyId from the apiserver seed
  const defaultAccessKeyId = 'US00000000000000000000000000000000';

  const client = new SDK.Client({
    accessKeyId: defaultAccessKeyId,
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
  console.log('Login successful!');

  // 1. Get or create Workspace "voxPilot"
  console.log('Checking workspaces...');
  const workspacesClient = new SDK.Workspaces(client);
  const list = await workspacesClient.listWorkspaces() as any;

  // Debug: print the raw response shape so we know the field names
  console.log('Workspaces response keys:', Object.keys(list));

  // The SDK may return items as "items", "itemsList", or "workspaces"
  const workspacesList = list.items || list.itemsList || list.workspaces || [];
  console.log(`Found ${workspacesList.length} existing workspace(s)`);

  let workspace = workspacesList.find((w: any) => w.name === 'voxPilot');

  if (!workspace) {
    console.log('Creating workspace "voxPilot"...');
    const result = await workspacesClient.createWorkspace({ name: 'voxPilot' });
    console.log('Workspace created, ref:', result.ref);
    workspace = await workspacesClient.getWorkspace(result.ref);
  }

  console.log('Workspace details:', JSON.stringify(workspace, null, 2));

  // Use the workspace's accessKeyId (WO...), NOT the ref (UUID)
  const wsAccessKeyId = workspace.accessKeyId;
  console.log(`Workspace accessKeyId: ${wsAccessKeyId}`);

  if (!wsAccessKeyId) {
    console.error('ERROR: Workspace does not have an accessKeyId!');
    console.error('Raw workspace object:', workspace);
    process.exit(1);
  }

  // 2. Re-authenticate scoped to the workspace
  console.log('Scoping session to Workspace...');
  client.setAccessKeyId(wsAccessKeyId);
  await client.login('admin@fonoster.local', 'changeme');
  console.log('Session scoped to workspace successfully!');

  // 3. Generate API Key
  console.log('Generating API Key for Workspace...');
  const apiKeysClient = new SDK.ApiKeys(client);
  const keyResult = await apiKeysClient.createApiKey({ role: 'WORKSPACE_ADMIN' as any });
  console.log('API Key created successfully!');

  // 4. Create Voice Application
  console.log('Creating Voice Application...');
  const appsClient = new SDK.Applications(client);

  const appList = await appsClient.listApplications({ pageSize: 50 }) as any;
  const appsList = appList.items || appList.itemsList || appList.applications || [];
  let app = appsList.find((a: any) => a.name === 'voxPilot');

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
  console.log(`FONOSTER_ACCESS_KEY_ID=${wsAccessKeyId}`);
  console.log(`FONOSTER_API_KEY=${keyResult.accessKeyId}`);
  console.log(`FONOSTER_API_SECRET=${keyResult.accessKeySecret}`);
  console.log(`FONOSTER_APP_REF=${app.ref}`);
  console.log('\n======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during setup:', err);
});
