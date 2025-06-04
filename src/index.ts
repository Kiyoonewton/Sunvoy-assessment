import 'dotenv/config';
import axios from 'axios';
import fs from 'fs/promises';

const password = process.env.SUNVOY_PASSWORD || '';
const username = process.env.SUNVOY_USERNAME || '';

// function to extract the nonce from the login page
async function extractNonce() {
    try {
        const loginPageResponse = await axios.get('https://challenge.sunvoy.com/login');

        const html = loginPageResponse.data;
        const nonceMatch = html.match(/name="nonce"\s+value="([^"]+)"/);
        const nonce = nonceMatch ? nonceMatch[1] : null;
        return (nonce);
    } catch (error) {
        console.error('Error extracting nonce:', error);
        return null;
    }
}

//function to get the authentication token
async function getAuthenticationToken() {
    const nonce = await extractNonce();
    try {
        const response = await axios.post(
            'https://challenge.sunvoy.com/login',
            `nonce=${nonce}&username=${username}&password=${password}`,
            {
                maxRedirects: 0,
                validateStatus: status => status < 400,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        await fs.writeFile('cookie_config.json', JSON.stringify(response.headers['set-cookie'], null, 2));
        // return response.headers['set-cookie']?.map(cookie => cookie.split(';')[0]).join('; ');
    } catch (error) {
        console.error('Error:', error);
        return null;
    }
}

// getAuthenticationToken();

//function to get the users api and write to file
async function getUsers() {
    try {
        const data = await fs.readFile('cookie_config.json', 'utf8');
        const cookie = (JSON.parse(data) as string[])?.map((cookie: string) => cookie.split(';')[0]).join('; ');
        const response = await axios.post('https://challenge.sunvoy.com/api/users',
            {},
            {
                headers: {
                    'Cookie': cookie,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        await fs.writeFile('users.json', JSON.stringify(response.data, null, 2));

        // return response.data;
    } catch (error) {
        console.error('Error fetching users:', error);
        return null;
    }
}

getUsers();