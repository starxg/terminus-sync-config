import { Component, OnInit } from '@angular/core'
import { ConfigService, PlatformService } from 'terminus-core'
import { ToastrService } from 'ngx-toastr'
import { Connection, getGist, syncGist } from 'api';
import { PasswordStorageService } from 'services/PasswordStorage.service';
import CryptoJS from 'crypto-js'
import * as yaml from 'js-yaml'
import { GistFile } from 'gist/Gist';

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
        private platform: PlatformService,
        private passwordStorage: PasswordStorageService
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

        const { type, token, gist, encryption } = this.config.store.syncConfig;
        const selfConfig = JSON.parse(JSON.stringify(this.config.store.syncConfig));

        if (!token) {
            this.toastr.error("token is missing");
            return;
        }

        if (isUploading) this.isUploading = true;
        else {
            if (!gist) {
                this.toastr.error("gist id is missing");
                return;
            }
            this.isDownloading = true;
        }


        try {
            if (isUploading) {
                const files = [];

                const store = yaml.load(this.config.readRaw()) as any;

                // no sync self
                delete store.syncConfig;

                // config file
                files.push(new GistFile('config.yaml', yaml.dump(store)));

                // ssh password
                files.push(new GistFile('ssh.auth.json', JSON.stringify(await this.getSSHPluginAllPasswordInfos(token))));

                this.config.store.syncConfig.gist = await syncGist(type, token, gist, files);

            } else {

                const result = await getGist(type, token, gist);

                if (result.has('config.yaml')) {
                    const config = yaml.load(result.get('config.yaml').value) as any;
                    config.syncConfig = selfConfig;
                    this.config.writeRaw(yaml.dump(config));
                }

                if (result.has('ssh.auth.json')) {
                    await this.saveSSHPluginAllPasswordInfos(JSON.parse(result.get('ssh.auth.json').value) as Connection[], token);
                }

            }

            this.toastr.info('Sync succeeded', null, {
                timeOut: 1500
            });

            this.config.store.syncConfig.lastSyncTime = this.dateFormat(new Date);

        } catch (error) {
            console.error(error);
            this.toastr.error(error);
        } finally {
            if (isUploading) this.isUploading = false;
            else this.isDownloading = false;
            this.config.save();
        }

    }

    private sleepMs(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async autoSync(autoSyncIntervalSec: number): Promise<void> {
        this.config.save();
        while (this.config.store.syncConfig.autoSync) {
            // download first
            await this.sync(false);
            await this.sync(true);
            await this.sleepMs(autoSyncIntervalSec * 1000);
        }
    }

    viewGist(): void {
        if (this.config.store.syncConfig.type === 'GitHub') {
            this.platform.openExternal('https://gist.github.com/' + this.config.store.syncConfig.gist)
        } else if (this.config.store.syncConfig.type === 'GitLab') {
            this.platform.openExternal('https://gitlab.com/-/snippets/' + this.config.store.syncConfig.gist)
        }
    }

    async saveSSHPluginAllPasswordInfos(conns: Connection[], token: string) {
        if (conns.length < 1) return;
        for (const conn of conns) {
            try {
                if (conn.auth !== null && conn.auth.encryptType && conn.auth.encryptType === 'AES') {
                    conn.auth.password = this.aesDecrypt(conn.auth.password, token);
                }
                await this.passwordStorage.savePassword(conn)
            } catch (error) {
                console.error(conn, error);
            }
        }

    }

    getSSHPluginAllPasswordInfos(token: string): Promise<Connection[]> {
        return new Promise(async (resolve) => {

            const connections = this.config.store.ssh.connections;
            if (!(connections instanceof Array) || connections.length < 1) {
                resolve([]);
                return;
            }

            const isEncrypt = this.config.store.syncConfig.encryption === true;

            const infos = [];
            for (const connect of connections) {
                try {
                    const { host, port, user } = connect;
                    const pwd = await this.passwordStorage.loadPassword({ host, port, user });
                    if (!pwd) continue;
                    infos.push({
                        host, port, user,
                        auth: {
                            password: isEncrypt ? this.aesEncrypt(pwd.toString(), token) : pwd,
                            encryptType: isEncrypt ? 'AES' : 'NONE'
                        }
                    });
                } catch (error) {
                    console.error(connect, error);
                }
            }

            resolve(infos);

        });


    }

    /* AES Begin http://www.kt5.cn/fe/2019/12/12/cryptojs-aes-128-bit-ecrypt-decrypt/ */

    aesEncrypt(str: string, token: string) {
        const k = this.getEncKey(token);
        const formatedKey = CryptoJS.enc.Utf8.parse(k)
        const formatedIv = CryptoJS.enc.Utf8.parse(k)
        const encrypted = CryptoJS.AES.encrypt(str, formatedKey, { iv: formatedIv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 })
        return encrypted.ciphertext.toString()
    }

    aesDecrypt(encryptedStr: string, token: string) {
        const encryptedHexStr = CryptoJS.enc.Hex.parse(encryptedStr)
        const encryptedBase64Str = CryptoJS.enc.Base64.stringify(encryptedHexStr)
        const k = this.getEncKey(token);
        const formatedKey = CryptoJS.enc.Utf8.parse(k)
        const formatedIv = CryptoJS.enc.Utf8.parse(k)
        const decryptedData = CryptoJS.AES.decrypt(encryptedBase64Str, formatedKey, { iv: formatedIv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 })
        return decryptedData.toString(CryptoJS.enc.Utf8)
    }

    getEncKey(token: string): string {
        const diff = 16 - token.length;
        if (diff < 0) {
            return token.substr(0, 16);
        }
        return token + Array(diff + 1).join('0');
    }

    /* AES End */
}
