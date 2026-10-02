import { randomUUID } from 'node:crypto';

export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: string;
  value: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface SettingsState {
  automatic: boolean;
  busy: boolean;
  connected: boolean;
  credentialsConfigured: boolean;
  credentialsPath: string;
  projectId: string;
  encrypted: boolean;
  error?: string;
  intervalMinutes: number;
  lastLocal?: string;
  lastRemote?: string;
  nextRun?: number;
  passphraseConfigured: boolean;
  pendingUploads: number;
  privateKeys?: boolean;
  supportsPrivateKeys: boolean;
  uploadToDrive: boolean;
  directory: string;
  dataDirectory: string;
  settings: SettingDefinition[];
  exclusions: string[];
  coverage: string;
}

const escape = (value: string): string => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function settingsHtml(name: string, version: string, es: boolean): string {
  const nonce = randomUUID().replaceAll('-', '');
  const labels = es ? {
    title: 'Configuración', general: 'General', transfer: 'Importar / exportar', drive: 'Google Drive',
    subtitle: 'Ajustes, archivos portables y recuperación de tus datos.', saved: 'Los cambios se guardan automáticamente en este dispositivo.',
    export: 'Exportar a un archivo…', import: 'Importar archivo…', remoteImport: 'Importar desde Drive…',
    transferHelp: 'Exporta un archivo .devbackup a la ubicación que elijas. Al importar se valida la copia, se conservan los datos anteriores y se recarga VS Code.',
    included: 'Alcance de la copia', excluded: 'Exclusiones', automatic: 'Backups automáticos', autoHelp: 'Crean una copia cuando cambian los datos, mientras VS Code está abierto.',
    interval: 'Intervalo (minutos)', directory: 'Carpeta de backups', choose: 'Elegir carpeta…', reset: 'Usar carpeta predeterminada',
    backup: 'Crear backup ahora', upload: 'Subir backups a Drive', uploadHelp: 'Sólo sube las copias creadas por “Crear backup” y los backups automáticos. Exportar a un archivo siempre es local.',
    encryption: 'Cifrar las copias', encryptionHelp: 'Conserva la contraseña fuera de esta computadora. Cambiarla sólo afecta a las copias nuevas.',
    passphrase: 'Configurar contraseña…', configured: 'Contraseña guardada', missing: 'Falta configurar contraseña',
    privateKeys: 'Incluir llaves SSH privadas', privateHelp: 'Requiere cifrado y contraseña.',
    connect: 'Conectar cuenta…', reconnect: 'Reconectar cuenta…', disconnect: 'Desconectar', connected: 'Cuenta conectada', disconnected: 'Cuenta sin conectar',
    credentials: 'Importar credencial OAuth…', credentialsReady: 'Credencial de escritorio guardada', credentialsMissing: 'Falta la credencial OAuth de escritorio',
    test: 'Comprobar conexión', guide: 'Crear credencial en Google Cloud', project: 'Proyecto de Google Cloud', projectHelp: 'Opcional. Los enlaces del asistente abren este proyecto.',
    steps: ['Crea o selecciona un proyecto en Google Cloud.', 'Habilita Google Drive API.', 'Configura Google Auth Platform; si está en pruebas, añade tu cuenta en Usuarios de prueba.', 'Crea un cliente OAuth de tipo Aplicación de escritorio y descarga su JSON.', 'Importa ese JSON aquí y conecta tu cuenta. El token se obtiene y renueva automáticamente.'],
    oauthHelp: 'Puedes reutilizar el mismo JSON en todas las extensiones. Cada una autoriza su cuenta por separado. No necesitas instalar gcloud ni copiar tokens.',
    testing: 'Si tu aplicación externa sigue en modo Pruebas, Google caduca el refresh token de Drive a los 7 días. Revisa el estado de publicación en Google Auth Platform para uso habitual.',
    localHelp: 'El callback de inicio de sesión requiere una ventana local de VS Code.',
    cloud: 'Abrir Google Cloud', api: 'Habilitar Drive API', auth: 'Abrir Google Auth Platform',
    lastLocal: 'Último backup local', lastRemote: 'Última subida a Drive', nextRun: 'Próxima revisión', pending: 'Subidas pendientes',
    none: 'Sin copias todavía', folder: 'Abrir carpeta', log: 'Ver registro', vscode: 'Más ajustes en VS Code', data: 'Datos activos', error: 'Error', busy: 'Operación en curso…', ready: 'Listo', noSettings: 'No hay más ajustes generales.',
    waiting: 'Esperando configuración…'
  } : {
    title: 'Settings', general: 'General', transfer: 'Import / export', drive: 'Google Drive',
    subtitle: 'Preferences, portable files, and data recovery.', saved: 'Changes are saved automatically on this device.',
    export: 'Export to a file…', import: 'Import file…', remoteImport: 'Import from Drive…',
    transferHelp: 'Export a .devbackup file to a location you choose. Import validates the snapshot, preserves previous data, and reloads VS Code.',
    included: 'Snapshot coverage', excluded: 'Exclusions', automatic: 'Automatic backups', autoHelp: 'Create a snapshot when data changes, while VS Code is open.',
    interval: 'Interval (minutes)', directory: 'Backup folder', choose: 'Choose folder…', reset: 'Use default folder',
    backup: 'Create backup now', upload: 'Upload backups to Drive', uploadHelp: 'Uploads manual and automatic backups. Export to a file always stays local.',
    encryption: 'Encrypt snapshots', encryptionHelp: 'Keep the passphrase outside this computer. Changing it only affects new snapshots.',
    passphrase: 'Set passphrase…', configured: 'Passphrase saved', missing: 'Set a passphrase first',
    privateKeys: 'Include private SSH keys', privateHelp: 'Requires encryption and a passphrase.',
    connect: 'Connect account…', reconnect: 'Reconnect account…', disconnect: 'Disconnect', connected: 'Account connected', disconnected: 'Account disconnected',
    credentials: 'Import OAuth credentials…', credentialsReady: 'Desktop credentials saved', credentialsMissing: 'Desktop OAuth credentials needed',
    test: 'Check connection', guide: 'Create Google Cloud credentials', project: 'Google Cloud project', projectHelp: 'Optional. Setup links open this project.',
    steps: ['Create or select a Google Cloud project.', 'Enable Google Drive API.', 'Configure Google Auth Platform; add your account as a test user when testing.', 'Create an OAuth client of type Desktop app and download its JSON.', 'Import the JSON here and connect your account. Tokens are acquired and refreshed automatically.'],
    oauthHelp: 'Reuse the same JSON across extensions. Each extension authorizes its own connection. No gcloud installation or pasted tokens required.',
    testing: 'An external app in Testing has Drive refresh tokens that expire after 7 days. Review the publishing status in Google Auth Platform for routine use.',
    localHelp: 'Sign-in requires a local VS Code window for the callback.',
    cloud: 'Open Google Cloud', api: 'Enable Drive API', auth: 'Open Google Auth Platform',
    lastLocal: 'Latest local backup', lastRemote: 'Latest Drive upload', nextRun: 'Next check', pending: 'Pending uploads',
    none: 'No snapshots yet', folder: 'Open folder', log: 'Show log', vscode: 'More settings in VS Code', data: 'Active data', error: 'Error', busy: 'Operation in progress…', ready: 'Ready', noSettings: 'No additional general settings.',
    waiting: 'Loading settings…'
  };
  const json = JSON.stringify(labels).replaceAll('<', '\\u003c');
  return `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"><title>${escape(name)} · ${labels.title}</title><style nonce="${nonce}">
  :root{color-scheme:light dark}*{box-sizing:border-box}body{margin:0;color:var(--vscode-foreground);background:var(--vscode-editor-background);font:13px/1.6 var(--vscode-font-family)}main{max-width:1000px;margin:auto;padding:32px}header{margin-bottom:24px}.eyebrow,.muted,small{color:var(--vscode-descriptionForeground)}h1{font-size:28px;line-height:1.2;margin:5px 0 8px}h2{font-size:17px;margin:0 0 12px}p{margin:6px 0 14px}nav{display:flex;gap:8px;border-bottom:1px solid var(--vscode-widget-border);margin-bottom:24px;padding-bottom:12px;flex-wrap:wrap}.tab{background:transparent;color:var(--vscode-foreground)}.tab[aria-selected=true]{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.card{border:1px solid var(--vscode-widget-border);border-radius:10px;padding:20px;background:var(--vscode-sideBar-background);margin-bottom:16px}.grid .card{margin:0}.grid+.card{margin-top:16px}.row{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:14px 0}.actions{display:flex;flex-wrap:wrap;gap:8px}.stack{display:grid;gap:8px}button,input,select,textarea{font:inherit}button{border:1px solid var(--vscode-button-border,transparent);border-radius:5px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);padding:8px 12px;cursor:pointer}button:hover{background:var(--vscode-button-hoverBackground)}button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:2px}button:disabled,input:disabled,select:disabled,textarea:disabled{opacity:.55;cursor:not-allowed}input:not([type=checkbox]),select,textarea{max-width:100%;padding:7px 9px;border:1px solid var(--vscode-input-border);background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:4px}input[type=number]{width:100px}input[type=checkbox]{width:18px;height:18px;accent-color:var(--vscode-focusBorder)}textarea{min-height:85px;width:100%}code,.path{overflow-wrap:anywhere;font-size:12px}.field{display:grid;gap:6px;padding:16px 0;border-bottom:1px solid var(--vscode-widget-border)}.field small{white-space:pre-wrap}.facts{display:grid;gap:8px}.fact{display:grid;grid-template-columns:180px 1fr;gap:12px;overflow-wrap:anywhere}.badge{display:inline-block;padding:3px 9px;border-radius:12px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)}.error{border-left:3px solid var(--vscode-testing-iconFailed);padding:12px;background:var(--vscode-inputValidation-errorBackground);color:var(--vscode-inputValidation-errorForeground);margin:16px 0;overflow-wrap:anywhere}footer{display:flex;justify-content:space-between;gap:12px;margin-top:22px;align-items:center}[hidden]{display:none!important}ol,ul{padding-left:22px}li{margin:8px 0}@media(max-width:600px){main{padding:18px}.grid{grid-template-columns:1fr}.fact{grid-template-columns:1fr;gap:0}.row{flex-wrap:wrap}footer{flex-wrap:wrap}}
  </style></head><body><main><header><span class="eyebrow">${escape(name)} · ${escape(version)}</span><h1>${labels.title}</h1><p class="muted">${labels.subtitle}</p></header>
  <nav role="tablist" aria-label="${labels.title}"><button class="tab" id="tab-general" role="tab" aria-controls="general" aria-selected="true" data-tab="general">${labels.general}</button><button class="tab" id="tab-transfer" role="tab" aria-controls="transfer" aria-selected="false" tabindex="-1" data-tab="transfer">${labels.transfer}</button><button class="tab" id="tab-drive" role="tab" aria-controls="drive" aria-selected="false" tabindex="-1" data-tab="drive">${labels.drive}</button></nav>
  <section id="general" role="tabpanel" aria-labelledby="tab-general"><div class="card"><h2>${labels.general}</h2><p class="muted">${labels.saved}</p><div id="settings">${labels.waiting}</div></div><div class="card"><div class="fact"><strong>${labels.data}</strong><code id="data-directory"></code></div></div></section>
  <section id="transfer" role="tabpanel" aria-labelledby="tab-transfer" hidden><div class="card"><h2>${labels.transfer}</h2><p class="muted">${labels.transferHelp}</p><div class="actions"><button data-action="exportBackup">${labels.export}</button><button class="secondary" data-action="importBackup">${labels.import}</button><button id="remote-import" class="secondary" data-action="importDriveBackup">${labels.remoteImport}</button></div><h3>${labels.included}</h3><p id="coverage"></p><strong>${labels.excluded}</strong><ul id="exclusions"></ul></div>
  <div class="grid"><div class="card"><h2>${labels.automatic}</h2><label class="row"><span>${labels.autoHelp}</span><input id="automatic" type="checkbox" data-setting="backup.autoEnabled"></label><label class="row"><span>${labels.interval}</span><input id="interval" type="number" min="5" max="1440" step="1" data-setting="backup.intervalMinutes"></label></div>
  <div class="card"><h2>${labels.encryption}</h2><label class="row"><span>${labels.encryptionHelp}</span><input id="encrypted" type="checkbox" data-setting="backup.encrypt"></label><div class="row"><small id="passphrase-state"></small><button class="secondary" data-action="setBackupPassphrase">${labels.passphrase}</button></div><label id="private-row" class="row" hidden><span>${labels.privateKeys}<br><small>${labels.privateHelp}</small></span><input id="private-keys" type="checkbox" data-setting="backup.includePrivateKeys"></label></div></div>
  <div class="card"><h2>${labels.directory}</h2><p id="directory" class="path"></p><div class="actions"><button class="secondary" data-action="chooseBackupDirectory">${labels.choose}</button><button class="secondary" data-action="resetBackupDirectory">${labels.reset}</button><button class="secondary" data-action="openBackupFolder">${labels.folder}</button><button data-action="backupNow">${labels.backup}</button></div></div>
  <div class="card facts"><div class="fact"><strong>${labels.lastLocal}</strong><span id="last-local"></span></div><div class="fact"><strong>${labels.lastRemote}</strong><span id="last-remote"></span></div><div class="fact"><strong>${labels.nextRun}</strong><span id="next-run"></span></div><div class="fact"><strong>${labels.pending}</strong><span id="pending"></span></div></div></section>
  <section id="drive" role="tabpanel" aria-labelledby="tab-drive" hidden><div class="card"><h2>${labels.drive}</h2><div class="row"><span id="drive-state" class="badge"></span><span id="credential-state" class="muted"></span></div><p id="credential-path" class="path" hidden></p><div class="actions"><button data-action="configureDriveCredentials">${labels.credentials}</button><button id="connect" data-action="connectDrive">${labels.connect}</button><button id="disconnect" class="secondary" data-action="disconnectDrive">${labels.disconnect}</button><button id="test" class="secondary" data-action="testDriveConnection">${labels.test}</button></div><label class="row"><span>${labels.upload}<br><small>${labels.uploadHelp}</small></span><input id="upload" type="checkbox" data-setting="backup.uploadToDrive"></label><small>${labels.localHelp}</small></div>
  <div class="card"><h2>${labels.guide}</h2><label class="field"><strong>${labels.project}</strong><input id="project" type="text" data-setting="backup.googleProjectId" pattern="[a-z][a-z0-9-]{4,28}[a-z0-9]" placeholder="dev-extensions"><small>${labels.projectHelp}</small></label><ol>${labels.steps.map(step => `<li>${step}</li>`).join('')}</ol><p>${labels.oauthHelp}</p><p class="muted">${labels.testing}</p><div class="actions"><button class="secondary" data-help="cloud">${labels.cloud}</button><button class="secondary" data-help="api">${labels.api}</button><button class="secondary" data-help="auth">${labels.auth}</button></div></div></section>
  <div id="error" class="error" role="alert" hidden><strong>${labels.error}</strong><div id="error-text"></div></div><footer><span id="activity" role="status" class="muted">${labels.waiting}</span><div class="actions"><button class="secondary" data-action="backupStatus">${labels.log}</button><button class="secondary" id="vscode">${labels.vscode}</button></div></footer></main>
  <script nonce="${nonce}">
  const vscode=acquireVsCodeApi(), labels=${json}, byId=id=>document.getElementById(id);
  function selectTab(id){if(!['general','transfer','drive'].includes(id))return;document.querySelectorAll('[data-tab]').forEach(el=>{const selected=el.dataset.tab===id;el.setAttribute('aria-selected',String(selected));el.tabIndex=selected?0:-1;byId(el.dataset.tab).hidden=!selected});vscode.setState({tab:id})}
  document.querySelectorAll('[data-tab]').forEach((el,index)=>{el.addEventListener('click',()=>selectTab(el.dataset.tab));el.addEventListener('keydown',event=>{const tabs=[...document.querySelectorAll('[data-tab]')];let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;if(next!==undefined){event.preventDefault();selectTab(tabs[next].dataset.tab);tabs[next].focus()}})});selectTab(vscode.getState()?.tab||'general');
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',()=>vscode.postMessage({type:'action',action:el.dataset.action})));document.querySelectorAll('[data-help]').forEach(el=>el.addEventListener('click',()=>vscode.postMessage({type:'help',page:el.dataset.help})));byId('vscode').addEventListener('click',()=>vscode.postMessage({type:'openSettings'}));
  document.addEventListener('change',event=>{const el=event.target;if(!el.dataset.setting)return;if(!el.checkValidity()){el.reportValidity();return}const value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.tagName==='SELECT'?JSON.parse(el.value):el.value;vscode.postMessage({type:'update',key:el.dataset.setting,value})});
  function renderSettings(settings){const container=byId('settings');const focused=document.activeElement?.dataset?.setting;container.replaceChildren();if(!settings.length){container.textContent=labels.noSettings;return}for(const item of settings){const label=document.createElement('label');label.className='field';const title=document.createElement('strong');title.textContent=item.label;label.append(title);let input;if(item.enum){input=document.createElement('select');for(const option of item.enum){const el=document.createElement('option');el.value=JSON.stringify(option);el.textContent=String(option);input.append(el)}input.value=JSON.stringify(item.value)}else{input=document.createElement(item.key==='noteTemplate'?'textarea':'input');if(item.type==='boolean'){input.type='checkbox';input.checked=Boolean(item.value)}else{if(item.type==='number'||item.type==='integer'){input.type='number';input.step=item.type==='integer'?'1':'any';if(item.minimum!==undefined)input.min=String(item.minimum);if(item.maximum!==undefined)input.max=String(item.maximum)}input.value=String(item.value??'')}}input.dataset.setting=item.key;label.append(input);const description=document.createElement('small');description.textContent=item.description;label.append(description);container.append(label);if(focused===item.key)input.focus()}}
  const date=value=>value?new Date(value).toLocaleString():'—';
  window.addEventListener('message',event=>{if(event.data?.type!=='state')return;const s=event.data.value;renderSettings(s.settings);byId('automatic').checked=s.automatic;byId('encrypted').checked=s.encrypted;byId('interval').value=String(s.intervalMinutes);byId('upload').checked=s.uploadToDrive;byId('private-row').hidden=!s.supportsPrivateKeys;byId('private-keys').checked=Boolean(s.privateKeys);byId('private-keys').disabled=s.busy||!s.encrypted||!s.passphraseConfigured;byId('passphrase-state').textContent=s.passphraseConfigured?labels.configured:labels.missing;byId('directory').textContent=s.directory;byId('data-directory').textContent=s.dataDirectory;byId('drive-state').textContent=s.connected?labels.connected:labels.disconnected;byId('credential-state').textContent=s.credentialsConfigured?labels.credentialsReady:labels.credentialsMissing;byId('project').value=s.projectId||'';byId('credential-path').textContent=s.credentialsPath||'';byId('credential-path').hidden=!s.credentialsPath;byId('connect').textContent=s.connected?labels.reconnect:labels.connect;byId('disconnect').hidden=!s.connected;byId('last-local').textContent=s.lastLocal||labels.none;byId('last-remote').textContent=date(s.lastRemote);byId('next-run').textContent=s.automatic?date(s.nextRun):'—';byId('pending').textContent=String(s.pendingUploads);byId('coverage').textContent=s.coverage||'';byId('exclusions').replaceChildren(...s.exclusions.map(text=>{const li=document.createElement('li');li.textContent=text;return li}));byId('error').hidden=!s.error;byId('error-text').textContent=s.error||'';byId('activity').textContent=s.busy?labels.busy:labels.ready;document.querySelectorAll('button,input,select,textarea').forEach(el=>{if(!el.dataset.tab&&!el.dataset.help&&el.id!=='vscode')el.disabled=s.busy});byId('private-keys').disabled=s.busy||!s.encrypted||!s.passphraseConfigured;byId('remote-import').disabled=s.busy||!s.connected;byId('test').disabled=s.busy||!s.connected});document.querySelectorAll('[data-action],input').forEach(el=>el.disabled=true);vscode.postMessage({type:'ready'});
  </script></body></html>`;
}
