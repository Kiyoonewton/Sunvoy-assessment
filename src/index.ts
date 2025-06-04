import 'dotenv/config';
import axios from 'axios';
import fs from 'fs/promises';
import { checkCookieValidity, getToken, makeSettingsRequest } from './helper';

//function to get the users api and write to file
async function getUsers() {
    try {
        const cookie = await checkCookieValidity();
        const response = await axios.post(process.env.SUNVOY_USERS_API || 'https://challenge.sunvoy.com/api/users',
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
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

// Function to make the settings request
async function getAutheticatedUserData(retryCount = 0) {
    const maxRetries = 2;
    try {
        const user = await makeSettingsRequest();
        let existingUsers = [];
        try {
            const existingData = await fs.readFile('users.json', 'utf8');
            existingUsers = JSON.parse(existingData);
        } catch (error) {
            await getUsers();
            const existingData = await fs.readFile('users.json', 'utf8');
            existingUsers = JSON.parse(existingData);
        }

        let updatedUsers;
        updatedUsers = [...existingUsers, user.data];
        await fs.writeFile('users.json', JSON.stringify(updatedUsers, null, 2));
    } catch (error: any) {
        if (error.response?.data?.error === 'Request timestamp too old or too far in future' && retryCount < maxRetries) {
            await getToken();

            return await getAutheticatedUserData(retryCount + 1);
        }

        console.error('Error fetching authenticated user:', error.response?.data?.error || error.message);
    }
}

async function main() {
    try {
        await getUsers();
        console.log('9 users successfully added to users.json');
        await getAutheticatedUserData();
        console.log('10 users successfully added to users.json');
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main();