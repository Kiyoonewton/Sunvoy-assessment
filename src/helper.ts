import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';

const password = process.env.SUNVOY_PASSWORD || 'test';
const username = process.env.SUNVOY_USERNAME || 'demo@example.org';

// function to extract the nonce from the login page
async function extractNonce(): Promise<string | null> {
    try {
        const loginPageResponse = await axios.get(process.env.SUNVOY_LOGIN_URL || 'https://challenge.sunvoy.com/login');

        const html = loginPageResponse.data;
        const nonceMatch = html.match(/name="nonce"\s+value="([^"]+)"/);
        const nonce = nonceMatch ? nonceMatch[1] : null;
        return nonce;
    } catch (error) {
        console.error('Error extracting nonce:', error);
        return null;
    }
}

//function to get the authentication token and return the cookie
export async function getAuthenticationToken(): Promise<string | null> {
    const nonce = await extractNonce();

    if (!nonce) {
        console.error('Failed to extract nonce');
        return null;
    }

    try {
        const response = await axios.post(
            process.env.SUNVOY_LOGIN_URL || 'https://challenge.sunvoy.com/login',
            `nonce=${nonce}&username=${username}&password=${password}`,
            {
                maxRedirects: 0,
                validateStatus: status => status < 400,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const cookies = response.headers['set-cookie'];
        if (!cookies) {
            console.error('No cookies received from authentication');
            return null;
        }

        await fs.writeFile('cookie_config.json', JSON.stringify(cookies, null, 2));

        const cookieString = cookies.map((cookie: string) => cookie.split(';')[0]).join('; ');
        return cookieString;
    } catch (error) {
        console.error('Error during authentication:', error);
        return null;
    }
}

// Function to create a checkcode for API requests
export function createCheckcode(params: { [key: string]: string | number }): string {
    const sortedKeys = Object.keys(params).sort();

    const payload = sortedKeys
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    const hmac = crypto.createHmac('sha1', process.env.SUNVOY_SECRET_KEY || 'mys3cr3t');
    hmac.update(payload);

    return hmac.digest('hex').toUpperCase();
}

// Function to check the validity of the cookie and return it or get a new authentication token
export async function checkCookieValidity(): Promise<string | null> {
    try {
        const data = await fs.readFile('cookie_config.json', 'utf8');
        const cookieArray = JSON.parse(data);
        const cookie = cookieArray.map((cookie: string) => cookie.split(';')[0]).join('; ');

        const response = await axios.post(process.env.SUNVOY_USERS_API || 'https://challenge.sunvoy.com/api/users',
            {}, {
            headers: {
                'Cookie': cookie,
                'Accept': 'application/json'
            }
        });

        if (response.status === 200) {
            return cookie;
        } else {
            const newCookie = await getAuthenticationToken();
            return newCookie;
        }
    } catch (error) {
        console.log('Cookie validation failed, getting new authentication token');
        const newCookie = await getAuthenticationToken();
        return newCookie;
    }
}

// Helper function to make the settings request
export async function makeSettingsRequest() {
    const data = await fs.readFile('user_token.json', 'utf8');
    const user_token = JSON.parse(data);
    const cookie = await checkCookieValidity();

    if (!cookie) {
        throw new Error('Failed to obtain valid authentication cookie');
    }

    return await axios.post(process.env.SUNVOY_SETTINGS_API || "https://api.challenge.sunvoy.com/api/settings", user_token, {
        headers: {
            'Cookie': cookie,
            'Accept': 'application/json'
        }
    });
}

// Function to get the users API and write to file
export async function getToken(): Promise<void> {
    try {
        const cookie = await checkCookieValidity();

        if (!cookie) {
            throw new Error('Failed to obtain valid authentication cookie');
        }

        const response = await axios.get(process.env.SUNVOY_SETTINGS_TOKEN || 'https://challenge.sunvoy.com/settings/tokens', {
            headers: {
                'Cookie': cookie,
                'Accept': 'application/json'
            }
        });

        const tokenMatches = {
            access_token: response.data.match(/id="access_token"\s+value="([^"]+)"/),
            openId: response.data.match(/id="openId"\s+value="([^"]+)"/),
            userId: response.data.match(/id="userId"\s+value="([^"]+)"/),
            apiuser: response.data.match(/id="apiuser"\s+value="([^"]+)"/),
            operateId: response.data.match(/id="operateId"\s+value="([^"]+)"/),
            language: response.data.match(/id="language"\s+value="([^"]+)"/)
        };

        const token: { [key: string]: string | number } = {};
        let missingTokens: string[] = [];

        for (const [key, match] of Object.entries(tokenMatches)) {
            if (match && match[1]) {
                token[key] = match[1];
            } else {
                missingTokens.push(key);
                token[key] = '';
            }
        }

        if (missingTokens.length > 0) {
            console.warn('Warning: Missing tokens:', missingTokens);
        }

        token['timestamp'] = Math.floor(Date.now() / 1000).toString();
        const checkcode = createCheckcode(token);
        token['checkcode'] = checkcode;

        await fs.writeFile('user_token.json', JSON.stringify(token, null, 2));
    } catch (error) {
        console.error('Error fetching tokens:', error);
        throw error;
    }
}