import 'dotenv/config';
import axios from 'axios';

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

        console.log('Response headers:', response.headers['set-cookie']);
    } catch (error) {
        console.error('Error:', error);
    }
}

getAuthenticationToken();