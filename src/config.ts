import { ConfigProvider } from 'terminus-core';

export class SyncConfigProvider extends ConfigProvider {
    defaults = {
        syncConfig: {
            type: 'Off',
            baseUrl: '',
            token: '',
            gist: '',
            lastSyncTime: '-',
            autoSync: false,
            autoSyncIntervalSec: 60,
            encryption: false
        }
    }
}