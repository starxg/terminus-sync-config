import { NgModule } from '@angular/core'
import { SettingsTabProvider } from 'terminus-settings'
import { SyncConfigSettingsTabProvider } from './settings'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { NgbModule } from '@ng-bootstrap/ng-bootstrap'
import { ConfigProvider } from 'terminus-core';
import { SyncConfigProvider } from 'config';
import { SyncConfigSettingsTabComponent } from 'components/settingsTab.component'

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        NgbModule,
    ],
    providers: [
        { provide: SettingsTabProvider, useClass: SyncConfigSettingsTabProvider, multi: true },
        { provide: ConfigProvider, useClass: SyncConfigProvider, multi: true },
    ],
    entryComponents: [
        SyncConfigSettingsTabComponent
    ],
    declarations: [
        SyncConfigSettingsTabComponent
    ],
})

export default class SyncConfigModule { }