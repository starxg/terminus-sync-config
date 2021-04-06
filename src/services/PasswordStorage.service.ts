import { Injectable } from '@angular/core';
import * as keytar from 'keytar'


function getKey(host, port) {
    let key = `ssh@${host}`
    if (port) {
        key = `ssh@${host}:${port}`
    }
    return key;
}

/**
 * https://github.com/Eugeny/terminus/blob/bd46b08c9d909603eca4f1ca149d9a2d0155117f/terminus-ssh/src/services/passwordStorage.service.ts
 */
@Injectable({ providedIn: 'root' })
export class PasswordStorageService {



    async savePassword({ host, port, user, password }): Promise<void> {

        return keytar.setPassword(getKey(host, port), user, password)
    }

    async deletePassword({ host, port, user }): Promise<void> {
        await keytar.deletePassword(getKey(host, port), user)
    }

    async loadPassword({ host, port, user }): Promise<string | null> {
        return keytar.getPassword(getKey(host, port), user)
    }
}