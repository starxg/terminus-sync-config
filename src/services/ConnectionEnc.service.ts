import { Injectable } from '@angular/core';
import { Connection } from 'api';
import * as keytar from 'keytar'

/**
 * https://github.com/Eugeny/terminus/blob/bd46b08c9d909603eca4f1ca149d9a2d0155117f/terminus-ssh/src/services/passwordStorage.service.ts
 */
@Injectable({ providedIn: 'root' })
export class ConnectionEnc {
    CryptoJS = require("crypto-js");
    async encConnection(conn: Connection,password:string): Promise<Object> {
        let key = this.CryptoJS.enc.Utf8.parse(this.parsePassword(password));
        let encryptedHost  = await this.encStr(conn.host,key);
        let encryptedPort  = await this.encStr(conn.port+"",key);
        let encryptedUser  = await this.encStr(conn.user,key);
        let encryptedPwd  = await this.encStr(conn.auth.password,key);
        return {
            host:encryptedHost,
            port:encryptedPort,
            user:encryptedUser,
            auth: {
                password: encryptedPwd,
                encryptType: 'AES'
            }
        };
    }

    async decryptConnection(conn: Connection,password:string): Promise<Connection> {
        let key = this.CryptoJS.enc.Utf8.parse(this.parsePassword(password));
        let decrypHost  = await this.decryptStr(conn.host,key);
        let decrypPort  = await this.decryptStr(conn.port+"",key);
        let decrypUser  = await this.decryptStr(conn.user,key);
        let decrypPwd  = await this.decryptStr(conn.auth.password,key);
        return {
            host:decrypHost,
            port:parseInt(decrypPort),
            user:decrypUser,
            auth: {
                password: decrypPwd,
                encryptType: 'AES'
            }
        };
    }

    parsePassword(password:string):string{
        if(password.length>16){
            password = password.slice(0,16)
        }
        while(password.length<16){
            password+="a"
        }
        return password;
    }

    async encStr(plain:string,key:string):Promise<string>{
        return this.CryptoJS.AES.encrypt(plain, key, {
            mode: this.CryptoJS.mode.ECB,
            padding: this.CryptoJS.pad.Pkcs7
        }).ciphertext.toString();
    }

    async decryptStr(encstr:string,key:string):Promise<string>{
        let encryptedHexStr  = this.CryptoJS.enc.Hex.parse(encstr);
        let encryptedBase64Str  = this.CryptoJS.enc.Base64.stringify(encryptedHexStr);
        return this.CryptoJS.AES.decrypt(encryptedBase64Str, key, {
            mode: this.CryptoJS.mode.ECB,
            padding: this.CryptoJS.pad.Pkcs7
        }).toString(this.CryptoJS.enc.Utf8);
    }
}