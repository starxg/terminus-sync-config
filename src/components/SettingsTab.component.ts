import { Component, OnInit } from '@angular/core'
import { ConfigService, ElectronService, } from 'terminus-core'
import { ToastrService } from 'ngx-toastr'
import { Connection, getGist, syncGist } from 'api';
import { PasswordStorageService } from 'services/PasswordStorage.service';
import { ConnectionEnc } from 'services/ConnectionEnc.service';

/** @hidden */
@Component({
    template: require('./SettingsTab.component.pug'),
    styles: [require('./SettingsTab.component.scss')]
})
export class SyncConfigSettingsTabComponent implements OnInit {
    private isUploading: boolean = false;
    private isDownloading: boolean = false;

    constructor(
        public config: ConfigService,
        private toastr: ToastrService,
        private electron: ElectronService,
        private passwordStorage: PasswordStorageService,
        private connectionEnc: ConnectionEnc,
    ) {
    }

    ngOnInit(): void {
    }

    private dateFormat(date: Date): any {
        var fmt = "yyyy-MM-dd HH:mm:ss";
        var o = {
            "M+": date.getMonth() + 1,
            "d+": date.getDate(),
            "H+": date.getHours(),
            "m+": date.getMinutes(),
            "s+": date.getSeconds(),
            "q+": Math.floor((date.getMonth() + 3) / 3),
            "S": date.getMilliseconds()
        };
        if (/(y+)/.test(fmt))
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
            if (new RegExp("(" + k + ")").test(fmt))
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }


    async sync(isUploading: boolean): Promise<void> {

        const type = this.config.store.syncConfig.type;
        const token = this.config.store.syncConfig.token;
        const gistId = this.config.store.syncConfig.gist;

        if (!token) {
            this.toastr.error("token is missing");
            return;
        }

        if (isUploading) this.isUploading = true;
        else {
            if (!gistId) {
                this.toastr.error("gist id is missing");
                return;
            }
            this.isDownloading = true;
        }


        try {
            const yaml = require('js-yaml')
            if (isUploading) {
                const configs = new Map<string, string>();
                let config_json = yaml.load(this.config.readRaw())
                //配置的加密密钥不上传
                delete config_json.syncConfig.token;
                // config file
                configs.set('config.json', yaml.dump(config_json));
                // ssh password
                configs.set('ssh.auth.json', JSON.stringify(await this.getSSHPluginAllPasswordInfos()))
                this.config.store.syncConfig.gist = await syncGist(type, token, gistId, configs);

            } else {

                const result = await getGist(type, token, gistId);

                if (result.get('config.json')) {
                    let config_json = yaml.load(this.config.readRaw())
                    //把当前本地保存的token写回来
                    config_json.syncConfig.token = this.config.store.syncConfig.token
                    this.config.writeRaw(yaml.dump(config_json));
                }

                if (result.get('ssh.auth.json')) {
                    await this.saveSSHPluginAllPasswordInfos(JSON.parse(result.get('ssh.auth.json')) as Connection[]);
                }


                if (this.config.store.syncConfig.gist !== gistId) {
                    this.config.store.syncConfig.gist = gistId;
                }
            }

            this.toastr.info('Sync succeeded', null, {
                timeOut: 1500
            });

            this.config.store.syncConfig.lastSyncTime = this.dateFormat(new Date);

        } catch (error) {
            this.toastr.error(error);
        } finally {
            if (isUploading) this.isUploading = false;
            else this.isDownloading = false;
            this.config.save();
        }

    }

    viewGist(): void {
        if (this.config.store.syncConfig.type === 'GitHub') {
            this.electron.shell.openExternal('https://gist.github.com/' + this.config.store.syncConfig.gist)
        }
    }

    async saveSSHPluginAllPasswordInfos(conns: Connection[]) {
        if (conns.length < 1) return;
        for (const conn of conns) {
            try {
                if (!conn.auth.encryptType || (conn.auth.encryptType && conn.auth.encryptType === 'NONE')) {
                    await this.passwordStorage.savePassword(conn)
                } else {
                    await this.passwordStorage.savePassword(await this.connectionEnc.decryptConnection(conn, this.config.store.syncConfig.token));
                }
            } catch (error) {
                console.error(conn, error);
            }
        }

    }

    getSSHPluginAllPasswordInfos(): Promise<Connection[]> {
        return new Promise(async (resolve) => {

            const connections = this.config.store.ssh.connections;
            if (!(connections instanceof Array) || connections.length < 1) {
                resolve([]);
                return;
            }

            const infos = [];
            for (const connect of connections) {
                try {
                    const { host, port, user } = connect;
                    const pwd = await this.passwordStorage.loadPassword({ host, port, user });
                    if (!pwd) continue;
                    if (this.config.store.syncConfig.encrypted === '0') {
                        infos.push({
                            host, port, user,
                            auth: {
                                password: pwd,
                                encryptType: 'NONE'
                            }
                        });
                    } else {
                        infos.push(await this.connectionEnc.encConnection({
                            host, port, user,
                            auth: {
                                password: pwd,
                                encryptType: 'AES'
                            }
                        }, this.config.store.syncConfig.token));
                    }
                } catch (error) {
                    console.error(connect, error);
                }
            }

            resolve(infos);

        });
    }

}
