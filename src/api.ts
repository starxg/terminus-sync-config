import axios, { AxiosResponse } from "axios";

function resolveGist(response: AxiosResponse): any {
    if (response.data.files["config.json"] && response.data.files["config.json"].content) {
        return response.data.files["config.json"].content;
    }
    throw 'the config file is bad.';
}

async function syncGitee(token: string, gist: string, config: string): Promise<string> {
    const url = gist ? `https://gitee.com/api/v5/gists/${gist}` : "https://gitee.com/api/v5/gists";
    const data = {
        access_token: token,
        files: {
            "config.json": { content: config }
        },
        description: "sync terminus config",
        public: false,
        id: gist || ''
    };
    const method = gist ? 'PATCH' : 'POST';

    return new Promise(async (resolve, reject) => {
        try {
            const result = await axios.request({
                method,
                url,
                data,
            })
            resolve(result.data.id);
        } catch (error) {
            if (error.response) {
                if (error.response.status === 404) {
                    reject(error.message);
                } else {
                    reject(error.response.data.message);
                }
            } else {
                reject(error.message);
            }
        }
    });

}

async function syncGithub(token: string, gist: string, config: string): Promise<any> {


    const url = gist ? `https://api.github.com/gists/${gist}` : "https://api.github.com/gists";
    const data = {
        files: {
            "config.json": { content: config }
        },
        description: "sync terminus config",
        public: false
    };
    const method = gist ? 'PATCH' : 'POST';

    return new Promise(async (resolve, reject) => {
        try {
            const result = await axios.request({
                method,
                url,
                data,
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })
            resolve(result.data.id);
        } catch (error) {
            if (error.response) {
                if (error.response.status === 404) {
                    reject(error.message);
                } else {
                    reject(error.response.data.message);
                }
            } else {
                reject(error.message);
            }
        }
    });
}

export function syncGist(type: string, token: string, gist: string, config: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
        try {
            if (type === 'Gitee') {
                resolve(await syncGitee(token, gist, config));
            } else if (type === 'GitHub') {
                resolve(await syncGithub(token, gist, config));
            } else {
                throw "unknown the type " + type;
            }
        } catch (error) {
            reject(error);
        }
    });
}

export function getGist(type: string, token: string, gist: string): Promise<string> {

    const isGithub = type === 'GitHub';
    const url = isGithub ? `https://api.github.com/gists/${gist}` : `https://gitee.com/api/v5/gists/${gist}`;

    var config = <any>{
        headers: {},
        params: {}
    };

    if (isGithub) config.headers.Authorization = `Bearer ${token}`
    else config.params.access_token = token;

    return new Promise(async (resolve, reject) => {
        try {

            resolve(resolveGist(await axios.get(url, config)));

        } catch (error) {
            console.error(error);
            if (typeof error === "string") {
                reject(error);
            } else if (error.response) {
                if (error.response.status === 404) {
                    reject(error.message);
                } else {
                    reject(error.response.data.message);
                }
            } else {
                reject(error.message);
            }
        }
    });
}