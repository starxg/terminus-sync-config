import { Injectable } from '@angular/core'
import { SyncConfigSettingsTabComponent } from 'components/settingsTab.component'
import { SettingsTabProvider } from 'terminus-settings'
@Injectable()
export class SyncConfigSettingsTabProvider extends SettingsTabProvider {
    id = 'sync-config'
    icon = 'cloud'
    title = 'Sync Config'

    getComponentType(): any {
        return SyncConfigSettingsTabComponent;
    }
}
